import { NOTIFICATIONS_DLX, QueueConfig, REVIEWS_EXCHANGE } from '@bookverse/shared';
import { Queues } from '../messaging/index.js';
import { reviewPostedHandler } from '../messaging/reviews/reviewPostedHandler.js';
import { isTransientDbError, isTransientFetchError } from '../lib/transientErrors.js';

export const ReviewPostedQueue = {
    exchange: REVIEWS_EXCHANGE,
    patterns: ['review.posted'],
    queue: Queues.NOTIFICATIONS_REVIEWS,
    dlx: NOTIFICATIONS_DLX,
    handler: reviewPostedHandler,
    isTransient: (err) => {
        if (isTransientDbError(err) || isTransientFetchError(err)) return true;
        return false;
    },
} satisfies QueueConfig;

export const ReviewDLQ = {
    exchange: NOTIFICATIONS_DLX,
    patterns: ['#'],
    queue: Queues.NOTIFICATIONS_REVIEWS_DLQ,
} satisfies QueueConfig;
