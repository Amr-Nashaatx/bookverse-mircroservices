import { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError, ValidationError } from '@bookverse/shared';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export const verifyJwt = async (request: FastifyRequest, _reply: FastifyReply) => {
    // fetch access token from headers
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new UnauthorizedError('Authentication required');

    const accessToken = authHeader.split(' ')[1];

    // verify the access token
    try {
        const payload = jwt.verify(accessToken, config.jwt.secret);
        if (typeof payload === 'string') throw new UnauthorizedError('Invalid token');

        /* Decorate the request with user identity */
        request.user = { id: payload.userId, role: payload.role, email: payload.email };
    } catch (error) {
        throw new UnauthorizedError('Invalid or expired token');
    }
};
