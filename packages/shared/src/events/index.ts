export * from './exchange.js';

export const ReviewEvents = {
    REVIEW_CREATED: 'review.created',
    REVIEW_UPDATED: 'review.updated',
    REVIEW_DELETED: 'review.deleted',
} as const;

export const BookEvents = {
    STATUS_UPDATED: 'book.status-updated',
} as const;

export type ReviewsUpdatedPayload = {
    bookId: string;
    avgRating: number | null;
    count: number;
    version: number;
};

export type BookStatusChangePayload = {
    bookId: string;
    status: string;
    version: number;
};
