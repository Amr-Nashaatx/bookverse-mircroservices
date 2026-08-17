# Fault injection is a first-class dev capability

## What was the problem?

I needed some sort of a knob to reproduce different types of failures, so I can test if my code is handling them properly.

## What is the solution?

I introduced a couple of dev-only headers, namely:

- `x-fault-delay` — sleeps for the specified time before continuing.
- `x-fault-status` — replies immediately with the specified status, without running the handler.

## What are the other options?

Well, Claude told me about a more mature and solid third-party solution called [Toxiproxy](https://github.com/Shopify/toxiproxy).

It was the first time I'd ever heard of it, but I always prefer simplicity — so a couple of headers is simpler and does the job for now.
