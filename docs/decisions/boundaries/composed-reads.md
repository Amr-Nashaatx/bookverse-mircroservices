# Composing a read across two services

## Why and what?

`GET /books/:id/page` returns a book together with its reviews. There is no JOIN available — books and reviews are in separate databases — so someone has to join them in code. The only question is who.

I put it in the gateway. book-service would have needed to call review-service, which is an arrow I had just deleted when the services were split, and it would have made a book page's availability depend on review-service being up for a field that is optional. The browser doing two calls works, but then every client reimplements the join, the fallback and the timeouts, and they will not agree.

The gateway already fans out, already owns timeouts and breakers per callee, and is the only place that knows what a "page" is — which turns out to be the thing that matters, because deciding that reviews are optional and the book is not is a statement about the page, not about either service.

## The cycle I did not create

If book-service had composed, it would need `book -> review`, and `review -> book` already existed and had just been removed. That is a cycle: two services that cannot be deployed, tested or reasoned about independently, and a failure in either takes out both.

**The trigger that would make me reconsider:** if the book page ever needs a field that only review-service can compute *and* that has to be consistent with the book in the same response, the gateway cannot do it — it can only stitch two answers from two moments. That is the point where a copy (or a different boundary) is the answer, not a composer.

## The decisions

**Reviews carry their own status, they are not nested in the book.** `{status:"ok", items:[...]}` or `{status:"unavailable"}`. An empty array asserts *there are no reviews*, which is a fact. If `[]` also meant "we could not fetch them", the response would be lying in the case that matters most, and no client could tell the two apart. The rule generalises: ask what a fallback asserts. A cached value asserts "true recently" and is fine; a default asserts "true" and is a lie.

**A degraded page is still 200.** The request succeeded and the page rendered. The reviews section says it is unavailable, in the body, where the client can act on it. A 5xx would tell the client the whole page failed when most of it did not, and would make every caller's error handling coarser than reality.

**Reviews get 800ms, the book gets 1000ms.** The optional half has to time out *before* the required half, or the page waits on something it is willing to live without. What 800ms actually buys is visible below: a stopped review-service hangs rather than refusing, so that number is the entire cost of the bad case.

**`/books/:id` still exists alongside `/books/:id/page`.** A client that wants a book should not pay for reviews. The composed route is an addition, not a replacement, and a specific route registered alongside the `/books` proxy prefix wins over it.

**The review list is uncapped.** review-service had no pagination when this was built, so the page fetches all of them. I decided to defer it rather than not noticing it — it is bounded by how many reviews a book has, which is small today and is a real bug the first time a book gets ten thousand.

**No retries in the composer.** The proxy's retry policy does not carry over — this is a hand-written `fetch`, not `reply.from`. That is fine for the optional half, where the fallback is cheaper than a retry, and the breaker already handles the case where the service is properly down.

## What it cost, measured

Local stack, warm, medians. `GET /books/:id/page`.

| | result |
|---|---|
| happy path | 200 in ~10 ms |
| book alone / reviews alone | ~9 ms / ~10 ms |

The page costs `max(book, reviews)`, not their sum — the two calls are parallel. Sequential would have been ~19 ms.

## What it does when half of it is broken

| review-service is... | page | why |
|---|---|---|
| healthy | 200, reviews `{status:"ok", items:[...]}` | |
| has no reviews | 200, reviews `{status:"ok", items:[]}` | a fact, not an absence of facts |
| stopped | 200, reviews `{status:"unavailable"}` in **804 ms** | a stopped container hangs, so we pay the full reviews budget |
| paused (true hang) | 200, `unavailable` in **811 ms** | same |
| breaker open | 200, `unavailable` in **19 ms** | no socket opened at all |

**804ms vs 19ms is the most interesting pair here.** Identical page for the reader, an order of magnitude less work. That is what a breaker buys on a read path, and it only shows up because the page degrades instead of failing — on the proxy, the same open breaker just returns 503 in 3.8ms. A proxy has nothing to serve without its callee; a composer does.

Also worth writing down: **"down" and "slow" are the same failure from this side.** A stopped container hangs, a refusing one fails in 9ms — two very different numbers for what a naive reading calls "the service is down". The timeout budget is what bounds both, which is the real reason reviews' budget sits below book's.

| book-service is... | page |
|---|---|
| missing that id | **404** |
| stopped (hangs) | **504** after 1.0 s |
| refusing connections | **503**, immediately |

Never 200 with a missing book. The required and optional halves are handled by different code paths, not by which `catch` happens to fire first.

Upstream statuses are **not** passed through. A 404 is, because it is the one status genuinely about the client's request. Everything else maps to 502/503/504 — book-service answering 401 because our gateway secret is wrong is not the caller's authentication problem. See `toClientStatus`.

## The wall this stops at

This page works because it is fan-out 2 and sorts nothing. Both properties break on a list page: fetching 15 books and their reviews is 16 internal requests for one client request, so a composer is a load amplifier and the client controls the multiplier.

And there is a query composition cannot serve at any speed: **books sorted by average rating, page 2.** A composer fetches first and sorts second, so it has to pull every book and every review before it can rank anything — page 2 costs as much as the whole table. Not slow, impossible to do properly. That is the wall that forces a copy of the rating into book-service, which is [the rating copy](../consistency/rating-copy.md).
