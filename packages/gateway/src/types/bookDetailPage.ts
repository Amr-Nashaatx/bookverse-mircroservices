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

/*
 * review-service answers lists in the shared page envelope. This is the
 * gateway's own copy of that shape -- see the note in bookDetailsHelpers.ts
 * about why nothing keeps it in sync.
 */
export type ReviewPage = {
    items: BookReview[];
    hasMore: boolean;
    total: number;
};

export function isAppError(err: unknown): err is AppError {
    if (err instanceof AppError && err.statusCode) {
        return true;
    }
    return false;
}

export type BookPageResponse = {
    book: BookDetails | undefined;
    /*
     * `hasMore` and `total` travel with the items so the page can offer "load
     * more" without a second call to find out whether there is more. `total` is
     * a lower bound unless hasMore is false.
     */
    reviews: { status: 'ok'; items: BookReview[]; hasMore: boolean; total: number } | { status: 'unavailable' };
};
export type SuccessFetchResult = Extract<FetchResult, { ok: true }>;
export type FailedFetchResult = Extract<FetchResult, { ok: false }>;
