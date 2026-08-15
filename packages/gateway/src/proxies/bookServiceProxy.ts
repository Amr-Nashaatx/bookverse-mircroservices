import { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/index.js';
import { verifyJwt } from '../plugins/verify-jwt.js';
import { stripHeaders, withUserAndSecret } from '../utils/requestHeadersUtils.js';
import { FastifyHttpProxyOptions } from '@fastify/http-proxy';

export const bookServiceProxy = {
    upstream: config.services.book,
    prefix: '/books',
    preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        if (request.method !== 'GET') await verifyJwt(request, reply);
    },
    replyOptions: {
        rewriteRequestHeaders(request, headers) {
            // Identity is conditional (only on protected routes), but the gateway
            // secret is UNCONDITIONAL — every service call must prove it came from
            // the gateway, public routes included
            if (request.user) return withUserAndSecret(request as unknown as FastifyRequest, headers);
            const stripped = stripHeaders(headers);
            stripped['x-gateway-secret'] = config.secrets.gatewaySecret;
            return stripped;
        },
        timeout: config.services.timeouts.book,
    },
} satisfies FastifyHttpProxyOptions;
