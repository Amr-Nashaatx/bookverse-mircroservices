import { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/index.js';
import { verifyJwt } from '../plugins/verify-jwt.js';
import { stripHeaders, withUserAndSecret } from '../utils/requestHeadersUtils.js';
import { FastifyHttpProxyOptions } from '@fastify/http-proxy';
import { CircuitBreaker } from '../plugins/circuit-breaker.js';
/*
 * Reads are retried, writes never are -- retrying a create that succeeded gives
 * you two reviews. See docs/decisions/partial-failure/read-retries.md.
 */

export const reviewServiceProxy = (breaker: CircuitBreaker) =>
    ({
        // `upstream` is the library's word for the callee.
        upstream: config.services.review,
        prefix: '/reviews',
        handler: (request, reply, dest, options) => {
            // A probe is one request by definition -- retrying it would aim more
            // at a callee we already believe is sick.
            if (request.isProbe) return reply.from(dest, { ...options, retryDelay: () => null });

            // Must be set per request: alongside `upstream` it type-checks and is
            // silently ignored, leaving the library default of 10 retries.
            // The cast is needed -- the option is declared on the plugin options
            // but only ever read from the per-request ones.
            return reply.from(dest, { ...options, maxRetriesOn503: 3 } as typeof options);
        },
        preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
            if (request.method !== 'GET') await verifyJwt(request, reply);
            const result = breaker.allowRequest();
            if (result === 'refused') return reply.status(503).header('retry-after', 1).send();
            if (result === 'probe') request.isProbe = true;
        },

        // Copied from book's pool as a starting point -- a review write is cheaper
        // than a book write, so this is a guess until scripts/sweep.mjs says otherwise.
        undici: { connections: 8 },
        replyOptions: {
            rewriteRequestHeaders(request, headers) {
                if (request.user) return withUserAndSecret(request as unknown as FastifyRequest, headers);
                const stripped = stripHeaders(headers);
                stripped['x-gateway-secret'] = config.secrets.gatewaySecret;
                return stripped;
            },
            timeout: config.services.timeouts.review,
            onResponse: (request, reply, res) => {
                const breakStatuscodes = [503, 504];
                if (breakStatuscodes.includes(res.statusCode)) {
                    breaker.recordFailure(`Response with status ${res.statusCode}`);
                    return reply.send(res.stream);
                } else if (res.statusCode === 500) return reply.send(res.stream);
                breaker.recordSuccess();
                return reply.send(res.stream);
            },
            onError: (reply, { error }) => {
                breaker.recordFailure(`Request error: ${error.message}`);
                return reply.send(error);
            },
            // Backoff doubles per attempt and is randomised, so callers that
            // failed together don't return together as a wave.
            retryDelay: ({ err, req, res, attempt, getDefaultDelay }) => {
                // Returns null for requests we must not retry (writes). Keep first.
                if (getDefaultDelay(req, res, err, attempt) === null) return null;

                // No response at all if the connection itself failed, so guard.
                const reviewResponse = res as unknown as { headers?: Record<string, string | undefined> } | undefined;
                const retryAfter = Number(reviewResponse?.headers?.['retry-after']);

                // Retry-After is in SECONDS; capped so a bad value can't park us.
                if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1000, 5_000);

                return Math.random() * Math.min(2_000, 100 * 2 ** attempt);
            },
        },
    }) satisfies FastifyHttpProxyOptions;
