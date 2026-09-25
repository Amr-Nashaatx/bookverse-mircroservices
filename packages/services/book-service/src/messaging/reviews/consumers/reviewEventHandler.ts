import { ReviewsUpdatedPayload } from '@bookverse/shared';
import { bookService } from '../../../services/book.service.js';

export async function reviewEventsHandler(_routingKey: string, payload: unknown) {
    const { avgRating, bookId, count } = payload as ReviewsUpdatedPayload;
    await bookService.applyRatingCopy(bookId, avgRating, count);
}
