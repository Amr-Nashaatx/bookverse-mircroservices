# Retrying reads, never writes

## Why and what?

A call fails and you do not know whether the callee did the work or died on the way back. For a read that does not matter — asking twice for the same book gives the same book, so a wasted retry is all it costs. For a write it matters completely: the request may have created the book and lost the response, and retrying creates a second one.

That is the whole difference, and it is why the policy splits by method rather than by error. Reads retry, writes never. The write's retry still exists, it just moved: it is the user's second click, made safe by the `Idempotency-Key` on `POST /books`. That is the one place in the system that can tell a duplicate from a new request.

## The settings

**3 retries, 503 only, reads only.** `retriesOn503` defaults to 3 per proxy. reply-from refuses non-idempotent methods on its own, so a write never reaches the delay function at all.

**Backoff doubles and is fully randomised** — `random() * min(2000, 100 * 2^attempt)`. Without the randomness, every caller that failed at the same instant comes back at the same instant, so a service that was struggling gets a synchronised wave instead of a spread. Capped at 2s.

**`Retry-After` is honoured but capped at 5s.** Uncapped, a callee sending `Retry-After: 10` across three retries parks a caller for thirty seconds on a hop whose budget is one second. One header from one service should not be able to do that.

**Probes are never retried.** A probe is the breaker asking "are you better yet?". Retrying it means the breaker gets an answer averaged over four attempts and several seconds, so it either closes on a service that is still broken or stays open on one that recovered halfway through. It needs one clean yes or no.

## The two things that bit me

**The default was 10 retries and nobody chose it.** reply-from reads `maxRetriesOn503 || 10`, so the number actually in effect was a library author's default rather than my decision. The same `||` means 0 is not expressible — passing 0 buys ten retries — so "never retry" has to be written as `retryDelay: () => null`.

**`maxRetriesOn503: 3` type-checked and did nothing for months.** reply-from only reads it from the per-request options handed to `reply.from()`; set alongside `upstream` in the proxy config it compiles fine and is silently ignored. One request was making eleven calls. What caught it was counting log lines, not reading code — and that is the part worth keeping. A config that compiles but is never read is invisible to every tool I have. It only shows up in behaviour.

## The interaction with the breaker

Retries and the circuit breaker are on the same path, so a request that fails three times could count as three failures or one. I measured it rather than assuming: the hooks fire once per logical request, so it is one.

That is the right answer anyway. The breaker exists to model what a user experienced, and the user experienced one failed request. Counting attempts would let the retry policy inflate the failure rate and trip the breaker on its own retries.

## The cost

Retries turn one client request into up to four at the callee, at exactly the moment it is least able to cope. Acceptable here because they are capped at 3, only fire on a 503 (the callee explicitly saying "not now"), only exist at one layer — the gateway, since no service calls another — and the breaker sits above them to cut the whole thing off when the service is properly down. Take away any one of those four and I would turn retries off.
