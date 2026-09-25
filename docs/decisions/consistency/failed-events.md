# When a review event can't be applied

The rating copy is only eventually consistent if every event eventually lands. Before this, a handler that threw dropped the message, so one failed event left a book's rating wrong forever.

**Retry the transient, dead-letter the rest.** book-service retries errors that might succeed later (the database is unreachable) for up to 8 seconds. Anything else, or anything still failing after 8 seconds, is rejected into `reviews.dlq` via `reviews.dlx`. Nothing consumes that queue. Messages wait there, and their `x-death` header records which queue they died on and why.

**The error list came from the running system, not the docs.** I first used the Prisma P1xxx connection codes. When I stopped Postgres, Prisma 7 with the pg adapter threw `EAI_AGAIN`, which isn't a Prisma code, so a plain outage was treated as permanent and dead-lettered in seconds. The list now includes the Node network codes.

**8 seconds, because I measured the outage.** A Postgres restart takes ~1.5s before book-service can serve again, and 8s is ~5× that. A failing attempt can itself take ~4s (DNS), so the real worst case is ~12s.

**The DLX goes in code (`x-arguments`), not a policy.** That way the queue's routing is visible where it's declared. The cost: queue arguments are fixed once the queue exists, so changing them later means deleting and redeclaring the queue.

## What it costs

- A retrying message holds a prefetch slot, and it shows as *unacknowledged*, not *ready*, so a depth-based staleness gauge can't see it.
- `reviewsLastRefresh` is stamped when the attempt starts, so during an outage it understates the window.
- Dead-lettering is at-most-once: if the DLX is unreachable, the message is gone.
- Nothing replays the DLQ yet. A message there is kept, not fixed.
