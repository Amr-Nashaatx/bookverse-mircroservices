import prisma from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/index.js';
import { BookSortFields } from '../schemas/book.schemas.js';

interface CreateBookWithKeyInput extends Prisma.BookCreateInput {
    idempKey: string;
    requestHash: string;
}
export type BookFilters = { genre?: string[]; q?: string };

type BookSortField = (typeof BookSortFields)[number];
type PageOptions = { take: number; skip: number; sort: BookSortField; order: Prisma.SortOrder };

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

function buildOrderBy(sort: BookSortField, order: Prisma.SortOrder): Prisma.BookOrderByWithRelationInput[] {
    switch (sort) {
        case 'publishedAt':
            return [{ publishedAt: { sort: order, nulls: 'last' } }, { id: 'asc' }];
        case 'title':
            return [{ title: order }, { id: 'asc' }];
        case 'createdAt':
            return [{ createdAt: order }, { id: 'asc' }];
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
            orderBy: buildOrderBy(page.sort, page.order),
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

    async updateBook(id: string, update: Prisma.BookUpdateInput) {
        return prisma.book.update({ where: { id }, data: update });
    },

    async deleteBook(id: string) {
        return prisma.book.delete({ where: { id } });
    },
};
