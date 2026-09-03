import Fastify from 'fastify';
import fastifyHlemt from '@fastify/helmet';
import fastifyCors from '@fastify/cors';

import { globalErrorHandler } from '@bookverse/shared';
// Local imports
import { config } from './config/index.js';
// Utils
import { authServiceBreaker } from './breakers/auth-breaker.js';
import { bookServiceBreaker } from './breakers/book-breaker.js';
import { reviewServiceBreaker } from './breakers/review-breaker.js';
import { ServiceProxy } from './proxies/ServiceProxy.js';
import { authProxySepc, bookProxySepc, reviewProxySpec } from './config/proxySpecs.js';

// Third-party plugins
const fastify = Fastify({ logger: true });
fastify.register(fastifyHlemt);
fastify.register(fastifyCors);

fastify.setErrorHandler(globalErrorHandler);

/*
 * Not done: a per-request deadline, and admission control in front of each pool.
 * A first attempt at the deadline alone did nothing -- `handler` runs on arrival,
 * before the pool makes anything wait, so there was never any elapsed time to
 * subtract. The two only work together -- see the end of
 * docs/decisions/overload/bulkheads.md.
 */
declare module 'fastify' {
    interface FastifyRequest {
        isProbe: boolean;
    }
}

// The breakers announce their state changes; here is where they become logs.
for (const breaker of [authServiceBreaker, bookServiceBreaker, reviewServiceBreaker]) {
    breaker.onTransition((transition) => fastify.log.warn(transition, 'circuit breaker'));
}

// Proxies Public
fastify.decorateRequest('user', null as any);
fastify.decorateRequest('isProbe', false);

new ServiceProxy(fastify, authProxySepc).buildAndRegisterProxy(authServiceBreaker);

// Proxies Protected
fastify.register(async (fastify) => {
    new ServiceProxy(fastify, bookProxySepc).buildAndRegisterProxy(bookServiceBreaker);
    new ServiceProxy(fastify, reviewProxySpec).buildAndRegisterProxy(reviewServiceBreaker);
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
