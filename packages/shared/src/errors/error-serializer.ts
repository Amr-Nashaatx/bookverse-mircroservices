import { FastifyError } from 'fastify';
import { AppError, SerializedError } from './index.js';

/*
 * Maps an unknown thrown value onto an HTTP status + message.
 *
 * `details` here is CLIENT-ACTIONABLE data only — never stacks or internals.
 * Debug context reaches us through the logger, which sees the raw error.
 * Ordering matters: each branch is narrower than the one below it, and the
 * final branches are the honest "we don't know what this is" floor.
 */
export function serializeError(error: unknown): SerializedError {
    // Our own errors: they already carry a deliberate status and a public message.
    if (error instanceof AppError) {
        return {
            statusCode: toHttpStatus(error.statusCode),
            message: error.message,
            isOperational: error.isOperational,
        };
    }

    // Schema validation: the one case where details belong in the response,
    // because the client can fix its request with them.
    if (isValidationError(error)) {
        return {
            statusCode: 400,
            message: 'Request validation failed',
            details: error.validation,
            isOperational: true,
        };
    }

    /*
     * Anything carrying an HTTP status: Fastify's own errors, @fastify/error
     * classes, http-errors objects. Crucially this includes @fastify/reply-from's
     * GatewayTimeoutError (504) / ServiceUnavailableError (503) / BadGatewayError
     * (502) — the codes that tell a caller whether a retry is safe. Flattening
     * these to 500 destroys the only signal a retry policy has.
     */
    if (hasHttpStatus(error)) {
        const statusCode = toHttpStatus(error.statusCode);
        return {
            statusCode,
            message: error.message,
            isOperational: isAnticipated(statusCode),
        };
    }

    // Unrecognized Error: no status to preserve, so 500 is the true answer,
    // not a fallback. Error families deserving a specific status get a branch above.
    if (error instanceof Error) {
        return {
            statusCode: 500,
            message: error.message,
            isOperational: false,
        };
    }

    // Someone threw a non-Error. The raw value goes to the log, not the response.
    return {
        statusCode: 500,
        message: 'Something went wrong',
        isOperational: false,
    };
}

/*
 * "Did we anticipate this?" — drives whether the message is safe to expose.
 * 4xx is the caller's problem and always safe to explain. 502/503/504 describe a
 * dependency failing, which is an expected condition in a distributed system
 * rather than a defect in us. Everything else is treated as our bug until proven
 * otherwise, so its message stays hidden in production.
 */
function isAnticipated(statusCode: number): boolean {
    if (statusCode >= 400 && statusCode < 500) return true;
    return statusCode === 502 || statusCode === 503 || statusCode === 504;
}

/*
 * `reply.status()` throws on a non-integer or out-of-range code, and throwing
 * inside the error handler is the one failure we cannot handle. Never trust a
 * status we did not author.
 */
function toHttpStatus(value: unknown): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 599 ? value : 500;
}

function isValidationError(error: unknown): error is FastifyError & { validation: unknown } {
    return typeof error === 'object' && error !== null && 'code' in error && 'validation' in error;
}

/*
 * Deliberately structural, not `instanceof FastifyError`: undici, http-errors
 * and @fastify/error all produce status-bearing errors from different classes.
 * We care about the shape, not the constructor.
 */
function hasHttpStatus(error: unknown): error is FastifyError {
    return typeof error === 'object' && error !== null && 'statusCode' in error && 'code' in error;
}
