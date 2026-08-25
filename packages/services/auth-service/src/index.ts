// Fasitfy plugins
import Fastify from 'fastify';
import { performance } from 'node:perf_hooks';
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

// Replaced on every read, so a reading covers only the window since the last one.
let lastElu = performance.eventLoopUtilization();
let inFlight = 0;

// `inFlight` pins at the limit once we start refusing, so the rate this climbs
// at is the only measure of how much demand we are turning away.
let shedTotal = 0;

// A log line per refusal would be hundreds a second. One per interval instead.
const SHED_LOG_INTERVAL_MS = 5_000;
let lastShedLogAt = 0;

// Must answer while we refuse everything else, and must not count towards the
// limit. `/health` is absent because it lives outside this scope already.
const ALWAYS_ANSWER = new Set(['/auth/pressure']);

// Marks a request as counted, so the matching hook knows to subtract it again.
fastify.decorateRequest('counted', false);

fastify.register(async (secured) => {
    secured.addHook('onRequest', (req, reply, done) => {
        if (ALWAYS_ANSWER.has(req.routeOptions.url ?? '')) return done();

        inFlight += 1;
        req.counted = true;

        // The counter already includes this request, so compare it directly.
        if (inFlight > config.maxInFlightRequests) {
            shedTotal += 1;

            const now = Date.now();
            if (now - lastShedLogAt >= SHED_LOG_INTERVAL_MS) {
                lastShedLogAt = now;
                req.log.warn({ inFlight, limit: config.maxInFlightRequests, shedTotal }, 'at capacity: refusing new work');
            }

            // Standard error envelope, worded so it can't read as a bad password.
            return reply
                .status(503)
                .header('retry-after', 1)
                .send({ error: { message: 'We are busy right now. Please try again in a moment.' } });
        }

        done();
    });

    secured.addHook('onResponse', (req, _reply, done) => {
        if (req.counted) inFlight -= 1;
        done();
    });
    secured.addHook('preHandler', makeVerifyGatewaySecret(config.gateway.secrets));
    secured.register(authRoutes, { prefix: '/auth' });

    // How loaded we are right now; read by scripts/autocannon.mjs. Behind the
    // gateway secret -- how close to full we are is useful to an attacker.
    secured.get('/auth/pressure', async () => {
        const now = performance.eventLoopUtilization();
        const { utilization } = performance.eventLoopUtilization(now, lastElu);
        lastElu = now;

        // `limit` rides along so a reading is self-describing.
        return { eventLoopUtilized: utilization, inFlight, limit: config.maxInFlightRequests, shedTotal };
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
