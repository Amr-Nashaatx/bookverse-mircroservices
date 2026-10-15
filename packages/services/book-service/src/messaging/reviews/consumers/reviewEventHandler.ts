import { ReviewsUpdatedPayload } from '@bookverse/shared';
import { bookService } from '../../../services/book.service.js';

export async function reviewEventsHandler(_routingKey: string, payload: unknown) {
    await bookService.applyRatingCopyIfNewer(payload as ReviewsUpdatedPayload);
}
