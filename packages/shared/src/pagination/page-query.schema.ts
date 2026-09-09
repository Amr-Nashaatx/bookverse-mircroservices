import { Type } from '@sinclair/typebox';

/* The half of a list query that is the same in every service. Filters are not
 * here — they belong to whoever owns the columns. */
export type PageQueryOptions<S extends string> = {
    /* `sort` names a column, so this allowlist is the defence. Per-endpoint,
     * hence a factory. */
    sortFields: readonly S[];
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
    const { sortFields, defaultSort, defaultLimit, maxLimit } = options;

    return {
        page: Type.Integer({ minimum: 1, default: 1 }),
        limit: Type.Integer({ minimum: 1, maximum: maxLimit, default: defaultLimit }),

        sort: Type.Union(
            sortFields.map((f) => Type.Literal(f)),
            { default: defaultSort },
        ),

        order: Type.Union([Type.Literal('asc'), Type.Literal('desc')], { default: 'desc' }),
    };
}
