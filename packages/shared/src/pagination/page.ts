import { Type, type TSchema } from '@sinclair/typebox';

export type PageQuery<S extends string = string> = {
    page: number;
    limit: number;
    sort: S;
    order: 'asc' | 'desc';
};

export type SkipTake = { skip: number; take: number };

/*
 * No clamping: the schema capped `limit` before the handler ran.
 * `take` is limit + 1 so hasMore can be answered without a second COUNT query.
 */
export function toSkipTake(query: Pick<PageQuery, 'page' | 'limit'>): SkipTake {
    return { skip: (query.page - 1) * query.limit, take: query.limit + 1 };
}

/*
 * The envelope every list endpoint in BookVerse answers with.
 *
 * `total` is a LOWER BOUND, not a count: it is the rows skipped plus the rows
 * on this page, which costs nothing because both numbers are already known.
 * It becomes exact the moment there is no next page, and `totalIsExact` says
 * which of the two you are holding.
 *
 * The flag is the whole point. A number that is sometimes a count and
 * sometimes a floor, with no way to tell them apart, asserts something it does
 * not know -- render "of 7 pages" from a floor and the 8th page is a bug
 * report. Same rule as an empty array meaning "none" vs "could not fetch".
 */
export type Page<T> = {
    items: T[];
    page: number;
    limit: number;
    total: number;
    totalIsExact: boolean;
    hasMore: boolean;
};

/*
 * Drops the probe row from toSkipTake; the caller never sees it.
 *
 * If an endpoint ever needs a real number on page 1, it spreads a count over
 * the result rather than changing this function:
 *   { ...toPage(rows, q), total: n, totalIsExact: n < cap }
 */
export function toPage<T>(rows: T[], query: PageQuery): Page<T> {
    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    return {
        items,
        page: query.page,
        limit: query.limit,
        total: (query.page - 1) * query.limit + items.length,
        totalIsExact: !hasMore,
        hasMore,
    };
}

/*
 * The envelope as a schema. It lives here because Fastify serializes strictly
 * against it: a hand-written copy per service diverges on the wire, silently.
 */
export function pageSchema<T extends TSchema>(item: T) {
    return Type.Object({
        items: Type.Array(item),
        page: Type.Integer(),
        limit: Type.Integer(),
        total: Type.Integer(),
        totalIsExact: Type.Boolean(),
        hasMore: Type.Boolean(),
    });
}
