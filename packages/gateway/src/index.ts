import Fastify, { FastifyRequest } from 'fastify';
import fastifyHlemt from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyHttpProxy from '@fastify/http-proxy';

import { globalErrorHandler } from '@bookverse/shared';
// Local imports
import { config } from './config/index.js';
import { verifyJwt } from './plugins/verify-jwt.js';

// Utils
import { stripHeaders, withUserAndSecret } from './utils/requestHeadersUtils.js';
import fastifyCookie from '@fastify/cookie';
import { bookServiceProxy } from './proxies/bookServiceProxy.js';

// Third-party plugins
const fastify = Fastify({ logger: true });
fastify.register(fastifyHlemt);
fastify.register(fastifyCors);

fastify.setErrorHandler(globalErrorHandler);
// Proxies Public
fastify.decorateRequest('user', null as any);
fastify.register(fastifyHttpProxy, {
    upstream: config.services.auth,
    prefix: '/auth',
    replyOptions: {
        rewriteRequestHeaders: (_request, headers) => {
            let strippedHeaders = stripHeaders(headers);

            strippedHeaders['x-gateway-secret'] = config.secrets.gatewaySecret;
            return strippedHeaders;
        },
    },
});

// Proxies Protected
fastify.register(async (fastify) => {
    fastify.register(fastifyHttpProxy, bookServiceProxy);
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
