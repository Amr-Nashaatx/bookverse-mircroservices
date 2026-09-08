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
 * Every sort ends with `id`. Without that tiebreaker, ORDER BY title with two
 * equal titles lets Postgres order the tie differently between two queries, so
 * page 2 slices a different sequence than page 1 did -- one book appears twice,
 * another never.
 *
 * publishedAt is the only nullable sort field, so it is the only one that needs
 * its NULLs placed; Prisma does not accept a `nulls` option on a NOT NULL
 * column. Unknown dates go last in both directions: "never published" is not
 * "published long ago".
 *
 * The switch is exhaustive on purpose -- add a field to BookSortFields and this
 * stops compiling until you have said where its nulls belong.
 */
/*
 * One source of truth for the predicate: the page and the count must see the
 * same rows, and two copies of this drift without anything failing.
 *
 * `status: 'PUBLISHED'` is hard-wired, not a parameter. This endpoint is
 * public, so a client must not be able to ask for anyone's DRAFT -- and the way
 * to guarantee that is for no parameter to reach this line at all.
 *
 * An absent filter must be `undefined`, never `null`: Prisma reads undefined as
 * "do not filter on this field" and null as "match rows where it IS null". An
 * empty genre array is also "no filter" -- `hasSome: []` matches nothing, which
 * is the opposite of what an empty filter means.
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
     * A count that stops early. Prisma renders `take` as
     * COUNT(*) FROM (SELECT id ... LIMIT cap), so the work is capped at `cap`
     * matching rows however large the table grows -- which is what makes a
     * pager affordable.
     *
     * The cap bounds MATCHES, not work: a filter that matches almost nothing
     * still scans until it is sure. An index on the filtered column is what
     * bounds that half, not this argument.
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
