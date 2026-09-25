import { QueueConfig, REVIEWS_DLX, REVIEWS_EXCHANGE } from '@bookverse/shared';
import { Queues } from '../messaging/index.js';
import { reviewEventsHandler } from '../messaging/reviews/consumers/reviewEventHandler.js';
import { isTransientDbError } from '../lib/transientErrors.js';

export const ReviewsQueue = {
    exchange: REVIEWS_EXCHANGE,
    queue: Queues['REVIEWS_QUEUE'],
    patterns: ['review.*'],
    dlx: REVIEWS_DLX,
    handler: reviewEventsHandler,
    isTransient: isTransientDbError,
    // Measured 2026-09-25: postgres restart → book-service serving again in ~1.5s (laptop).
    // ~5× that, so one restart never costs a dead letter. Re-measure on real infra.
    retryBudgetMs: 8000,
} satisfies QueueConfig;

// No handler: nothing consumes the DLQ. It holds messages for a human to read or replay.
export const ReviewsDlq = {
    exchange: REVIEWS_DLX,
    queue: Queues['REVIEW_DLQ'],
    patterns: ['#'], // dead-lettered messages keep their original key; catch all of them
} satisfies QueueConfig;
