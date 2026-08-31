# Reviews as their own service

The only significant design choice here is whether to check existence of book when creating review. adding this existence check adds a hard dependency on book service, a hard dependency causes latency of review creation to be as good as the latency of book serivce, it also affects the service availability as it would be bound to the availability of the book service, so in this case i chose to make the dependency soft, i simply trust the book exists and i will reconcile later when i start adding events, having orphaned reviews for some time is not an issue.

## What it costs, measured

Both paths are built. `REVIEW_VERIFY_BOOK_EXISTS` switches between them, so these
are the same code measured twice rather than an estimate.

**Latency** — `POST /reviews` at one connection, medians of three alternated runs:

| | p50 | req/s |
|---|---|---|
| soft (no check) | 25 ms | 37.3 |
| hard (check) | 29 ms | 31.5 |

About 4 ms and ~16% of write capacity. Small, and worth saying plainly: **latency was
never the argument for going soft.**

**Availability** — the same request with book-service stopped:

| | book-service up | book-service stopped |
|---|---|---|
| soft | 201 | 201 in 0.017 s |
| hard | 201 | **503 in 1.035 s** |

That is the whole argument. Soft, book-service's state is irrelevant — and it is
actually faster while down, because a call that was never needed gets skipped. Hard,
reviews cannot be written at all, and every attempt burns a full second on a timeout
first, so you fail slowly.

A reader posting a review while book-service is down sees it succeed normally, and
never learns anything was wrong.

## Dependencies

- **auth-service — soft.** Only the gateway talks to it; review-service reads an
  already-verified identity from headers and never calls it.
- **book-service — soft**, deliberately, at the cost above.
- **its own postgres — hard.** Nothing to be done about that one; a service that
  cannot reach its own database has nothing to serve.

Note there is no circuit breaker on review → book. The one in the gateway only covers
gateway → book. Nothing needs one while the dependency stays soft.

## averageRating

review-service owns it, since it is derived from the reviews. book-service holds a
copy, refreshed by events on review create, update and delete — listening only to
create would drift permanently, because editing and deleting a review also move the
average. The copy may be a few minutes stale; that is loose on purpose so a consumer
restart or a redelivery does not breach it. Whether the event carries the recomputed
average or a delta is a Phase C decision.
