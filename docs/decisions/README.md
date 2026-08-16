# Decisions

Short notes on choices that weren't obvious, and what each one costs.
Written when the decision was made, updated (not rewritten) when it changes.

- [Timeouts on every outbound call](timeouts.md) — what the gateway waits, and how long it waited before anyone chose
- [Errors keep the status code they arrived with](error-statuses.md) — why a 504 must not become a 500
- [Idempotent writes](idempotent-writes.md) — surviving a retry of a request that already succeeded
- [Fault injection is a first-class dev capability](fault-injection.md) — you can't claim resilience you can't reproduce
