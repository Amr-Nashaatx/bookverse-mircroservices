import { Type } from '@sinclair/typebox';

/*
 * The half of a list query that is identical in every service: page, limit,
 * sort, order. Filters are not here -- they belong to whoever owns the columns.
 */
export type PageQueryOptions<S extends string> = {
    /* The only values `sort` may take. `sort` names a column, so this
     * allowlist is the defence -- and it differs per endpoint, which is why
     * this is a factory. */
    sortFields: readonly S[];
    defaultSort: S;
    defaultLimit: number;
    /* Exceeding the cap is a 400, not a silent clamp: a client that asks for
     * 100 and receives 20 cannot tell a cap from a bug in its own code. ajv
     * enforces it before any handler runs, so `limit` means one thing
     * everywhere downstream. */
    maxLimit: number;
};

/*
 * Returns a properties record, not a schema, so a service composes one flat
 * object: Type.Object({ ...pageQueryProps({...}), ...bookFilterProps }).
 * Flat matters -- ajv's coercion and defaults are unreliable across `allOf`.
 */
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
