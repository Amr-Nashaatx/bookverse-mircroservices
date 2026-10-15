import prisma from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';
import { ReviewSortValues } from '../schemas/review.schemas.js';
import { BookStatusChangePayload } from '@bookverse/shared';

type ReviewSortValue = (typeof ReviewSortValues)[number];
export type ReviewPageOptions = { take: number; skip: number; sort: ReviewSortValue };

/* One ordering per case, fully specified. Every sort ends with `id`:
 * same-millisecond or same-rating reviews would otherwise land on both pages,
 * or neither. Neither column is nullable, so null placement does not arise. */
function buildOrderBy(sort: ReviewSortValue): Prisma.ReviewOrderByWithRelationInput[] {
    switch (sort) {
        case 'newest':
            return [{ createdAt: 'desc' }, { id: 'asc' }];
        case 'highest-rated':
            return [{ rating: 'desc' }, { id: 'asc' }];
        case 'lowest-rated':
            return [{ rating: 'asc' }, { id: 'asc' }];
    }
}

export const reviewRepository = {
    async createReview(data: Prisma.ReviewCreateInput) {
        return prisma.review.create({ data });
    },

    async getBookStatus(bookId: string) {
        return prisma.bookStatus.findUnique({ where: { bookId } });
    },
    async findAvgAndCount(bookId: string) {
        const { aggregates, version } = await prisma.$transaction(async (tx) => {
            const [{ version }] = await tx.$queryRaw<{ version: number }[]>`
                INSERT INTO "BookReviewVersion" VALUES (${bookId}, 1) ON CONFLICT ("bookId")
                DO UPDATE SET version = "BookReviewVersion".version + 1
                RETURNING version
            `;
            const result = await tx.review.aggregate({
                where: { bookId },
                _avg: { rating: true },
                _count: { rating: true },
            });

            return { aggregates: result, version };
        });

        return { avgRating: aggregates._avg.rating, count: aggregates._count.rating, bookId, version };
    },
    async findReviewsByBookId(bookId: string, page: ReviewPageOptions) {
        return prisma.review.findMany({
            where: { bookId },
            orderBy: buildOrderBy(page.sort),
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

    async applyStatusChange(payload: BookStatusChangePayload) {
        await prisma.$executeRaw`
            INSERT INTO "BookStatus" ("bookId", status, version) VALUES (${payload.bookId}, ${payload.status}, ${payload.version})
            ON CONFLICT ("bookId") DO UPDATE SET status = EXCLUDED.status, version = EXCLUDED.version
            WHERE "BookStatus".version < EXCLUDED.version`;
    },
};
