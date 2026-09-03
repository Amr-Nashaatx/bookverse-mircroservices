import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { IncomingHttpHeaders } from 'node:http';
import fastifyHttpProxy, { FastifyHttpProxyOptions } from '@fastify/http-proxy';
import { verifyJwt } from '../plugins/verify-jwt.js';
import { stripHeaders, withUserAndSecret } from '../utils/requestHeadersUtils.js';
import { config } from '../config/index.js';
import { CircuitBreaker } from '../plugins/circuit-breaker.js';
import { guardWithBreaker } from './guardWithBreaker.js';

export type ServiceEdgeSpec = {
    upstream: string;
    prefix: string;
    forwardsIdentity?: boolean;
    timeoutMs?: number;
    connections?: number;
    /** 503 retries per request, and ONLY 503s on GET. Connection errors are
     *  governed by reply-from's `retriesCount`, which defaults to never. */
    retriesOn503?: number;
};

/** A reason THIS request must not be retried. Any veto wins. */
type RetryVeto = (request: FastifyRequest) => boolean;

/** Ceiling on an upstream's Retry-After, so one bad header can't park a caller. */
const MAX_RETRY_AFTER_MS = 5_000;

/** Ceiling on the randomised backoff. */
const MAX_BACKOFF_MS = 2_000;

type EdgePreHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

/*
 * The gateway's own vocabulary for a hop to a callee.
 *
 * @fastify/http-proxy carries @fastify/reply-from's types out through
 * `replyOptions`, and reply-from is a dependency we never chose. So it stops
 * here: the adapter in `finalizeProxy` is the only code that sees those types,
 * and everything registered from outside speaks these instead.
 */

/** Headers on their way OUT to the callee. */
export type OutboundHeaders = Record<string, string | string[] | number | undefined>;

/** What came back from the callee. */
export type UpstreamResponse = {
    statusCode: number;
    headers: IncomingHttpHeaders;
};

export type HeaderRewriter = (request: FastifyRequest, headers: OutboundHeaders) => OutboundHeaders;

export type ResponseObserver = (request: FastifyRequest, response: UpstreamResponse) => void;
export type ErrorObserver = (request: FastifyRequest, error: Error) => void;

export class ServiceProxy {
    private proxy: FastifyHttpProxyOptions;
    private preHandlers: EdgePreHandler[] = [];
    private headerRewriters: HeaderRewriter[] = [];
    private responseObservers: ResponseObserver[] = [];
    private errorObservers: ErrorObserver[] = [];
    private retryVetoes: RetryVeto[] = [];

    constructor(
        private fastify: FastifyInstance,
        private spec: ServiceEdgeSpec,
    ) {
        this.proxy = {} as FastifyHttpProxyOptions;
        this.proxy.prefix = this.spec.prefix;
        this.proxy.upstream = this.spec.upstream;
        this.proxy.undici = { connections: this.spec.connections || 4 };
        this.proxy.replyOptions = { timeout: this.spec.timeoutMs || 1000 };
        if (this.spec.forwardsIdentity) {
            this.addPreHandlerLogic(async (request, reply) => {
                if (request.method !== 'GET') await verifyJwt(request, reply);
            });
        }
    }

    addPreHandlerLogic(cb: EdgePreHandler) {
        this.preHandlers.push(cb);
        return this;
    }

    addHeaderRewriter(rewrite: HeaderRewriter) {
        this.headerRewriters.push(rewrite);
        return this;
    }

    addResponseObserver(observe: ResponseObserver) {
        this.responseObservers.push(observe);
        return this;
    }

    addErrorObserver(observe: ErrorObserver) {
        this.errorObservers.push(observe);
        return this;
    }

    vetoRetries(veto: RetryVeto) {
        this.retryVetoes.push(veto);
        return this;
    }

