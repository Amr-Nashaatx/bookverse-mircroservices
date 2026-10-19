import prisma from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';
import { BookEvents, BOOKS_EXCHANGE, BookStatusChangePayload } from '@bookverse/shared';
import { BookSortValues } from '../schemas/book.schemas.js';

interface CreateBookWithKeyInput extends Prisma.BookCreateInput {
    idempKey: string;
    requestHash: string;
}
export type BookFilters = { genre?: string[]; q?: string };

type BookSortValue = (typeof BookSortValues)[number];
type PageOptions = { take: number; skip: number; sort: BookSortValue };

/*
 * Every sort ends with `id`. Without it, tied titles order differently between
 * two queries and a book lands on both pages or neither.
 *
 * publishedAt is the only nullable field, so the only one needing its NULLs
 * placed; they go last either way — "never published" is not "published long
 * ago". The switch is exhaustive so a new sort field cannot skip this.
 */
/*
 * One predicate for both the page and the count — two copies drift without
 * anything failing.
 *
 * PUBLISHED is hard-wired: no parameter reaches it, so no client can ask for
 * someone's DRAFT. An absent filter must be `undefined` (no filter), never
 * `null` (match nulls); `hasSome: []` matches nothing, so guard on length.
 */
function buildWhere(filters: BookFilters): Prisma.BookWhereInput {
    return {
        status: 'PUBLISHED',
        genre: filters.genre?.length ? { hasSome: filters.genre } : undefined,
        title: filters.q ? { contains: filters.q, mode: 'insensitive' } : undefined,
    };
}

/*
 * One ordering per case, fully specified — column, direction and null
 * placement. `nulls: 'last'` is load-bearing on both nullable columns: an index
 * stores one order and can only be read forwards or backwards, so DESC NULLS
 * LAST is a different order from DESC NULLS FIRST and the index that serves one
 * cannot serve the other. Drop it and the query silently stops using the index
 * and full-sorts every published row instead. The matching indexes carry NULLS
 * LAST by hand — Prisma's @@index cannot express it.
 */
function buildOrderBy(sort: BookSortValue): Prisma.BookOrderByWithRelationInput[] {
    switch (sort) {
        case 'newest':
            return [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }];
        case 'top-rated':
            return [{ reviewsAvgRating: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }];
        case 'a-z':
            return [{ title: 'asc' }, { id: 'asc' }];
    }
}
export const bookRepository = {
    async createBook(data: CreateBookWithKeyInput) {
        return await prisma.$transaction(async (tx) => {
            const { idempKey, requestHash, ...bookData } = data;
            await tx.idempotencyKey.create({
                data: { ownerUserId: data.ownerUserId, key: idempKey, requestHash: requestHash },
            });

            const book = await tx.book.create({ data: bookData });

            await tx.idempotencyKey.update({
                where: { ownerUserId_key: { ownerUserId: data.ownerUserId, key: data.idempKey } },
                data: { bookId: book.id },
            });

            return book;
        });
    },

    /* One page of the public catalogue. */
    async findBooks(filters: BookFilters, page: PageOptions) {
        return prisma.book.findMany({
            where: buildWhere(filters),
            orderBy: buildOrderBy(page.sort),
            skip: page.skip,
            take: page.take,
        });
    },

    /*
     * A count that stops early: `take` becomes LIMIT, so the work is capped
     * however large the table grows.
     *
     * The cap bounds MATCHES, not work — a filter matching almost nothing still
     * scans until it is sure. The index bounds that half.
     */
    async countBooks(filters: BookFilters, cap: number) {
        return prisma.book.count({
            where: buildWhere(filters),
            take: cap,
        });
    },

    async findBookById(id: string) {
        return prisma.book.findUnique({ where: { id } });
    },

    /* The update and, when the status changed, its event: one transaction, so the
     * event exists if and only if the update committed. The relay sends it.
     * Status changes are rare, so a lost status event is not repaired by a later one. */
    async updateBook(id: string, update: Prisma.BookUpdateInput) {
        return prisma.$transaction(async (tx) => {
            const book = await tx.book.update({ where: { id }, data: { ...update, version: { increment: 1 } } });
            if (update.status) {
                await tx.outbox.create({
                    data: {
                        exchange: BOOKS_EXCHANGE,
                        routingKey: BookEvents.STATUS_UPDATED,
                        payload: {
                            bookId: book.id,
                            status: book.status,
                            version: book.version,
                        } satisfies BookStatusChangePayload,
                    },
                });
            }
            return book;
        });
    },

    async applyRatingCopy(id: string, update: Prisma.BookUpdateInput) {
        const reviewsVersion = update.reviewsVersion as number;

        const { count: applied } = await prisma.book.updateMany({
            where: { id, OR: [{ reviewsVersion: null }, { reviewsVersion: { lt: reviewsVersion } }] },
            data: {
                reviewsAvgRating: update.reviewsAvgRating,
                reviewsVersion: update.reviewsVersion,
                reviewsCount: update.reviewsCount,
                reviewsLastRefresh: new Date(),
                version: { increment: 1 },
            },
        });

        return applied;
    },

    async deleteBook(id: string) {
        return prisma.book.delete({ where: { id } });
    },
};
