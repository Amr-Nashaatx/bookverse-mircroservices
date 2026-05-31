import { Type, Static } from '@sinclair/typebox';
//  Request Schemas
export const SignupSchema = Type.Object({
    name: Type.String({ minLength: 3 }),
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 8 }),
});

export const LoginSchema = Type.Object({
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 8 }),
});

// Response Schemas
export const AuthResponseSchema = Type.Object({
    timestamp: Type.String({ format: 'date-time' }),
    message: Type.String(),
    data: Type.Object({
        user: Type.Object({
            id: Type.String({ format: 'uuid' }),
            email: Type.String({ format: 'email' }),
            name: Type.String(),
            role: Type.String(),
        }),
        tokens: Type.Object({
            accessToken: Type.String(),
        }),
    }),
});

export const RefreshResponseSchema = Type.Object({
    timestamp: Type.String({ format: 'date-time' }),
    message: Type.String(),
    data: Type.Object({
        tokens: Type.Object({
            accessToken: Type.String(),
        }),
    }),
});

// Infered types
export type SignupInput = Static<typeof SignupSchema>;
export type LoginInput = Static<typeof LoginSchema>;
export type AuthResponseData = Static<typeof AuthResponseSchema>;
export type RefreshResponseData = Static<typeof RefreshResponseSchema>;
