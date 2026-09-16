# The rating copy

## Why and what?

book-service needs to sort the catalogue by average rating and it cannot, because review-service owns the reviews and they sit in a separate database. There is no JOIN to reach for. Composing does not help either: a composer fetches first and sorts second, so page 2 costs as much as the whole table.

So book-service keeps a copy — `reviewsAvgRating`, `reviewsCount`, `reviewsLastRefresh` on `Book`. review-service still owns the fact, book-service owns the column.

Four ways to keep it true. book-service asks review-service on every read, which is the composition wall again. review-service calls book-service on every write, which adds an arrow I had just deleted and makes a review write fail when book-service is down. A cron job, which is stale by the interval and does the work whether or not anything changed. Or review-service publishes and book-service listens. I took the last one: neither service names the other, and posting a review does not depend on book-service being up.

## The decisions

**The payload is the aggregate** `{bookId, avgRating, count}`, not a delta and not a bare notification. At-least-once means redelivery is guaranteed rather than rare, and a delta applied twice is wrong permanently — nothing ever repairs it. An aggregate applied twice is a no-op. Delta only looks cheaper until you price in the dedup table it needs to be correct. It costs me one aggregate query per write.
**The column I left red: reordering.** An older message can overwrite a newer one and the copy stays wrong until the next event for that book. Lesson 10 closes it with a version or a timestamp.

**Commit first, then publish.** If the publish fails, the review exists and the rating silently lags. The other order invents events for writes that never committed, which is the worse of the two. Repair is `node scripts/backfill-ratings.js`.

**Broker down: the write still succeeds**, and the failure is logged per event. Failing the write was never actually on the table — I publish after the commit, so the review is already saved and all I could do is return an error about a write that worked.

**`requeue: false` when a handler throws.** Requeueing a message that failed deterministically is an infinite loop that blocks everything behind it. The cost is that transient failures get dropped too, because `nack` cannot tell the two apart.

**null is not 0.** `reviewsAvgRating` is nullable: null means nobody has reviewed it, 0 would mean everybody hated it. Unrated books sort last (`NULLS LAST`), which means new books start buried.

## Important consequences

- **Nothing in review-service's code says who consumes `review.created`.** The call graph moved out of the repo and into the broker's binding table — `rabbitmqctl list_bindings`, or the UI on `:15672`.
- **The broker is now critical to every review write.** Events did not remove a dependency, they moved one.
- **A consumer sits outside `verifyGatewaySecret`.** Anyone who can reach the broker can publish anything into book-service. That is why the handler calls `applyRatingCopy`, which can write three columns, instead of `updateBook`, which can write anything.
- **The staleness window is a promise, not a measurement.** `reviewsLastRefresh` exists so it can be measured. No number yet.
- `GET /books/:id/page` now has two sources for one fact — the copy, and the reviews it already fetched on the same page. They can disagree on screen. Unresolved.

## For the future

- A dead-letter queue, so the messages I currently drop are recoverable.
- An ordering guard, so an old message cannot overwrite a newer one.
- A transactional outbox — the only thing that actually closes the gap between the commit and the publish.
- One 5-star review currently outranks 500 reviews averaging 4.8. `reviewsCount` exists to fix that and nothing uses it yet.
