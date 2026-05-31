import { AuthResponse, authService } from '../services/auth.service.js';
import { AuthResponseSchema, LoginSchema, RefreshResponseSchema, SignupSchema } from '../schemas/auth.schemas.js';
import { ApiResponse, UnauthorizedError, ValidationError } from '@bookverse/shared';
import { config } from '../config/index.js';
import { FastifyTypeboxInstance } from '../types/fastify.js';

export async function authRoutes(fastify: FastifyTypeboxInstance) {
    /*
        Input: name, email, password (body)
        call signup service function
        Output: refreshToken, sessionId (cookies). user data, accessToken (body)
     */
    fastify.post(
        '/signup',
        { schema: { body: SignupSchema, response: { 201: AuthResponseSchema } } },
        async (request, reply) => {
            const { email, name, password } = request.body;

            const authResponse = await authService.signup({ email, name, password });
            reply
                .setCookie('refreshToken', authResponse.tokens.refreshToken, config.cookie.options)
                .setCookie('sessionId', authResponse.session.id, config.cookie.options)
                .status(201)
                .send(new ApiResponse<AuthResponse>('user registered', authResponse));
        },
    );
    /*
        Input: email, password (body)
        call login service function
        Output: refreshToken, sessionId (cookies). user data, accessToken (body)
    */
    fastify.post(
        '/login',
        { schema: { body: LoginSchema, response: { 200: AuthResponseSchema } } },
        async (request, reply) => {
            const { email, password } = request.body;

            const authResponse = await authService.login({ email, password });
            reply
                .setCookie('refreshToken', authResponse.tokens.refreshToken, config.cookie.options)
                .setCookie('sessionId', authResponse.session.id, config.cookie.options)
                .send(new ApiResponse<AuthResponse>('user logged in', authResponse));
        },
    );
    /* 
        Input: sessionId (cookie)
        call logout service function
        clear all auth cookies
    */
    fastify.post('/logout', async (request, reply) => {
        const sessionId = request.cookies.sessionId;
        if (!sessionId) throw new UnauthorizedError('no active session');

        await authService.logout(sessionId);
        reply.clearCookie('refreshToken').clearCookie('sessionId').status(204).send();
    });
    /* 
        Input: sessionId (cookie), refreshToken(cookie)
        call refresh service function 
        Output: refreshToken (cookie), accessToken (body)
    */
    fastify.post('/refresh', { schema: { response: { 200: RefreshResponseSchema } } }, async (request, reply) => {
        const sessionId = request.cookies.sessionId;
        if (!sessionId) throw new UnauthorizedError('no active session');

        const refreshToken = request.cookies.refreshToken;
        if (!refreshToken) throw new ValidationError('refresh token required');

        const { tokens } = await authService.refresh(sessionId, refreshToken);
        reply
            .setCookie('refreshToken', tokens.refreshToken, config.cookie.options)
            .send(new ApiResponse('token refreshed', { tokens: { accessToken: tokens.accessToken } }));
    });
}