    buildAndRegisterProxy(circuitBreaker?: CircuitBreaker) {
        /*
         * Registered for EVERY callee, not just the identity-forwarding ones:
         * the secret is the only thing proving a call came through the gateway,
         * and the strip is what stops a client smuggling its own x-user-*
         * headers through. Only the forwarding half is conditional.
         */
        this.addHeaderRewriter((request, headers) => {
            if (this.spec.forwardsIdentity && request.user) return withUserAndSecret(request, headers);
            const stripped = stripHeaders(headers);
            stripped['x-gateway-secret'] = config.secrets.gatewaySecret;
            return stripped;
        });
        if (circuitBreaker) guardWithBreaker(this, circuitBreaker);
        this.proxy.preHandler = async (request, reply) => {
            for (const handler of this.preHandlers) {
                await handler(request, reply);
                if (reply.sent) return reply;
            }
        };

        /*
         * Retries live in two hooks that are useless read apart, so they are
         * written together:
         *
         *   handler    -- WHETHER this request may retry (the vetoes) and HOW
         *                 MANY times (maxRetriesOn503).
         *   retryDelay -- HOW LONG to wait, and it defers "may we retry at all?"
         *                 back to getDefaultDelay -- which is the thing that
         *                 reads the maxRetriesOn503 the handler just set. That
         *                 hop is why neither half makes sense on its own.
         */
        this.proxy.handler = (request, reply, dest, options) => {
            // reply-from reads it as `opts.maxRetriesOn503 || 10`, so a zero becomes ten.
            if (this.retryVetoes.some((veto) => veto(request))) {
                return reply.from(dest, { ...options, retryDelay: () => null });
            }

            // Per request, because reply-from reads maxRetriesOn503 only from
            // these options. Set alongside `upstream` is
            // silently ignored.
            return reply.from(dest, {
                ...options,
                maxRetriesOn503: this.spec.retriesOn503 ?? 3,
            } as typeof options);
        };

        this.proxy.replyOptions = {
            ...this.proxy.replyOptions,

            // Backoff doubles per attempt and is randomised, so callers that
            // failed together don't return together as a wave.
            retryDelay: ({ err, req, res, attempt, getDefaultDelay }) => {
                // Keep first: null means reply-from itself refuses this one --
                // a write, or the attempt cap set in `handler` is spent.
                if (getDefaultDelay(req, res, err, attempt) === null) return null;

                // No response at all if the connection itself failed, so guard.
                const upstream = res as unknown as { headers?: Record<string, string | undefined> } | undefined;
                const retryAfter = Number(upstream?.headers?.['retry-after']);

                // Retry-After is in SECONDS. Floored at 1ms because a 0 delay
                // reads as "do not retry", which is not what Retry-After: 0 means.
                if (Number.isFinite(retryAfter) && retryAfter >= 0) {
                    return Math.min(Math.max(retryAfter * 1000, 1), MAX_RETRY_AFTER_MS);
                }

                return Math.random() * Math.min(MAX_BACKOFF_MS, 100 * 2 ** attempt);
            },

            rewriteRequestHeaders: (request, headers) =>
                this.headerRewriters.reduce(
                    (carried, rewrite) => rewrite(request as FastifyRequest, carried),
                    headers as OutboundHeaders,
                ) as typeof headers,

            onResponse: (request, reply, res) => {
                // reply-from types `res` as a ServerResponse, but what it hands
                // over is the upstream's IncomingMessage -- hence the reach for
                // `headers`, which the declared type does not carry.
                const response: UpstreamResponse = {
                    statusCode: res.statusCode,
                    headers: (res as unknown as { headers?: IncomingHttpHeaders }).headers ?? {},
                };
                for (const observe of this.responseObservers) observe(request as FastifyRequest, response);
                reply.send(res.stream);
            },
            onError: (reply, { error }) => {
                for (const observe of this.errorObservers) observe(reply.request as FastifyRequest, error);
                reply.send(error);
            },
        };

        this.fastify.register(fastifyHttpProxy, this.proxy);
    }
}
