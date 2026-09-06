import { AppError } from '@bookverse/shared';
import {
    BookDetails,
    BookPageResponse,
    BookReview,
    FailedFetchResult,
    isAppError,
    SuccessFetchResult,
} from '../types/bookDetailPage.js';

/*
 * Callees answer in the shared ApiResponse envelope, so what the page renders
 * sits one level down: `result.data` is the whole body, `result.data.data` is
 * the book or the review array.
 *
 * The two casts are the trust boundary, and the only unchecked step left on this
 * path. The gateway holds its own COPY of both services' wire shapes and nothing
 * keeps them in sync, so this is an assertion, not a proof -- if a service changes
 * a field, the compiler cannot tell us. See docs/decisions/boundaries/composed-reads.md.
 */
export function addFetchedData(result: SuccessFetchResult, target: BookPageResponse) {
    const specId = result.specId;
    if (specId === 'book') target.book = result.data.data as BookDetails;
    else if (specId === 'reviews') target.reviews = { status: 'ok', items: result.data.data as BookReview[] };
}

/*
 * What the CLIENT should see, given what the callee did. A gateway must not pass
 * an upstream status straight through: book-service answering 401 because our
 * secret is wrong is not the caller's authentication problem, and reporting it
 * as one sends them to fix something that is not broken.
 */
function toClientStatus(upstreamStatus: number): number {
    // The one upstream status that is genuinely about the client's request.
    if (upstreamStatus === 404) return 404;

    // Already the right shape: the callee was unreachable (503) or too slow (504).
    if (upstreamStatus === 503 || upstreamStatus === 504) return upstreamStatus;

    // Everything else -- the callee's own 5xx, or a 4xx meaning WE called it
    // wrong. Either way the defect is on this side of the boundary, not the
    // client's, so it is a bad gateway rather than a bad request.
    return 502;
}

export function handleFailure(results: FailedFetchResult[]) {
    const bookResult = results.find((res) => res.specId === 'book');
    if (bookResult) {
        const status = isAppError(bookResult.error) ? toClientStatus(bookResult.error.statusCode) : 502;
        throw new AppError('could not fetch book details', status);
    }
}
