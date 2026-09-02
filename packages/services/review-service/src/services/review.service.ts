import { ConflictError, ForbiddenError, NotFoundError } from '@bookverse/shared';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { Review } from '../generated/prisma/index.js';
import { reviewRepository } from '../repositories/review.repository.js';
import type { CreateReviewInput, ReviewData, UpdateReviewInput } from '../schemas/review.schemas.js';

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
    async listReviewsForBook(bookId: string): Promise<ReviewData[]> {
        const reviews = await reviewRepository.findReviewsByBookId(bookId);
        return reviews.map(serialize);
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
