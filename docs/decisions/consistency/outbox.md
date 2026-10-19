# Not losing an event between the commit and the publish

Every producer here used to commit, then publish, and log if the publish failed. For the rating copy that was fine: each event carries the whole aggregate, so the next review, or `backfill-ratings.js`, puts it right. Notifications broke that. "A reader reviewed your book" is something that happened, not something that is, so a later event can't replace a lost one and no script can tell which reviews were never announced. Book status had the same problem for a different reason: a book changes status a handful of times in its life, so "the next event will fix it" usually never comes.

**The event is written in the same transaction as the change.** The review (or the status update) and a row in an `Outbox` table commit together or not at all. A relay polls the table every 200ms, publishes the unsent rows on a confirm channel, waits for RabbitMQ to confirm, and only then marks them sent. `review.posted` and `book.status-updated` go through it.

**The relay selects unsent rows; it never remembers "the last id I sent".** I measured why on Postgres: two transactions inserting into one table, the slower one started first. Its row (id 1) became visible about two seconds after id 2. A relay that had saved "last id = 2" would never have sent id 1, and nothing would have failed.

**Rating events stay commit-then-publish.** They're already in the same transaction as the review, so moving them would be easy. I kept them out because a lost one is repaired by the next review on that book. A book nobody reviews again keeps a stale rating until the backfill runs, and I accept that.

## What else I could have done

- **Publish, then commit.** It never loses an event, but it invents some: a notification for a review whose transaction then rolled back. And reviews would fail whenever RabbitMQ is down.
- **Tail the database's write-ahead log (Debezium)** instead of polling. Lower latency and no polling queries, but one more system to run.

## What it costs

- **Duplicates.** If the relay dies after RabbitMQ confirms but before it marks the row, the row is sent again. The rating and status copies already ignore a version they've seen. Notifications refuse a repeated `eventId` with a unique constraint.
- **Latency.** Up to one poll interval in normal running. After an outage it's much more: when RabbitMQ came back, notifications arrived ~25s later, all of it amqplib's reconnect backoff (95ms, doubling to ~10s), none of it the poll interval.
- **A second staleness gauge.** The number of unsent rows, and the age of the oldest, say how far behind the relay is. Queue depth can't see events that haven't left the database yet.
- **Log noise.** While RabbitMQ is down, the relay logs a failure every tick.
