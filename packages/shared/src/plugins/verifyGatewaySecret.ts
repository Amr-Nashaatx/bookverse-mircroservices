import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../errors/index.js';
import crypto from 'crypto';

export const makeVerifyGatewaySecret = (accepted: string[]) => {
    return async (req: FastifyRequest, _reply: FastifyReply) => {
        const incomingSecret = req.headers['x-gateway-secret'] as string;
        if (!incomingSecret) throw new UnauthorizedError('Invalid gateway header');

        const hash = (s: string) => crypto.createHash('sha256').update(s).digest();
        const incomingHash = hash(incomingSecret);
        const ok = accepted.some((secret) => crypto.timingSafeEqual(hash(secret), incomingHash));

        if (!ok) {
            throw new UnauthorizedError();
        }
    };
};
