# Bulkheads: a connection pool per callee

## Why and what?

Bulkheads: the term comes from a ship metaphor, and it is added to protect the caller from having the connection pool exhausted on a dead or very slow service and hence calls to other services find no slots at all.

In the current setup the bulkhead is only deployed on gateway service, so each service has its separate connection pool and one service's pool exhaustion does not affect the other.
the package used for proxying on gateway (@fastify/http-proxy) has a separate connection pool per proxy of default size 128, so i had only to change the size to keep from overloading the services

I chose bulkheads of 4 and 8 for auth and book services respectively, for book service i picked the bulkhead at the WRITE knee i.e(the knee measured from POST /books numbers) which caps reads at roughly 970/s but this number is nowhere near being needed so it works for both cases at this point, it will definitely change in the future, for auth it was different: throughput is capped from c = 1,
so i cannot cap based on throughput measurements i simply chose based on Little's Law and what latency i am willing to serve so roughly it was something like: L = λ × W = 6.4/sec × ~0.6s ≈ 4.

## Important consequences

Notice we now cap at gateway so connections above the bulkhead are queued at the gateway rather than the service it is sent to, which raises a different problem this queue at the gateway is unbounded which means the latency grows with load the exact problem i was trying to solve by load-shedding.

## For the future

The gateway queue needs to be bounded and requests that took more than their budget/deadline should be removed from the queue, serving them is doing orphaned work.
