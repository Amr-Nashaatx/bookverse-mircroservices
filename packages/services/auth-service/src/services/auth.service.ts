import { authRepository } from '../repositories/auth.repository.js';
import { NotFoundError, ValidationError } from '@bookverse/shared';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

type AuthResponse = {
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
    };
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
};

type RefreshResponse = {
    tokens: {
        refreshToken: string;
        accessToken: string;
    };
};
type SignupInput = { name: string; email: string; password: string };
type LoginInput = { email: string; password: string };

export const authService = {
    async signup(data: SignupInput) {
        const isEmailExists = await authRepository.findUserByEmail(data.email);
        if (isEmailExists) throw new ValidationError('email already exists');

        const hashedPassword = await bcrypt.hash(data.password, 10);

        const refreshToken = crypto.randomUUID();
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

        const user = await authRepository.createUser({
            email: data.email,
            name: data.name,
            password: hashedPassword,
            role: 'USER',
        });

        const accessToken = jwt.sign(
            { email: data.email, userId: user.id, role: user.role },
            process.env.ACCESS_TOKEN_JWT_SECRET!,
            {
                expiresIn: '15m',
            },
        );

        await authRepository.createSession({
            user: { connect: { id: user.id } },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            refreshTokenHash,
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            tokens: {
                accessToken,
                refreshToken,
            },
        } satisfies AuthResponse;
    },

    async login(data: LoginInput) {
        const user = await authRepository.findUserByEmail(data.email);
        if (!user) throw new ValidationError('something is wrong with email or password');

        const isValidPassword = await bcrypt.compare(data.password, user.password);
        if (!isValidPassword) throw new ValidationError('something is wrong with email or password');

        const refreshToken = crypto.randomUUID();
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

        const accessToken = jwt.sign(
            { email: data.email, userId: user.id, role: user.role },
            process.env.ACCESS_TOKEN_JWT_SECRET!,
            {
                expiresIn: '15m',
            },
        );

        await authRepository.createSession({
            user: { connect: { id: user.id } },
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            refreshTokenHash,
        });

        return {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
            tokens: {
                accessToken,
                refreshToken,
            },
        } satisfies AuthResponse;
    },

    async logout(sessionId: string) {
        const session = await authRepository.findSessionById(sessionId);
        if (!session) throw new ValidationError('invalid session');

        await authRepository.deleteSession(session.id);
    },

    async refresh(sessionId: string, refreshToken: string) {
        const session = await authRepository.findSessionById(sessionId);
        if (!session) throw new NotFoundError('session id is invalid');

        const isValidSession = !session.revokedAt && session.expiresAt.getTime() > Date.now();
        if (!isValidSession) throw new ValidationError('session expired');

        const user = await authRepository.findUserById(session.userId);
        if (!user) throw new ValidationError('invalid session');

        const isValidRefreshToken = await bcrypt.compare(refreshToken, session.refreshTokenHash);
        if (!isValidRefreshToken) {
            await authRepository.deleteAllUserSessions(session.userId);
            throw new ValidationError('token is invalid, all sessions deleted');
        }

        const accessToken = jwt.sign(
            { email: user.email, userId: user.id, role: user.role },
            process.env.ACCESS_TOKEN_JWT_SECRET!,
            {
                expiresIn: '15m',
            },
        );

        const newRefreshToken = crypto.randomUUID();
        const refreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

        await authRepository.updateSession(sessionId, { refreshTokenHash });
        return { tokens: { refreshToken: newRefreshToken, accessToken } } satisfies RefreshResponse;
    },
};
