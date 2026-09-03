// Fasitfy plugins
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
// routes
import { authRoutes } from './routes/auth.routes.js';

import { config } from './config/index.js';
import { globalErrorHandler } from '@bookverse/shared';

// Plugins
import { makeVerifyGatewaySecret } from '@bookverse/shared';
import { LoadShedder } from '@bookverse/shared';

const fastify = Fastify({ logger: true }).withTypeProvider<TypeBoxTypeProvider>();
// Plugins

fastify.register(fastifyHelmet);
fastify.register(fastifyCors);
fastify.register(fastifyCookie, { secret: config.cookie.secret });
fastify.setErrorHandler(globalErrorHandler);

// Health check
fastify.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() });
});

fastify.register(async (secured) => {
    const shedder = new LoadShedder(secured, {
        maxInFlightRequests: config.maxInFlightRequests,
        exemptRoutes: new Set(['/auth/pressure']),
    });

    shedder.bindShedder();
    secured.addHook('preHandler', makeVerifyGatewaySecret(config.gateway.secrets));
    secured.register(authRoutes, { prefix: '/auth' });

    // How loaded we are right now; read by scripts/sweep.mjs. Behind the
    // gateway secret -- how close to full we are is useful to an attacker.
    secured.get('/auth/pressure', async () => {
        // `limit` rides along so a reading is self-describing.
        return shedder.getStats();
    });
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
    fastify.log.info(`Auth Service running on port ${config.port}`);
});
