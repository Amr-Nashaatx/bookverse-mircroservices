import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = ['ACCESS_TOKEN_JWT_SECRET'] as const;

for (let envVar of requiredEnvVars) {
    if (!process.env[envVar]) throw new Error(`Missing required environment variable in gateway: ${envVar}`);
}

export const config = {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    jwt: {
        secret: process.env.ACCESS_TOKEN_JWT_SECRET!,
    },
    services: {
        auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001/auth',
    },
};
