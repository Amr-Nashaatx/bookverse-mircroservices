# Decisions

Short notes on choices that weren't obvious, and what each one costs.
Written when the decision was made, updated (not rewritten) when it changes.

- [Timeouts on every outbound call](timeouts.md) — what the gateway waits, and how long it waited before anyone chose
- [Idempotent writes](idempotent-writes.md) — surviving a retry of a request that already succeeded
- [Fault injection is a first-class dev capability](fault-injection.md) — you can't claim resilience you can't reproduce
- [Retrying reads, never writes](read-retries.md) — when repeating a call is safe, and who decides
- [Load shedding in auth-service](load-shedding.md) — refusing work you cannot finish in time
- [Bulkheads: a connection pool per callee](bulkheads.md) — how much of ourselves one dependency may hold
- [The circuit breaker](circuit-breaker.md) — when to stop calling something that is clearly failing
- [Deferred: request deadlines and admission control](deferred-deadlines.md) — why half of this cannot be built alone
