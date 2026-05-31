// Fasitfy plugins
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

// routes
import { authRoutes } from './routes/auth.routes.js';

import { config } from './config/index.js';
import { globalErrorHandler } from './errors/error-handler.js';

const fastify = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();

// Plugins
fastify.register(fastifyHelmet);
fastify.register(fastifyCors);
fastify.register(fastifyCookie, { secret: config.cookie.secret });

// Routes
fastify.register(authRoutes, { prefix: '/auth' });

// Error Handler
fastify.setErrorHandler(globalErrorHandler);

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

fastify.listen({ port: config.port }, (err) => {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
    fastify.log.info(`Auth Service running on port ${config.port}`);
});
