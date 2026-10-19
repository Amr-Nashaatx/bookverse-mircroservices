// Fastify plugins
import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
// routes
import { notificationRoutes } from './routes/notification.routes.js';

import { config } from './config/index.js';
import {
    connectBroker,
    consumeEvents,
    disconnectBroker,
    globalErrorHandler,
    makeVerifyGatewaySecret,
    NOTIFICATIONS_DLX,
    REVIEWS_EXCHANGE,
} from '@bookverse/shared';
import { NotificationsDlq, ReviewsQueue } from './config/queues.js';

const fastify = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

// Plugins
fastify.register(fastifyHelmet);
fastify.register(fastifyCors);

// Health check — outside the secured context so the Docker healthcheck reaches it without the gateway secret.
fastify.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
});

fastify.setErrorHandler(globalErrorHandler);

// Broker. Every exchange a queue binds to must be asserted first: binding to a
// missing one closes the channel (404), and nothing after it in setup runs.
connectBroker(config.rabbitmq.url, async (channel) => {
    await channel.assertExchange(REVIEWS_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(NOTIFICATIONS_DLX, 'topic', { durable: true });

    await consumeEvents(channel, NotificationsDlq);
    await consumeEvents(channel, ReviewsQueue);
});
// Everything under /notifications requires the caller to be the gateway
fastify.register(async (secured) => {
    secured.addHook('preHandler', makeVerifyGatewaySecret(config.gateway.secrets));
    secured.register(notificationRoutes, { prefix: '/notifications' });
});

// Graceful Shutdown
const shutdown = async () => {
    await fastify.close();
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
    fastify.log.info(`Notification Service running on port ${config.port}`);
});
