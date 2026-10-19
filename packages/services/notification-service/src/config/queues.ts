import { NOTIFICATIONS_DLX, QueueConfig, REVIEWS_EXCHANGE, ReviewEvents } from '@bookverse/shared';
import { Queues } from '../messaging/index.js';
import { notifyFromEvent } from '../messaging/notifyFromEvent.js';
import { isTransientDbError, isTransientFetchError } from '../lib/transientErrors.js';

/* One queue per source exchange, all with the same handler. A key bound here
 * needs a builder in notifyFromEvent, or its messages dead-letter. */
export const ReviewsQueue = {
    exchange: REVIEWS_EXCHANGE,
    patterns: [ReviewEvents.REVIEW_POSTED],
    queue: Queues.NOTIFICATIONS_REVIEWS,
    dlx: NOTIFICATIONS_DLX,
    handler: notifyFromEvent,
    // Two things can be down: our database, and the gateway or book-service behind it.
    isTransient: (err) => isTransientDbError(err) || isTransientFetchError(err),
    // Copied from the other consumers, where it was sized from a measured Postgres restart.
    // Not measured for the HTTP lookup this queue also waits on.
    retryBudgetMs: 8000,
} satisfies QueueConfig;

// No handler: nothing consumes the DLQ. It holds messages for a human to read or replay.
export const NotificationsDlq = {
    exchange: NOTIFICATIONS_DLX,
    patterns: ['#'],
    queue: Queues.NOTIFICATIONS_DLQ,
} satisfies QueueConfig;
