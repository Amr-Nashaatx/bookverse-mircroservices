import { Type, Static } from '@sinclair/typebox';

// Request Params Schemas
export const UpdateBookParamsSchema = Type.Object({
    id: Type.String({ format: 'uuid' }),
});
// Request Schemas
export const CreateBookSchema = Type.Object({
    title: Type.String({ minLength: 1 }),
    description: Type.String({ minLength: 1 }),
    genre: Type.Array(Type.String(), { default: [] }),
    coverImageUrl: Type.Optional(Type.String({ format: 'uri' })),
});

export const UpdateBookSchema = Type.Object({
    title: Type.Optional(Type.String({ minLength: 1 })),
    description: Type.Optional(Type.String({ minLength: 1 })),
    genre: Type.Optional(Type.Array(Type.String(), { default: [] })),
    coverImageUrl: Type.Optional(Type.Optional(Type.String({ format: 'uri' }))),
});
// Response Schemas
export const BookSchema = Type.Object({
    id: Type.String({ format: 'uuid' }),
    title: Type.String(),
    authorId: Type.String(),
    genre: Type.Array(Type.String()),
    description: Type.String(),
    coverImageUrl: Type.Union([Type.String(), Type.Null()]),
    status: Type.String(),
    publishedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
});

// `data` is Optional to mirror the shared ApiResponse contract (`data?: T`).
export const BookResponseSchema = Type.Object({
    timestamp: Type.String({ format: 'date-time' }),
    message: Type.String(),
    data: Type.Optional(BookSchema),
});

export const BookListResponseSchema = Type.Object({
    timestamp: Type.String({ format: 'date-time' }),
    message: Type.String(),
    data: Type.Optional(Type.Array(BookSchema)),
});

// Inferred types
export type CreateBookInput = Static<typeof CreateBookSchema>;
export type UpdateBookInput = Static<typeof UpdateBookSchema>;
export type BookData = Static<typeof BookSchema>;
