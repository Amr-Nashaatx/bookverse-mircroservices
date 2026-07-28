export class AppError extends Error {
    constructor(
        public readonly message: string,
        public readonly statusCode: number,
        public readonly isOperational: boolean = true,
    ) {
        super(message);
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 400);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}
export interface SerializedError {
    statusCode: number;
    message: string;
    isOperational: boolean;
    details?: unknown;
}

export * from './error-handler.js';
export * from './error-serializer.js';
