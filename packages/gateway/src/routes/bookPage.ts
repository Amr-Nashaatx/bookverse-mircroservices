import { FastifyTypeboxInstance } from '../types/index.js';
import { FetchResult, fetchWithTimeout, RequestSpec } from '../utils/fetchWithTimeout.js';
import { config } from '../config/index.js';
import { BookPageResponse, FailedFetchResult } from '../types/bookDetailPage.js';
import { ApiResponse, AppError } from '@bookverse/shared';
import { addFetchedData, handleFailure } from '../utils/bookDetailsHelpers.js';
import { BookPageParamsSchema } from '../schemas/bookDetails.js';
import { bookServiceBreaker } from '../breakers/book-breaker.js';
import { reviewServiceBreaker } from '../breakers/review-breaker.js';
import { classifyOutcome } from '../breakers/classifyOutcome.js';

/* How many reviews the book page shows before "load more". */
const REVIEWS_ON_PAGE = 10;

export async function bookPageRoutes(fastify: FastifyTypeboxInstance) {
    fastify.get('/books/:id/page', { schema: { params: BookPageParamsSchema } }, async (request, reply) => {
        const bookId = request.params.id;

        const bookUrl = `${config.services.book}/${bookId}`;
        /*
         * The limit is stated, not inherited. Before reviews were paginated this
         * call fetched every review a book had, so one page view cost whatever
         * the most-reviewed book happened to hold. A number here is a cap on
         * what this page can ask of review-service.
         */
        const reviewUrl = `${config.services.review}?bookId=${bookId}&limit=${REVIEWS_ON_PAGE}`;

        let specs: RequestSpec[] = [
            { id: 'book', url: bookUrl, timeoutMs: 1000, breaker: bookServiceBreaker },
            { id: 'reviews', url: reviewUrl, timeoutMs: 800, breaker: reviewServiceBreaker },
        ];

        const bookBreakerOutcome = bookServiceBreaker.allowRequest();
        const reviewBreakerOutcome = reviewServiceBreaker.allowRequest();

        if (reviewBreakerOutcome === 'refused') specs = specs.filter((spec) => spec.id !== 'reviews');
        if (bookBreakerOutcome === 'refused') specs = specs.filter((spec) => spec.id !== 'book');

        const results = await Promise.allSettled(specs.map((spec) => fetchWithTimeout(spec)));

        const response = { book: undefined, reviews: { status: 'unavailable' } } satisfies BookPageResponse;
        const failedRequests: FailedFetchResult[] = [];
        for (const promise of results) {
            // fetchWithTimeout never rejects
            const resolvedPromise = promise as PromiseFulfilledResult<FetchResult>;
            const resolved = resolvedPromise.value;
            const spec = specs.find((spec) => resolvedPromise.value.specId === spec.id);
            // Ok represents success or failure of requests
            if (resolved.ok) {
                addFetchedData(resolved, response);
                spec?.breaker?.recordSuccess();
                continue;
            }
            failedRequests.push(resolved);
            const outcome = classifyOutcome(resolved.error.statusCode);
            if (outcome === 'failure') spec?.breaker?.recordFailure(`${resolved.error.message}`);
            else if (outcome === 'unknown') continue;
            else spec?.breaker?.recordSuccess();
        }
        handleFailure(failedRequests); // Handle failure of actually sent request

        // Throw book request was not allowed by the breaker.
        if (bookBreakerOutcome === 'refused') throw new AppError('Service unavailable', 503);
        reply.send(new ApiResponse('Book details', response));
    });
}
