import { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/index.js';
import { verifyJwt } from '../plugins/verify-jwt.js';
import { stripHeaders, withUserAndSecret } from '../utils/requestHeadersUtils.js';
import { FastifyHttpProxyOptions } from '@fastify/http-proxy';

/*
 * Retry policy for calls to book-service.
 *
 * We only retry READS. Asking for the same page twice changes nothing, so a
 * read can be repeated safely. A write cannot: if we retry a create that
 * actually succeeded, we end up with two books. So writes are never retried
 * here — the retry is the user pressing the button again, and the
 * Idempotency-Key they send is what makes that safe.
 *
 * Do NOT add a `retriesCount` option. It reads like "retry a bit more", but it
 * switches off the 503 retries below and replaces them with something else.
 * Its absence is a decision.
 */
export const bookServiceProxy = {
    // `upstream` is the library's word for the service we call. Note it means
    // the opposite in some other tools, so elsewhere we say caller/callee.
    upstream: config.services.book,
    prefix: '/books',
    preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        if (request.method !== 'GET') await verifyJwt(request, reply);
    },

    // How many times to retry a read when book-service answers 503 — its way of
    // saying "I'm overloaded, come back later". The default is 10, and they all
    // land within about a second: that is piling load onto a service that just
    // told us it is struggling.
    maxRetriesOn503: 3,

    replyOptions: {
        rewriteRequestHeaders(request, headers) {
            // Identity is conditional (only on protected routes), but the gateway
            // secret is UNCONDITIONAL — every service call must prove it came from
            // the gateway, public routes included
            if (request.user) return withUserAndSecret(request as unknown as FastifyRequest, headers);
            const stripped = stripHeaders(headers);
            stripped['x-gateway-secret'] = config.secrets.gatewaySecret;
            return stripped;
        },
        timeout: config.services.timeouts.book,

        /*
         * How long to wait before each retry.
         *
         * Waits grow with each attempt (up to ~100ms, then ~200ms, ~400ms...,
         * capped at 2s) so a struggling service gets more room each time.
         *
         * And each wait is randomised. Without that, every client that failed at
         * the same moment would retry at the same moment, arriving together as a
         * wave and knocking the service over again. Spreading them out is the
         * entire point.
         */
        retryDelay: ({ err, req, res, attempt, getDefaultDelay }) => {
            // First ask: is this request one we're allowed to retry at all?
            // That check knows the rules (reads only, no request body) and
            // returns null for "don't". Skipping it would retry writes.
            if (getDefaultDelay(req, res, err, attempt) === null) return null;

            // `res` is book-service's response — there is none if the connection
            // itself failed, so guard before reading headers.
            const bookResponse = res as unknown as { headers?: Record<string, string | undefined> } | undefined;
            const retryAfter = Number(bookResponse?.headers?.['retry-after']);

            // If book-service told us when to come back, obey it. HTTP sends
            // Retry-After in SECONDS; this library passes the number through as
            // milliseconds, so convert. Capped so a bad value can't park the
            // request for minutes.
            if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1000, 5_000);

            // Otherwise wait a random amount, between zero and a ceiling that
            // doubles each attempt.
            return Math.random() * Math.min(2_000, 100 * 2 ** attempt);
        },
    },
} satisfies FastifyHttpProxyOptions;
