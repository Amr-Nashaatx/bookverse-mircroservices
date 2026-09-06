import { AppError } from '@bookverse/shared';
import { FetchResult } from '../utils/fetchWithTimeout.js';

export type BookDetails = {
    id: string;
    title: string;
    ownerUserId: string;
    genre: string[];
    description: string;
    coverImageUrl: string | null;
    status: string;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type BookReview = {
    id: string;
    bookId: string;
    userId: string;
    rating: number;
    comment: string;
    createdAt: string;
    updatedAt: string;
};

export function isAppError(err: unknown): err is AppError {
    if (err instanceof AppError && err.statusCode) {
        return true;
    }
    return false;
}

export type BookPageResponse = {
    book: BookDetails | undefined;
    reviews: { status: 'ok'; items: BookReview[] } | { status: 'unavailable' };
};
export type SuccessFetchResult = Extract<FetchResult, { ok: true }>;
export type FailedFetchResult = Extract<FetchResult, { ok: false }>;
