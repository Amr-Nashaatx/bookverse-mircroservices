import prisma from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';

export const reviewRepository = {
    async createReview(data: Prisma.ReviewCreateInput) {
        return prisma.review.create({ data });
    },

    async findReviewsByBookId(bookId: string) {
        return prisma.review.findMany({ where: { bookId }, orderBy: { createdAt: 'desc' } });
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
