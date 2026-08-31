import dotenv from 'dotenv';

dotenv.config();
const requiredEnvVars = ['REVIEW_SERVICE_DATABASE_URL', 'GATEWAY_ACCEPTED_SECRETS'] as const;

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

export const config = {
    port: Number(process.env.PORT) || 3003,
    nodeEnv: process.env.NODE_ENV || 'development',
    db: {
        url: process.env.REVIEW_SERVICE_DATABASE_URL!,
    },
    rabbitmq: {
        url:
            process.env.RABBITMQ_URL ||
            (process.env.RABBITMQ_DEFAULT_USER && process.env.RABBITMQ_DEFAULT_PASS
                ? `amqp://${process.env.RABBITMQ_DEFAULT_USER}:${process.env.RABBITMQ_DEFAULT_PASS}@rabbitmq:5672`
                : 'amqp://localhost:5672'),
    },
    gateway: {
        secrets: process.env
            .GATEWAY_ACCEPTED_SECRETS!.split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    },
    /*
     * book-service is a SOFT dependency: a review is written on trust, and a
     * bookId that points at nothing is accepted. Availability of POST /reviews
     * is therefore its own, not the product of two services.
     *
     * `verifyBookExists` turns it into a HARD one. It exists so Build 3 can
     * measure what that costs by flipping one env var rather than rewriting
     * code -- see docs/decisions/boundaries/review-service.md. Everything the
     * hard path needs is confined to assertBookExists() in review.service.ts,
     * so deleting the feature is that function plus this block.
     */
    bookService: {
        url: process.env.BOOK_SERVICE_URL || 'http://book-service:3002/books',
        verifyBookExists: process.env.REVIEW_VERIFY_BOOK_EXISTS === 'true',
        // Bounded like any other hop (Lesson 03). Matches the gateway's book hop.
        timeoutMs: 1000,
        // book-service only accepts callers that present a known secret. The
        // name says "gateway" but the check is really "is this an internal
        // caller" -- worth renaming when a second service needs one.
        callerSecret: process.env.GATEWAY_SECRET ?? '',
    },
} as const;
