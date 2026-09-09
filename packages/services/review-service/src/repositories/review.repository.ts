import prisma from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';
import { ReviewSortFields } from '../schemas/review.schemas.js';

type ReviewSortField = (typeof ReviewSortFields)[number];
export type ReviewPageOptions = { take: number; skip: number; sort: ReviewSortField; order: Prisma.SortOrder };

/*
 * Every sort ends with `id`. Two reviews posted in the same millisecond, or
 * sharing a rating, would otherwise be ordered differently between two queries
 * -- so a review lands on both pages, or on neither.
 *
 * Neither sort field is nullable, so unlike book-service there are no NULLs to
 * place.
 */
function buildOrderBy(sort: ReviewSortField, order: Prisma.SortOrder): Prisma.ReviewOrderByWithRelationInput[] {
    switch (sort) {
        case 'createdAt':
            return [{ createdAt: order }, { id: 'asc' }];
        case 'rating':
            return [{ rating: order }, { id: 'asc' }];
    }
}

export const reviewRepository = {
    async createReview(data: Prisma.ReviewCreateInput) {
        return prisma.review.create({ data });
    },

    async findReviewsByBookId(bookId: string, page: ReviewPageOptions) {
        return prisma.review.findMany({
            where: { bookId },
            orderBy: buildOrderBy(page.sort, page.order),
            skip: page.skip,
            take: page.take,
        });
    },

    async findReviewById(id: string) {
        return prisma.review.findUnique({ where: { id } });
    },

    async updateReview(id: string, update: Prisma.ReviewUpdateInput) {
        return prisma.review.update({ where: { id }, data: update });
    },

    async deleteReview(id: string) {
        return prisma.review.delete({ where: { id } });
    },
};
