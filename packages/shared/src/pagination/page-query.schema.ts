import { Type } from '@sinclair/typebox';

/* The half of a list query that is the same in every service. Filters are not
 * here — they belong to whoever owns the columns. */
export type PageQueryOptions<S extends string> = {
    /* `sort` names a complete ORDERING, not a column — "newest", "top-rated".
     * One value fixes the column, the direction and where nulls go, so each one
     * maps to exactly one index and each one can carry a definition a bare
     * column name cannot ("top-rated" may mean "and at least N reviews").
     *
     * A column allowlist plus a free `order` multiplies out to orderings nobody
     * wants (worst-rated first) and an index per combination. The allowlist is
     * still the defence against reaching a column that isn't offered; it is now
     * also the menu. Per-endpoint, hence a factory. */
    sortValues: readonly S[];
    defaultSort: S;
    defaultLimit: number;
    /* A 400, not a silent clamp — asking for 100 and getting 20 is
     * indistinguishable from a client-side bug. Enforced before the handler,
     * so `limit` means one thing downstream. */
    maxLimit: number;
};

/* Returns properties, not a schema, so a service spreads it into one flat
 * object. Flat matters: ajv's coercion is unreliable across `allOf`. */
export function pageQueryProps<S extends string>(options: PageQueryOptions<S>) {
    const { sortValues, defaultSort, defaultLimit, maxLimit } = options;

    return {
        page: Type.Integer({ minimum: 1, default: 1 }),
        limit: Type.Integer({ minimum: 1, maximum: maxLimit, default: defaultLimit }),

        sort: Type.Union(
            sortValues.map((f) => Type.Literal(f)),
            { default: defaultSort },
        ),
    };
}
