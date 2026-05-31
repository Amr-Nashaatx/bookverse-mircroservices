import { FastifyReply, FastifyRequest } from 'fastify';
import { serializeError } from './error-serializer.js';

export async function globalErrorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply) {
    const serialized = serializeError(error);

    request.log.error({ err: error, serialized });

    const isProduction = process.env.NODE_ENV === 'production';
    const hideDetails = isProduction && !serialized.isOperational;

    return reply.status(serialized.statusCode).send({
        error: {
            message: hideDetails ? 'Internal server error' : serialized.message,
            ...(!hideDetails && { details: serialized.details }),
        },
    });
}
