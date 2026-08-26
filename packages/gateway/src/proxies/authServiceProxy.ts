import { config } from '../config/index.js';
import { CircuitBreaker } from '../plugins/circuit-breaker.js';
import { stripHeaders } from '../utils/requestHeadersUtils.js';
import { FastifyHttpProxyOptions } from '@fastify/http-proxy';

export const authServiceProxy = (breaker: CircuitBreaker) =>
    ({
        upstream: config.services.auth,
        prefix: '/auth',

        // Sized from measured capacity: auth completes ~6/sec and stops paying
        // past ~4 concurrent. See docs/decisions/overload/bulkheads.md.
        undici: { connections: 4 },
        replyOptions: {
            rewriteRequestHeaders: (_request, headers) => {
                let strippedHeaders = stripHeaders(headers);

                strippedHeaders['x-gateway-secret'] = config.secrets.gatewaySecret;
                return strippedHeaders;
            },
            timeout: config.services.timeouts.auth,
            onResponse: (request, reply, res) => {
                const breakStatuscodes = [503, 504];
                if (breakStatuscodes.includes(res.statusCode)) {
                    breaker.recordFailure(`Response with status ${res.statusCode}`);
                    return reply.send(res.stream);
                // 500 is ambiguous -- it can be one bad input rather than a sick
                // service. Recorded as neither success nor failure.
                } else if (res.statusCode === 500) return reply.send(res.stream);
                breaker.recordSuccess();
                return reply.send(res.stream);
            },
            onError: (reply, { error }) => {
                breaker.recordFailure(`Request error: ${error.message}`);
                return reply.send(error);
            },
        },
        preHandler: async (request, reply) => {
            const result = breaker.allowRequest();
            if (result === 'refused') return reply.status(503).header('retry-after', 1).send();
            if (result === 'probe') request.isProbe = true;
        },
        handler(request, reply, dest, options) {
            // A probe is one request by definition -- retrying it would aim more
            // at a callee we already believe is sick.
            if (request.isProbe) return reply.from(dest, { ...options, retryDelay: () => null });
            return reply.from(dest, options);
        },
    }) satisfies FastifyHttpProxyOptions;
