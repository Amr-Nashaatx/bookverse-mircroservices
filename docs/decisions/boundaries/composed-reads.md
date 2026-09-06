# Composing a read across two services

<!--
  YOU WRITE THIS ONE. Prompts below; delete them as you answer. The measurements
  are already filled in because they were taken during the build -- the reasoning
  is the part that matters and the part only you can write.

  Things worth covering, roughly in this order:

  - Why the join moved into the gateway at all. There is no JOIN across the
    boundary; someone has to do it in code. Say who, and why there rather than
    in book-service or in the browser.
  - The cycle you did NOT create, and what it cost. book-service composing would
    have needed book -> review, and you had just deleted review -> book. Say what
    that arrow would have spent, and name the trigger that would make you regret
    spending it.
  - D1: the response shape. Why reviews carries its own status instead of being
    nested in the book, and why `[]` must never mean "we could not fetch them".
  - D2: why a degraded page is still 200.
  - D3: why the reviews budget (800ms) sits below the book budget (1000ms), and
    what that number actually buys -- see the 804ms measurement below.
  - D4: why /books/:id survives alongside /books/:id/page.
  - D5: the review list is uncapped, and review-service has no pagination. Say
    that you decided to defer it rather than that you did not notice.
  - D6: no retries in the composer, and why the proxy's policy did not carry over.
  - What a reader sees when review-service is down. One sentence.
-->

## What it cost, measured

Local stack, warm, medians. `GET /books/:id/page`.

| | result |
|---|---|
| happy path | 200 in ~10 ms |
| book alone / reviews alone | ~9 ms / ~10 ms |

The page costs `max(book, reviews)`, not their sum — the two calls are parallel.
Sequential would have been ~19 ms.

## What it does when half of it is broken

| review-service is... | page | why |
|---|---|---|
| healthy | 200, reviews `{status:"ok", items:[...]}` | |
| has no reviews | 200, reviews `{status:"ok", items:[]}` | a fact, not an absence of facts |
| stopped | 200, reviews `{status:"unavailable"}` in **804 ms** | a stopped container hangs, so we pay the full reviews budget |
| paused (true hang) | 200, `unavailable` in **811 ms** | same |
| breaker open | 200, `unavailable` in **19 ms** | no socket opened at all |

<!--
  The 804ms / 19ms pair is the most interesting number in this build. Same page
  for the reader, an order of magnitude less work. Worth a sentence on what that
  says about what a breaker is actually for on a read path.

  Also worth noting: "down" and "slow" are the same failure from the gateway's
  side. The reviews budget is what bounds both, which is the real reason it is
  set below the book budget.
-->

| book-service is... | page |
|---|---|
| missing that id | **404** |
| stopped (hangs) | **504** after 1.0 s |
| refusing connections | **503**, immediately |

Never 200 with a missing book. The required and optional halves are handled by
different code paths, not by which `catch` fires first.

<!--
  One more worth recording: upstream statuses are NOT passed through. A 404 is,
  because it is the one status genuinely about the client's request. Everything
  else maps to 502/503/504 -- book-service answering 401 because our gateway
  secret is wrong is not the caller's authentication problem. See toClientStatus.
-->

## The wall this stops at

<!--
  This page is fan-out 2 and sorts nothing, which is why it works. Say what
  happens to both of those properties on a LIST page, and name the query that
  composition cannot serve at any speed. That is the bridge into Phase C and
  the reason the copy you designed in Lesson 05 Build 3 has to exist.
-->
