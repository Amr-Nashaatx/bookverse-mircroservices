import { Type, Static } from '@sinclair/typebox';

// Request Params Schemas
export const ReviewParamsSchema = Type.Object({
    id: Type.String({ format: 'uuid' }),
});

export const ListReviewsQuerySchema = Type.Object({
    bookId: Type.String({ format: 'uuid' }),
});

// Request Schemas
export const CreateReviewSchema = Type.Object({
    bookId: Type.String({ format: 'uuid' }),
    rating: Type.Integer({ minimum: 1, maximum: 5 }),
    comment: Type.Optional(Type.String({ minLength: 1, maxLength: 4000 })),
});

export const UpdateReviewSchema = Type.Object({
    rating: Type.Optional(Type.Integer({ minimum: 1, maximum: 5 })),
    comment: Type.Optional(Type.String({ minLength: 1, maxLength: 4000 })),
});

// Response Schemas
export const ReviewSchema = Type.Object({
    id: Type.String({ format: 'uuid' }),
    bookId: Type.String({ format: 'uuid' }),
    userId: Type.String(),
    rating: Type.Integer(),
    comment: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
});

// `data` is Optional to mirror the shared ApiResponse contract (`data?: T`).
export const ReviewResponseSchema = Type.Object({
    timestamp: Type.String({ format: 'date-time' }),
    message: Type.String(),
    data: Type.Optional(ReviewSchema),
});

export const ReviewListResponseSchema = Type.Object({
    timestamp: Type.String({ format: 'date-time' }),
    message: Type.String(),
    data: Type.Optional(Type.Array(ReviewSchema)),
});

// Inferred types
export type CreateReviewInput = Static<typeof CreateReviewSchema>;
export type UpdateReviewInput = Static<typeof UpdateReviewSchema>;
export type ReviewData = Static<typeof ReviewSchema>;
