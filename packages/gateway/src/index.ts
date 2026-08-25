import Fastify from 'fastify';
import fastifyHlemt from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyHttpProxy from '@fastify/http-proxy';

import { globalErrorHandler } from '@bookverse/shared';
// Local imports
import { config } from './config/index.js';
// Utils
import { bookServiceProxy } from './proxies/bookServiceProxy.js';
import { authServiceProxy } from './proxies/authServiceProxy.js';
import { createCircuitBreaker } from './plugins/circuit-breaker.js';

// Third-party plugins
const fastify = Fastify({ logger: true });
fastify.register(fastifyHlemt);
fastify.register(fastifyCors);

fastify.setErrorHandler(globalErrorHandler);

/*
 * Not done: a per-request deadline, and admission control in front of each pool.
 * A first attempt at the deadline alone did nothing -- `handler` runs on arrival,
 * before the pool makes anything wait, so there was never any elapsed time to
 * subtract. The two only work together. See docs/decisions/overload/deferred-deadlines.md.
 */
declare module 'fastify' {
    interface FastifyRequest {
        isProbe: boolean;
    }
}
const bookServiceBreaker = createCircuitBreaker(
    {
        minimumRequests: 10,
        failureRateThreshold: 0.5,
        name: 'book-service',
        // book's hop timeout is 1s and probes are never retried.
        probeTimeoutMs: 2_000,
        // With minimumRequests this sets a minimum traffic rate: at 10_000 it
        // demanded a sustained 1 req/sec we do not have, so it could never open.
        windowMs: 60_000,
        cooldownMs: 50_000,
    },
    fastify.log,
);

const authServiceBreaker = createCircuitBreaker(
    {
        minimumRequests: 10,
        failureRateThreshold: 0.5,
        name: 'auth-service',
        // auth's hop timeout is 2s.
        probeTimeoutMs: 3_000,
        windowMs: 60_000,
        cooldownMs: 50_000,
    },
    fastify.log,
);
// Proxies Public
fastify.decorateRequest('user', null as any);
fastify.decorateRequest('isProbe', false);

fastify.register(fastifyHttpProxy, authServiceProxy(authServiceBreaker));
// Proxies Protected
fastify.register(async (fastify) => {
    fastify.register(fastifyHttpProxy, bookServiceProxy(bookServiceBreaker));
    // other services later...
});

// Health check
fastify.get('/health', async (request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
});

// Graceful Shutdown
const shutdown = async () => {
    await fastify.close();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason) => {
    fastify.log.error(reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    fastify.log.error(error);
    process.exit(1);
});

// Run server
fastify.listen({ port: config.port, host: '0.0.0.0' }, (err) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});
