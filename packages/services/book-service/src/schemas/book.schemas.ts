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

/*
 * The orderings the catalogue offers, as things a reader would recognise rather
 * than column names. Each maps to exactly one index — see buildOrderBy and
 * schema.prisma.
 *
 * Not offered, deliberately: every ascending twin ("oldest", "worst-rated"),
 * and `createdAt` — that is when the row was inserted, an internal fact, while
 * `publishedAt` is what "new" means to a reader. Two fields competing to mean
 * "recent" is a bug waiting to happen. "z-a" is nearly free if ever wanted: it
 * is the a-z index read backwards.
 */
export const BookSortValues = ['newest', 'top-rated', 'a-z'] as const;

/* Both optional — bare GET /books is the browse page.
 * `genre` repeats: ?genre=a&genre=b. Commas do not split.
 * No `status`: public endpoint, published only, hard-wired in the repository. */
export const bookFilterProps = {
    genre: Type.Optional(Type.Array(Type.String())),
    q: Type.Optional(Type.String()),
};

export const ListBooksQuerySchema = Type.Object({
    ...pageQueryProps({ sortValues: BookSortValues, defaultSort: 'newest', defaultLimit: 10, maxLimit: 50 }),
    ...bookFilterProps,
});
export type ListBooksQuery = Static<typeof ListBooksQuerySchema>;

/* pageSchema from shared, so this envelope matches review-service's. */
export const BookPageResponseSchema = Type.Object({
    timestamp: Type.String({ format: 'date-time' }),
    message: Type.String(),
    data: Type.Optional(pageSchema(BookSchema)),
});
