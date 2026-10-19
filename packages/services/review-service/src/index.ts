// Fastify plugins
import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
// routes
import { reviewRoutes } from './routes/review.routes.js';

import {
    connectBroker,
    disconnectBroker,
    REVIEWS_EXCHANGE,
    BOOKS_EXCHANGE,
    BOOKS_DLX,
    consumeEvents,
    startRelay,
    getConfirmChannel,
} from '@bookverse/shared';

import { config } from './config/index.js';
import { globalErrorHandler, makeVerifyGatewaySecret } from '@bookverse/shared';
import { BooksDlq, BooksQeueue } from './config/queues.js';
import { OutboxStore } from './repositories/outbox.repository.js';

const fastify = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

let stopRelay: (() => void) | undefined;
// Broker
connectBroker(config.rabbitmq.url, async (channel) => {
    await channel.assertExchange(REVIEWS_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(BOOKS_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(BOOKS_DLX, 'topic', { durable: true });

    await consumeEvents(channel, BooksDlq);
    await consumeEvents(channel, BooksQeueue);
}).then(() => {
    stopRelay = startRelay(OutboxStore, getConfirmChannel, { batchSize: 50, intervalMs: 200 });
});

// Plugins
fastify.register(fastifyHelmet);
fastify.register(fastifyCors);

// Health check — outside the secured context so the Docker healthcheck reaches it without the gateway secret.
fastify.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
});

fastify.setErrorHandler(globalErrorHandler);

// Everything under /reviews requires the caller to be the gateway
fastify.register(async (secured) => {
    secured.addHook('preHandler', makeVerifyGatewaySecret(config.gateway.secrets));
    secured.register(reviewRoutes, { prefix: '/reviews' });
});

// Graceful Shutdown
const shutdown = async () => {
    await fastify.close();
    if (stopRelay) stopRelay();
    await disconnectBroker();
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
    fastify.log.info(`Review Service running on port ${config.port}`);
});
