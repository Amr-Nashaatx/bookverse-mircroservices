# Browsing the catalogue: filter, sort and paginate

<!--
  YOU WRITE THIS ONE. Prompts below; delete them as you answer.

  Everything here was decided in the Lesson 07 session (2026-09-09). The
  reasoning is in learning-records/0018 if you want it back, but this note is
  the public version: what BookVerse does and what it costs, not what you
  learned.

  Roughly in this order:

  - What the endpoint is, in one line, with the query string.
  - THE SEAM. shared owns the contract, the service owns the predicate. Say why
    the obvious alternative -- one paginate(model, query) helper -- is not
    possible here, not just unattractive. It is a hard constraint: three
    generated Prisma clients, three WhereInput types shared cannot import.
    Then state the test: if a review-service field forces an edit in shared,
    the line is wrong. Note it is still unproven -- one caller.
  - OFFSET, NOT CURSOR. Three reasons and their order. Name the trigger that
    would change it: a client that pages through everything (export, sync,
    crawler) hitting deep offsets. Say what you would do then -- a separate
    keyset endpoint, not a conversion of this one.
  - THE UI SPLIT. Numbered pages for books, load more for reviews, and the
    structural reason (a section inside a page cannot own the URL). Then the
    consequence that fell out of it: total is opt-in, hasMore is mandatory.
  - THE COUNT. The reframe is the point: the thing worth avoiding was never a
    second query, it was a cost that grows with the table. Give the cap, why
    that number, and what happens past it. Mention the two failures you chose
    NOT to build -- count(*) OVER() (one query, full scan) and the planner
    estimate (needs raw SQL mirroring the where clause).
  - WHAT THE CAP DOES NOT BUY. It bounds matches, not work. A filter matching
    almost nothing still scans until it is sure. Say which half the index
    covers.
  - total + totalIsExact. What each value asserts. One line, and connect it to
    the empty-array rule from composed-reads.md -- same rule, different costume.
  - STATUS. Hard-wired to PUBLISHED with no parameter reaching it, on a public
    endpoint with no identity. Say what would have to change before a
    status filter could exist at all (the gateway only runs verifyJwt on
    non-GET for the book edge, so this service has no caller identity).
  - THE LIMIT CAP as a bulkhead, not a nicety, and why it is a 400 rather than
    a silent clamp. One line on where it lives and why there (the schema, so
    nothing downstream has to agree about what "limit" means).
  - THE TIEBREAKER. Why every sort ends with id. This is the one a reader will
    not have thought of, so spell out the failure: a book on two pages, or none.
  - What is not done yet: indexes, the publish path, whether reviews actually
    reuses the contract.
-->

## The endpoint

<!-- one line, with the query string -->

## What it costs

| query | cost grows with | notes |
|---|---|---|
| indexed sort, page *p* | | |
| unindexed sort, or any `q=` | | |
| the capped count | | |

## What a client can rely on

<!-- the envelope, and what each field asserts -->
