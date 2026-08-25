# Bulkheads: a connection pool per callee

<!--
Prompts — delete each as you answer it. Prose, not a template.

THE PROBLEM
- The ship metaphor is where the name comes from, but state the actual failure
  in your own system: one slow callee, a shared pool, and what happens to calls
  aimed at the healthy services.
- Before this, every callee got 128 connections. Who chose 128?

SIZING
- auth 4, book 8 — both from measurement. Show the sweeps.
- Book is sized from the WRITE path even though reads are ~4x cheaper. Why did
  you size for the expensive route, and what does that cost the cheap one?
- The result worth writing down: past the knee, capping concurrency made book
  writes FASTER (319 -> 384/sec at 32 concurrent). Why? Say it in terms of what
  the database is doing with 32 simultaneous transactions.
- What would make you split the pool per route, and why isn't that today?

THE RELATIONSHIP WITH THE CALLEE'S OWN LIMIT
- A bulkhead protects the caller. A shedder protects the callee. Different
  jobs — what went wrong when you sized them equal?
- Which one is the "main control" here, and which is the backstop?

WHAT A BULKHEAD DOESN'T DO — the finding that surprised you
- Goodput held flat at every load level. Good. But p50 went 159 -> 609 -> 1183
  -> 2346ms as concurrency doubled, and every one of those returned 200.
  Where did the queue go?
- You traded a fast 503 for a slow 200 without deciding to. Which is better for
  a login box?
- Little's Law predicted all four rows (W = L/lambda). Write the arithmetic out
  once — it's the thing that lets you read off the wait at any load without
  measuring again.

THE THING THAT MAKES IT FRAGILE
- One gateway instance sends at most 4 to auth. Two instances send 8. What does
  a per-caller pool NOT bound?
- What has to be true for these numbers to still be right in six months?
-->
