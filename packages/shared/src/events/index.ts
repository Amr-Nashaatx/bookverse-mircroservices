export * from './exchange.js';

export const ReviewEvents = {
    REVIEW_CREATED: 'review.created',
    REVIEW_UPDATED: 'review.updated',
    REVIEW_DELETED: 'review.deleted',
    REVIEW_POSTED: 'review.posted',
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

export type ReviewPostedPayload = {
    reviewId: string;
    bookId: string;
    reviewerId: string;
    rating: number;
    postedAt: string;
};
