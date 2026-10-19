import { ReviewPostedPayload } from '@bookverse/shared';
import { config } from '../../config/index.js';
import { HttpError } from '../../lib/transientErrors.js';
import type { NotificationBuilder } from '../types.js';

type Book = { title: string; ownerUserId: string };

// Longer than the gateway's own 1 s hop to book-service, so a slow book-service
// arrives here as the gateway's 504 rather than as our timeout.
const BOOK_LOOKUP_TIMEOUT_MS = 2_000;

/* The owner and the title belong to book-service: asked for when the event
 * arrives, through the gateway's public read. */
async function fetchBook(bookId: string): Promise<Book> {
    const res = await fetch(`${config.gateway.url}/books/${bookId}`, {
        signal: AbortSignal.timeout(BOOK_LOOKUP_TIMEOUT_MS),
    });
    if (!res.ok) throw new HttpError(res.status);
    return (await res.json()).data as Book;
}

/* "review.posted" → tell the book's owner. */
export const reviewPosted: NotificationBuilder = async (payload) => {
    const event = payload as ReviewPostedPayload;
    const book = await fetchBook(event.bookId);
    if (event.reviewerId === book.ownerUserId) return null;

    return {
        userId: book.ownerUserId,
        message: `A reader gave "${book.title}" ${event.rating} ${event.rating === 1 ? 'star' : 'stars'}.`,
        data: { bookId: event.bookId, reviewId: event.reviewId, rating: event.rating },
    };
};
