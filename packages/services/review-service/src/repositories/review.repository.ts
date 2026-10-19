import prisma from '../lib/prisma.js';
import { Prisma, Review } from '../generated/prisma/index.js';
import { ReviewSortValues } from '../schemas/review.schemas.js';
import { BookStatusChangePayload, ReviewEvents, ReviewPostedPayload, REVIEWS_EXCHANGE } from '@bookverse/shared';

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

async function findVersionAndStats(tx: Prisma.TransactionClient, bookId: string) {
    const [{ version }] = await tx.$queryRaw<{ version: number }[]>`
                INSERT INTO "BookReviewVersion" VALUES (${bookId}, 1) ON CONFLICT ("bookId")
                DO UPDATE SET version = "BookReviewVersion".version + 1
                RETURNING version
            `;

    // Find aggregate for rating event
    const aggregate = await tx.review.aggregate({
        where: { bookId },
        _avg: { rating: true },
        _count: { rating: true },
    });

    return { count: aggregate._count.rating, avgRating: aggregate._avg.rating, version };
}

function buildReviewPostedPayload(review: Review) {
    return {
        bookId: review.bookId,
        postedAt: review.createdAt.toISOString(),
        rating: review.rating,
        reviewerId: review.userId,
        reviewId: review.id,
    } satisfies ReviewPostedPayload;
}

export const reviewRepository = {
    async createReview(data: Prisma.ReviewCreateInput) {
        const result = await prisma.$transaction(async (tx) => {
            const review = await tx.review.create({ data });
            const { bookId } = review;

            const { avgRating, count, version } = await findVersionAndStats(tx, bookId);

            // Insert outbox row
            await tx.outbox.create({
                data: {
                    exchange: REVIEWS_EXCHANGE,
                    payload: buildReviewPostedPayload(review),
                    routingKey: ReviewEvents.REVIEW_POSTED,
                },
            });

            return { review, version, count, avgRating };
        });

        return result;
    },

    async getBookStatus(bookId: string) {
        return prisma.bookStatus.findUnique({ where: { bookId } });
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
        const reviewData = await prisma.$transaction(async (tx) => {
            const review = await tx.review.update({ where: { id }, data: update });
            const { bookId } = review;
            const { avgRating, count, version } = await findVersionAndStats(tx, bookId);
            return { review, avgRating, count, version };
        });

        return reviewData;
    },

    async deleteReview(id: string) {
        const reviewData = await prisma.$transaction(async (tx) => {
            const { bookId } = await tx.review.delete({ where: { id } });

            const { avgRating, count, version } = await findVersionAndStats(tx, bookId);
            return { avgRating, count, bookId, version };
        });

        return reviewData;
    },

    async applyStatusChange(payload: BookStatusChangePayload) {
        await prisma.$executeRaw`
            INSERT INTO "BookStatus" ("bookId", status, version) VALUES (${payload.bookId}, ${payload.status}, ${payload.version})
            ON CONFLICT ("bookId") DO UPDATE SET status = EXCLUDED.status, version = EXCLUDED.version
            WHERE "BookStatus".version < EXCLUDED.version`;
    },
};
