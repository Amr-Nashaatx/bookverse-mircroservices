# Decisions

Short notes on choices that weren't obvious, and what each one costs.
Written when the decision was made, updated (not rewritten) when it changes.

Grouped by the problem they answer, not by the pattern they use — patterns get
renamed and reinvented, problems don't.

## [Partial failure](partial-failure/) — a call can fail, or hang, and you can't tell which

- [Timeouts on every outbound call](partial-failure/timeouts.md) — what the gateway waits, and how long it waited before anyone chose
- [Retrying reads, never writes](partial-failure/read-retries.md) — when repeating a call is safe, and who decides
- [Idempotent writes](partial-failure/idempotent-writes.md) — surviving a retry of a request that already succeeded
- [Fault injection is a first-class dev capability](partial-failure/fault-injection.md) — you can't claim resilience you can't reproduce

## [Boundaries](boundaries/) — where one service ends and the next begins, and what may cross

- [Service boundaries](boundaries/service-boundaries.md) — one writer per fact, the four questions to ask before drawing a seam, and the coupling that undoes it
- [Reviews as their own service](boundaries/review-service.md) — trusting a bookId instead of verifying it, and what that buys

## [Overload](overload/) — more work arrives than can be done, and the queue does the damage

- [Load shedding in auth-service](overload/load-shedding.md) — refusing work we cannot finish in time
- [Bulkheads: a connection pool per callee](overload/bulkheads.md) — how much of ourselves one dependency may hold
- [The circuit breaker](overload/circuit-breaker.md) — when to stop calling something that is clearly failing
