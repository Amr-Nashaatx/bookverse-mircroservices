import { FastifyReply, FastifyRequest } from 'fastify';
import { serializeError } from './error-serializer.js';

export async function globalErrorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply) {
    const serialized = serializeError(error);

    // The log gets everything, always — pino's `err` serializer emits the stack,
    // type and message. This is why the response never needs to carry a stack.
    request.log.error({ err: error, statusCode: serialized.statusCode }, serialized.message);

    /*
     * Opt IN to verbosity rather than out of it. `NODE_ENV === 'production'`
     * would mean an unset or misspelled variable silently exposes internals —
     * a security property resting on a string being spelled right. Failing
     * closed makes the unsafe state unreachable by accident.
     */
    const exposeInternals = process.env.NODE_ENV === 'development';

    return reply.status(serialized.statusCode).send({
        error: {
            // An unanticipated error's message can carry internals (driver output,
            // file paths), so it is replaced unless we are explicitly in dev.
            message: !exposeInternals && !serialized.isOperational ? 'Internal server error' : serialized.message,
            // Client-actionable data only (e.g. which fields failed validation).
            ...(serialized.details !== undefined && { details: serialized.details }),
            // Dev-only convenience: split so it stays readable in a JSON response.
            ...(exposeInternals && error instanceof Error && error.stack
                ? { stack: error.stack.split('\n').map((line) => line.trim()) }
                : {}),
        },
    });
}
