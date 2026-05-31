import { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError, ValidationError } from '@bookverse/shared';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export const verifyJwt = async (request: FastifyRequest, reply: FastifyReply) => {
    // fetch access token from headers
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new UnauthorizedError('Authentication required');

    const accessToken = authHeader.split(' ')[1];

    // verify the access token
    try {
        const payload = jwt.verify(accessToken, config.jwt.secret);
        if (typeof payload === 'string') throw new UnauthorizedError('Invalid token');

        /*  set authorization custom headers, so other service know the identity,
            without them needing to verify the token themselves
        */
        (request.headers as Record<string, string>)['x-user-id'] = payload.userId;
        (request.headers as Record<string, string>)['x-user-role'] = payload.role;
        (request.headers as Record<string, string>)['x-user-email'] = payload.email;
    } catch (error) {
        throw new UnauthorizedError('Invalid or expired token');
    }
};
