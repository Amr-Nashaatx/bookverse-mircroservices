import { pageQueryProps, pageSchema } from '@bookverse/shared';
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
    ownerUserId: Type.String(),
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

export const BookSortFields = ['title', 'publishedAt', 'createdAt'] as const;

/*
 * Both optional: absent means "do not filter on this", and GET /books with no
 * query string is the main browse page.
 *
 * `genre` repeats -- ?genre=fantasy&genre=scifi. A single value coerces to a
 * one-element array. Commas do NOT split: ?genre=a,b arrives as one element.
 *
 * No `status` on purpose: this endpoint is public and serves the published
 * catalogue only. The filter is hard-wired in book.repository.ts.
 */
export const bookFilterProps = {
    genre: Type.Optional(Type.Array(Type.String())),
    q: Type.Optional(Type.String()),
};

export const ListBooksQuerySchema = Type.Object({
    ...pageQueryProps({ sortFields: BookSortFields, defaultSort: 'publishedAt', defaultLimit: 10, maxLimit: 50 }),
    ...bookFilterProps,
});
export type ListBooksQuery = Static<typeof ListBooksQuerySchema>;

/* `pageSchema` comes from shared so this envelope stays identical to the one
 * review-service will answer with. */
export const BookPageResponseSchema = Type.Object({
    timestamp: Type.String({ format: 'date-time' }),
    message: Type.String(),
    data: Type.Optional(pageSchema(BookSchema)),
});
