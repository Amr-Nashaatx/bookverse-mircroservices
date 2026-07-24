// Fastify plugins
import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
// routes
import { bookRoutes } from './routes/book.routes.js';

import { config } from './config/index.js';
import { globalErrorHandler, makeVerifyGatewaySecret } from '@bookverse/shared';

const fastify = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

// Plugins
fastify.register(fastifyHelmet);
fastify.register(fastifyCors);

// Health check — outside the secured context so the Docker healthcheck reaches it without the gateway secret.
fastify.get('/health', async (request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
});

fastify.setErrorHandler(globalErrorHandler);

// Everything under /books requires the caller to be the gateway (Lesson 01).
fastify.register(async (secured) => {
    secured.addHook('preHandler', makeVerifyGatewaySecret(config.gateway.secrets));
    secured.register(bookRoutes, { prefix: '/books' });
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

fastify.listen({ port: config.port, host: '0.0.0.0' }, (err) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`Book Service running on port ${config.port}`);
});
