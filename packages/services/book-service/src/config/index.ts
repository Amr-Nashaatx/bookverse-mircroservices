import dotenv from 'dotenv';

dotenv.config();
const requiredEnvVars = ['BOOK_SERVICE_DATABASE_URL', 'GATEWAY_ACCEPTED_SECRETS'] as const;

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

export const config = {
    port: Number(process.env.PORT) || 3002,
    nodeEnv: process.env.NODE_ENV || 'development',
    db: {
        url: process.env.BOOK_SERVICE_DATABASE_URL!,
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
} as const;
