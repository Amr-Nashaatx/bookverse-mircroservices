import type { StringValue } from 'ms';
import dotenv from 'dotenv';

dotenv.config();
const requiredEnvVars = ['AUTH_SERVICE_DATABASE_URL', 'ACCESS_TOKEN_JWT_SECRET', 'GATEWAY_ACCEPTED_SECRETS'] as const;

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}
export const config = {
    port: Number(process.env.PORT) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    // Backstop, not the main control -- the gateway caps itself at 4 to us.
    // Kept above that so it stays reachable for callers the cap can't cover.
    // See docs/decisions/load-shedding.md.
    maxInFlightRequests: 8,
    db: {
        url: process.env.AUTH_SERVICE_DATABASE_URL!,
    },
    jwt: {
        secret: process.env.ACCESS_TOKEN_JWT_SECRET!,
        expiresIn: (process.env.ACCESS_TOKEN_EXPIRES_IN as StringValue) || '15m',
    },
    session: {
        expiresIn: Number(process.env.REFRESH_TOKEN_EXPIRES_IN) || 7 * 24 * 60 * 60 * 1000,
    },
    rabbitmq: {
        url:
            process.env.RABBITMQ_URL ||
            (process.env.RABBITMQ_DEFAULT_USER && process.env.RABBITMQ_DEFAULT_PASS
                ? `amqp://${process.env.RABBITMQ_DEFAULT_USER}:${process.env.RABBITMQ_DEFAULT_PASS}@rabbitmq:5672`
                : 'amqp://localhost:5672'),
    },
    cookie: {
        secret: process.env.COOKIE_SIGN_SECRET! || 'secret',
        options: { httpOnly: true, sameSite: 'strict', secure: process.env.nodeEnv === 'production', path: '/' },
    },
    gateway: {
        secrets: process.env
            .GATEWAY_ACCEPTED_SECRETS!.split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    },
} as const;
