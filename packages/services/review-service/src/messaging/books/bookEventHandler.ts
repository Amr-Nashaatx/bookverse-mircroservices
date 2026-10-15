import { BookStatusChangePayload } from '@bookverse/shared';
import { reviewService } from '../../services/review.service.js';

export async function bookStatusEventsHandler(_routingKey: string, payload: unknown) {
    await reviewService.applyStatusChange(payload as BookStatusChangePayload);
}
