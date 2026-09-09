import { ConflictError, ForbiddenError, NotFoundError, Page, toPage, toSkipTake } from '@bookverse/shared';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { Review } from '../generated/prisma/index.js';
import { reviewRepository } from '../repositories/review.repository.js';
import type { CreateReviewInput, ListReviewsQuery, ReviewData, UpdateReviewInput } from '../schemas/review.schemas.js';

// Shape a Prisma Review (with Date objects) into the serializable response DTO.
function serialize(review: Review): ReviewData {
    return {
        id: review.id,
        bookId: review.bookId,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
    };
}

export const reviewService = {
    /*
     * No count query. This list is rendered with a "load more" button, which
     * only ever asks "is there another batch?" -- so `hasMore` is the whole
     * requirement and `total` stays the free lower bound toPage() computes.
     */
    async listReviewsForBook(query: ListReviewsQuery): Promise<Page<ReviewData>> {
        const pageQuery = { page: query.page, limit: query.limit, sort: query.sort, order: query.order };
        const { skip, take } = toSkipTake(pageQuery);

        const reviews = await reviewRepository.findReviewsByBookId(query.bookId, {
            skip,
            take,
            sort: pageQuery.sort,
            order: pageQuery.order,
        });
        return toPage(reviews.map(serialize), pageQuery);
    },

    async getReview(id: string): Promise<ReviewData> {
        const review = await reviewRepository.findReviewById(id);
        if (!review) throw new NotFoundError('review not found');
        return serialize(review);
    },

    /*
     * Creates a review owned by `userId` (the authenticated caller).
     * The route layer supplies that id from the verified identity; the service
     * never reads headers.
     */
    async createReview(userId: string, input: CreateReviewInput): Promise<ReviewData> {
        try {
            const review = await reviewRepository.createReview({ ...input, userId });
            return serialize(review);
        } catch (e) {
            // The unique (bookId, userId) index is doing double duty here: it
            // enforces one-review-per-reader AND makes a duplicate submit safe,
            // which is why this service needs no idempotency key.
            if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new ConflictError('You have already reviewed this book');
            }
            throw e;
        }
    },

    async updateReview(id: string, userId: string, update: UpdateReviewInput): Promise<ReviewData> {
        const review = await reviewRepository.findReviewById(id);
        if (!review) throw new NotFoundError('review not found');
        if (review.userId !== userId) throw new ForbiddenError('You do not have permission for this action');

        const updated = await reviewRepository.updateReview(id, update);
        return serialize(updated);
    },

    async deleteReview(id: string, userId: string): Promise<void> {
        const review = await reviewRepository.findReviewById(id);
        if (!review) throw new NotFoundError('review not found');
        if (review.userId !== userId) throw new ForbiddenError('You do not have permission for this action');

        await reviewRepository.deleteReview(id);
    },
};
