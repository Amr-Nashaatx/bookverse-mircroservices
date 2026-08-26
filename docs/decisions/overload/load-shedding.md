# Load shedding

## Why load shedding?

Let's talk about auth service as an example. Auth service had its routes make 2 calls to bcrypt for hashing, the package in use "bcryptjs" is all written in js and hence it all runs on a single thread or "lane" so each login request takes around ~100 ms.
This number is only valid under no overload so each request comes and gets served without wait, i created a load testing script "sweep.mjs". it uses the autocannon package and as such the test was closed-loop i.e(on each connection a request is sent and waits for the reply to send again).

The sweep showed a terrible latency at P99 of ~1.3s at c = 8 (concurrent requests), and it keeps growing the more c grows. Against a hop timeout of 2s increasing concurrency would flat out throughput but goodput falls to zero.

That's where load shedding comes into play, by shedding the load i.e (concurrent requests) at c = ~4 which is the knee for this service max throughput and goodput are achieved while keeping latency in check.

## How load shedding is implemented?

I used a simple approach here, a global request counter that gets incremented with onRequest hook on each request and decrements whenever a response is set using onResponse.
signals like /health that must respond (otherwise a healthy service could be considered dead) are exempt from the shedding.

I also tried to shed based on event-loop delay and event-loop utilization but both gauges can have the same range in healthy or overloaded case so they can't be used for this purpose.

## What are the consequences?

Now whenever a service (auth service for example) receives more load than it can handle a 503 retry-after response with 1 s is sent.
