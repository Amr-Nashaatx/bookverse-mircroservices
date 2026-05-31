import type { StringValue } from 'ms';
import dotenv from 'dotenv';

dotenv.config();
const requiredEnvVars = ['DATABASE_URL', 'ACCESS_TOKEN_JWT_SECRET'] as const;

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}
export const config = {
    port: Number(process.env.PORT) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    db: {
        url: process.env.DATABASE_URL!,
    },
    jwt: {
        secret: process.env.ACCESS_TOKEN_JWT_SECRET!,
        expiresIn: (process.env.ACCESS_TOKEN_EXPIRES_IN as StringValue) || '15m',
    },
    session: {
        expiresIn: Number(process.env.REFRESH_TOKEN_EXPIRES_IN) || 7 * 24 * 60 * 60 * 1000,
    },
    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    },
    cookie: {
        secret: process.env.COOKIE_SIGN_SECRET! || 'secret',
        options: { httpOnly: true, sameSite: 'strict', secure: process.env.nodeEnv === 'production', path: '/' },
    },
} as const;
