import { authRepository } from '../repositories/auth.repository.js';
import { NotFoundError, ValidationError } from '@bookverse/shared';
import { config } from '../config/index.js';
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
        //  check email existence
        const isEmailExists = await authRepository.findUserByEmail(data.email);
        if (isEmailExists) throw new ValidationError('email already exists');

        //  hash the password, and create the user in db
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const user = await authRepository.createUser({
            email: data.email,
            name: data.name,
            password: hashedPassword,
            role: 'USER',
        });

        /*
            create refresh token and hash it
            sign the acess token with values returned from db
         */
        const refreshToken = crypto.randomUUID();
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        const accessToken = jwt.sign({ email: data.email, userId: user.id, role: user.role }, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn,
        });

        /*
            create session for user with hashed refresh token
        */
        await authRepository.createSession({
            user: { connect: { id: user.id } },
            expiresAt: new Date(config.session.expiresIn),
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
        /*
            check user email and password
        */
        const user = await authRepository.findUserByEmail(data.email);
        if (!user) throw new ValidationError('something is wrong with email or password');

        const isValidPassword = await bcrypt.compare(data.password, user.password);
        if (!isValidPassword) throw new ValidationError('something is wrong with email or password');

        /*
            create refresh token, hash it and sign access token
        */
        const refreshToken = crypto.randomUUID();
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

        const accessToken = jwt.sign({ email: data.email, userId: user.id, role: user.role }, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn,
        });

        /*
            create session with hashed refresh token
        */
        await authRepository.createSession({
            user: { connect: { id: user.id } },
            expiresAt: new Date(config.session.expiresIn),
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
        /*
            check session existence and validate it
        */
        const session = await authRepository.findSessionById(sessionId);
        if (!session) throw new NotFoundError('session id is invalid');

        const isValidSession = !session.revokedAt && session.expiresAt.getTime() > Date.now();
        if (!isValidSession) throw new ValidationError('session expired');

        /*
            fetch the owner of the session
        */
        const user = await authRepository.findUserById(session.userId);
        if (!user) throw new ValidationError('invalid session');

        /*
            validate refresh token, if it's different then it has been stolen and rotated.
            so all sessions must be deleted 
        */
        const isValidRefreshToken = await bcrypt.compare(refreshToken, session.refreshTokenHash);
        if (!isValidRefreshToken) {
            await authRepository.deleteAllUserSessions(session.userId);
            throw new ValidationError('token is invalid, all sessions deleted');
        }

        /*
            sign new access token, rotate the refresh and update this session 
        */
        const accessToken = jwt.sign({ email: user.email, userId: user.id, role: user.role }, config.jwt.secret, {
            expiresIn: config.jwt.expiresIn,
        });

        const newRefreshToken = crypto.randomUUID();
        const refreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

        await authRepository.updateSession(sessionId, { refreshTokenHash });
        return { tokens: { refreshToken: newRefreshToken, accessToken } } satisfies RefreshResponse;
    },
};
