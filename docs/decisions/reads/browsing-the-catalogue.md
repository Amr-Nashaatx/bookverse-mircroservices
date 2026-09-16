# Browsing the catalogue: filter, sort and paginate

## The endpoint

`GET /books?genre=&q=&sort=&page=&limit=` — published books only, filtered and ordered on fields book-service owns.

## The seam: shared owns the contract, the service owns the predicate

Three things happen in a list endpoint. Reading the query string is identical everywhere. Wrapping the rows is half identical. Turning the query into a predicate is different everywhere. So `packages/shared/src/pagination/` holds the first and third — `pageQueryProps()`, `toSkipTake()`, `toPage()`, `pageSchema()` — and each service writes its own `where`.

The obvious alternative, one `paginate(model, query)` helper in shared, is not just unattractive, it is impossible. Each service generates its own Prisma client, so `BookWhereInput` and `ReviewWhereInput` are types shared cannot import. To accept both, the helper collapses to `any` and stops checking anything.

The genuinely shared code is about 60 lines. The payoff is not lines saved, it is that the contract cannot drift: every list endpoint takes the same params, refuses bad input the same way, and answers in the same shape.

**The test:** if adding a review-service field forces an edit in `shared`, the line is in the wrong place. Reviews now uses the same contract with its own sort allowlist and needed zero edits in `shared`, so the line holds for two callers.

## Offset, not cursor

Three reasons, in weight order. The UI asks for `page=2` and a cursor cannot jump to a page it has not walked to. `top-rated` mutates under a reader while they page, so a cursor keyed on it silently skips or repeats rows. And a cursor is state — it has to encode its sort into the token, which is contract surface in the package I am trying to keep small.

Offset also serves numbered pages, load more *and* infinite scroll; a cursor serves only the last two. So the UI decision does not gate the API decision.

**What would change it:** a client that pages through everything — an export, a sync job, a crawler — hitting deep offsets, where offset pays for every row it skips. The answer then is a separate keyset endpoint for that caller, not converting this one. They want different things.

## Numbered pages for books, load more for reviews

Reviews are a *section inside a page*, not a page. The URL already belongs to the book, so `?page=3` is ambiguous the moment a second paginated section exists — and chapters and related books are both coming. Nobody shares page 4 of a book's reviews, and "847 reviews" is a fact about the book, not a navigation aid.

That settled the envelope too: numbered pages need `total`, load more needs only `hasMore`. So `hasMore` is mandatory and the count is opt-in per endpoint, which keeps the O(n) cost attached to the endpoint that asked for it.

## The count is capped at 500

I started by looking for an estimate to avoid a second query, then realised a backward-looking bound can never render "page 2 of 7" — it only knows where you have been. The reframe: **the thing worth avoiding was never a second query, it was a cost that grows with the table.**

`count({ where, take: 500 })` renders as `COUNT(*) FROM (SELECT id ... LIMIT 500)`, so the cost is capped however large the table gets, and `Promise.all` makes it a second round trip but not a second wait. 500 is 50 pages at the default limit — past that nobody is reading, they are refining. Beyond the cap the UI says "500+".

Two alternatives I did not build. `count(*) OVER()` is one query instead of two and a full scan on every request — the trap, because it looks like the efficient option. A planner estimate needs raw SQL mirroring the `where` clause, so the filter exists twice and the two can disagree silently.

**What the cap does not buy:** it bounds matches, not work. A filter matching almost nothing still scans until it is sure, so `?q=zzzz` on a large table is a full scan whether the count is capped or not. The index bounds that half; the cap bounds the other.

## What each field asserts

`total` ships with `totalIsExact`. A number that is sometimes a count and sometimes a floor, with nothing to tell them apart, asserts something it does not know. Same rule as never returning `[]` for "could not fetch" in [composed-reads](../boundaries/composed-reads.md) — a value has to say which of the two it is, in the body, not by convention.

## Published only, hard-wired

`status: 'PUBLISHED'` is set in the repository and no query parameter reaches it. This is a public endpoint and the gateway only runs `verifyJwt` on non-GET for the book edge, so book-service has no caller identity here — there is nobody to check a `?status=DRAFT` against. A status filter cannot exist at all until identity reaches this path.

This was a real bug first: with no `status` in the `where`, every user's drafts were public, and since the default sort is `publishedAt desc` and Postgres puts NULLs first, unpublished drafts led page 1. The worst case was also the default case.

## `sort` names an ordering, not a column

`newest`, `top-rated`, `a-z` — each fixes the column, the direction and where nulls go, so each maps to exactly one index and can carry a definition a bare column name cannot. A column allowlist plus a free `order` multiplies out to orderings nobody wants (worst-rated first) and an index per combination.

## Two small ones that are not small

**`limit` caps at 50 and over-asking is a 400, not a silent clamp.** Asking for 100 and getting 20 is indistinguishable from a client-side bug. It lives in the schema so ajv settles it before any handler runs and nothing downstream has to agree about what "limit" means — which was the actual defect the first time: three places disagreed, and `?limit=1000000` fetched a million rows while the pages overlapped.

**Every ordering ends with `id`.** Without a tiebreaker, two books with the same title can be ordered differently by two queries, so a book appears on both page 1 and page 2, or on neither. Invisible at 15 rows, a data-loss bug at 1,000.

## What it costs

| query | cost grows with | notes |
|---|---|---|
| indexed sort, page *p* | `p × limit` | offset pays for rows it skips; fine for the pages people actually visit |
| any `q=` | the table | no text index, so it scans |
| the capped count | nothing, past 500 | bounded by `take`, parallel with the page query |

## Not done yet

- No book can be PUBLISHED — there is no publish path, the column defaults to DRAFT, so this endpoint correctly returns `[]` until that exists.
- The indexes are in but not `EXPLAIN`-confirmed as used.
- The page-boundary check is unrun; it needs published rows with duplicate titles.
