import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = ['ACCESS_TOKEN_JWT_SECRET', 'GATEWAY_SECRET'] as const;

for (let envVar of requiredEnvVars) {
    if (!process.env[envVar]) throw new Error(`Missing required environment variable in gateway: ${envVar}`);
}

export const config = {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    jwt: {
        secret: process.env.ACCESS_TOKEN_JWT_SECRET!,
    },
    secrets: {
        gatewaySecret: process.env.GATEWAY_SECRET!,
    },
    services: {
        auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001/auth',
        book: process.env.BOOK_SERVICE_URL || 'http://localhost:3002/books',
        review: process.env.REVIEW_SERVICE_URL || 'http://localhost:3003/reviews',
        timeouts: {
            auth: 2000,
            book: 1000,
            // Starting point copied from book's hop. Re-measure with
            // scripts/sweep.mjs once the service does real work.
            review: 1000,
        },
    },
};
