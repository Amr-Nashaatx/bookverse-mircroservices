import { AppError } from '@bookverse/shared';
import {
    BookDetails,
    BookPageResponse,
    BookReview,
    FailedFetchResult,
    isAppError,
    ReviewPage,
    SuccessFetchResult,
} from '../types/bookDetailPage.js';

/*
 * Callees answer in the ApiResponse envelope, so the payload sits one level
 * down at `result.data.data`.
 *
 * The casts are the trust boundary and the only unchecked step here: the
 * gateway holds its own copy of both wire shapes, so a service changing a field
 * is an assertion the compiler cannot check. It has already happened once —
 * reviews became a page envelope. See docs/decisions/boundaries/composed-reads.md.
 */
export function addFetchedData(result: SuccessFetchResult, target: BookPageResponse) {
    const specId = result.specId;
    if (specId === 'book') target.book = result.data.data as BookDetails;
    else if (specId === 'reviews') {
        const page = result.data.data as ReviewPage;
        target.reviews = { status: 'ok', items: page.items, hasMore: page.hasMore, total: page.total };
    }
}

/*
 * What the CLIENT should see, given what the callee did. Passing an upstream
 * status straight through misleads: book-service answering 401 because OUR
 * secret is wrong is not the caller's authentication problem.
 */
function toClientStatus(upstreamStatus: number): number {
    // The one upstream status that is genuinely about the client's request.
    if (upstreamStatus === 404) return 404;

    // Already the right shape: the callee was unreachable (503) or too slow (504).
    if (upstreamStatus === 503 || upstreamStatus === 504) return upstreamStatus;

    // The callee's own 5xx, or a 4xx meaning WE called it wrong. Either way the
    // defect is on this side of the boundary — bad gateway, not bad request.
    return 502;
}

export function handleFailure(results: FailedFetchResult[]) {
    const bookResult = results.find((res) => res.specId === 'book');
    if (bookResult) {
        const status = isAppError(bookResult.error) ? toClientStatus(bookResult.error.statusCode) : 502;
        throw new AppError('could not fetch book details', status);
    }
}
