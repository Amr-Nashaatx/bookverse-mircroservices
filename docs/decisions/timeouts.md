# Timeouts on every outbound call

## The problem?

Any connection to a server is some sort of a hold on resources — the faster we get rid of that hold, the better.

In the case of a request with no timeout, this is essentially a permanent hold on resources in case of a failure. It will definitely be given up eventually, and relatively quickly, but in that time failing requests could easily pile up and consume even more resources.

So every service in each layer needs one. For example:

```
gateway -> book -> db
```

If a request causes a db failure down this chain, and the db layer has no timeout, then this request now holds resources on every service in the chain, i.e. gateway and book. And if the failure has not been recovered, it could potentially bring down the whole system.

A good timeout prevents this situation by giving up on unresponsive requests to the db, so the system is still active.

## The solution?

Claude told me how to pick reasonable numbers. He said a couple of important things about them:

- First, they need to be set by observing the dependency's latency.
- As a rule, a timeout should be set to > p99.9 of normal latency.

So he wrote me `latency.mjs`, a little script that derives this value from the docker logs.

Request budgets should be considered here as well, but right now it is just one hop — nothing to add.
