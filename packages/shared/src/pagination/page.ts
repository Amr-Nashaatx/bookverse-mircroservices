import { Type, type TSchema } from '@sinclair/typebox';

export type PageQuery<S extends string = string> = {
    page: number;
    limit: number;
    sort: S;
    order: 'asc' | 'desc';
};

export type SkipTake = { skip: number; take: number };

/* No clamping — the schema capped `limit`. take is limit+1: the extra row
 * answers hasMore without a COUNT. */
export function toSkipTake(query: Pick<PageQuery, 'page' | 'limit'>): SkipTake {
    return { skip: (query.page - 1) * query.limit, take: query.limit + 1 };
}

/* Every list endpoint answers in this shape.
 * `total` is a lower bound unless `totalIsExact` — render "of 7 pages" from a
 * bound and the 8th page is a bug report. */
export type Page<T> = {
    items: T[];
    page: number;
    limit: number;
    total: number;
    totalIsExact: boolean;
    hasMore: boolean;
};

/* Drops the probe row. For a real total, spread a count over the result:
 * { ...toPage(rows, q), total: n, totalIsExact: n < cap } */
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

/* Shared because Fastify serializes strictly against it — a per-service copy
 * diverges on the wire, silently. */
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
