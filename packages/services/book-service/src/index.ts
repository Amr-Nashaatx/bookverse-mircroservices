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
fastify.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
});

fastify.setErrorHandler(globalErrorHandler);

if (config.nodeEnv !== 'production') {
    fastify.addHook('preHandler', async (request, reply) => {
        const faultDelay = (request.headers['x-fault-delay'] as string) ?? null;
        const faultStatus = (request.headers['x-fault-status'] as string) ?? null;

        if (faultDelay) {
            if (!Number.isFinite(parseInt(faultDelay))) return reply.status(400).send('Invalid fault delay header');
            request.log.warn(`Fault delay fired for ${parseInt(faultDelay)}`);
            await new Promise((resolve) => setTimeout(resolve, parseInt(faultDelay)));
        }
        if (faultStatus) {
            request.log.warn('Fault status fired');
            return reply.status(parseInt(faultStatus)).send();
        }
    });
}

// Everything under /books requires the caller to be the gateway
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
