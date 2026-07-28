import { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../errors/index.js';

declare module 'fastify' {
    interface FastifyRequest {
        user?: { id: string; email: string; role: string };
    }
}

export async function authenticateUser(req: FastifyRequest, _reply: FastifyReply) {
    const id = req.headers['x-user-id'] as string;
    const role = req.headers['x-user-role'] as string;
    const email = req.headers['x-user-email'] as string;

    if (!id || !role || !email) throw new UnauthorizedError();
    req.user = { id, role, email };
}
