import { BOOKS_DLX, BOOKS_EXCHANGE, QueueConfig } from '@bookverse/shared';
import { Queues } from '../messaging/index.js';
import { isTransientDbError } from '../lib/transientErrors.js';
import { bookStatusEventsHandler } from '../messaging/books/bookEventHandler.js';

export const BooksQeueue = {
    exchange: BOOKS_EXCHANGE,
    queue: Queues['BOOKS_QUEUE'],
    patterns: ['book.*'],
    dlx: BOOKS_DLX,
    handler: bookStatusEventsHandler,
    isTransient: isTransientDbError,
    retryBudgetMs: 8000,
} satisfies QueueConfig;

export const BooksDlq = {
    exchange: BOOKS_DLX,
    queue: Queues['BOOKS_DLQ'],
    patterns: ['#'],
} satisfies QueueConfig;
