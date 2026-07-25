import { FastifyError } from 'fastify';
import { AppError, SerializedError } from './index.js';

export function serializeError(error: unknown): SerializedError {
    // AppError
    if (error instanceof AppError) {
        return {
            statusCode: error.statusCode,
            message: error.message,
            details: error.stack,
            isOperational: error.isOperational,
        };
    }

    // Fastify validation errors
    if (isFastifyError(error)) {
        const fastifyError = error as FastifyError & {
            validation?: unknown;
        };
        return {
            statusCode: 400,
            message: 'Request validation failed',
            details: fastifyError.validation,
            isOperational: true,
        };
    }

    // Native Error
    if (error instanceof Error) {
        return {
            statusCode: 500,
            message: error.message,
            details: error.stack,
            isOperational: false,
        };
    }

    // Completely unknown values
    return {
        statusCode: 500,
        message: 'Something went wrong',
        details: error,
        isOperational: false,
    };
}

function isFastifyError(error: unknown): error is FastifyError {
    return (
        typeof error === 'object' && error !== null && 'statusCode' in error && 'code' in error && 'validation' in error
    );
}
