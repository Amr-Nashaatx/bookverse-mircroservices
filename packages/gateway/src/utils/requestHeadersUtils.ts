import { config } from '../config/index.js';
import { FastifyRequest } from 'fastify';

export function stripHeaders(headers: Record<string, any>) {
    if (headers['x-user-id']) delete headers['x-user-id'];
    if (headers['x-user-role']) delete headers['x-user-role'];
    if (headers['x-user-email']) delete headers['x-user-email'];
    if (headers['x-gateway-secret']) delete headers['x-gateway-secret'];

    const { expect, ...rest } = headers;
    return rest;
}

export function withUserAndSecret(request: FastifyRequest, headers: Record<string, any>) {
    const strippedHeaders = stripHeaders(headers);

    strippedHeaders['x-user-id'] = request.user!.id;
    strippedHeaders['x-user-role'] = request.user!.role;
    strippedHeaders['x-user-email'] = request.user?.email;
    strippedHeaders['x-gateway-secret'] = config.secrets.gatewaySecret;

    return strippedHeaders;
}
