import { config } from '../config/index.js';
import { stripHeaders } from '../utils/requestHeadersUtils.js';
import { FastifyHttpProxyOptions } from '@fastify/http-proxy';

export const authServiceProxy = {
    upstream: config.services.auth,
    prefix: '/auth',
    replyOptions: {
        rewriteRequestHeaders: (_request, headers) => {
            let strippedHeaders = stripHeaders(headers);

            strippedHeaders['x-gateway-secret'] = config.secrets.gatewaySecret;
            return strippedHeaders;
        },
        timeout: config.services.timeouts.auth,
    },
} satisfies FastifyHttpProxyOptions;
