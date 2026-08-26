# Retrying reads, never writes

<!--
Prompts — delete each as you answer it. Prose, not a template.

THE PROBLEM
- A call failed. You don't know whether the callee did the work or not. What
  makes a read different from a write in that moment?
- "Idempotent" is the textbook word. What does it actually mean for GET /books
  versus POST /books, in your own words?

WHAT YOU CHOSE
- Reads retry up to 3 times, writes never. Where does the write's retry live
  instead? (The user's second click, made safe by the Idempotency-Key.)
- Backoff doubles and is randomised. What happens without the randomness, when
  every caller that failed at the same moment comes back at the same moment?
- You honour Retry-After but cap it at 5s. What would an uncapped 10s
  Retry-After across 3 retries have cost a user on a 1s hop?

THE TWO THINGS THAT BIT YOU — both worth writing down
- The default was 10 retries and nobody chose it. What does a resilience
  setting that arrived by default rather than by decision tell you about the
  rest of your config?
- Your `maxRetriesOn503: 3` type-checked and did nothing for months: the
  library only reads it from the per-request options. One request was making
  eleven calls. How would you catch the next config that compiles but is never
  read? (Note what actually caught this one: counting log lines, not reading
  code.)

THE INTERACTION WITH THE BREAKER
- Retries and the circuit breaker now sit on the same path. Does a request that
  fails three times count as one failure or three?
- You measured the answer rather than choosing it — the hooks fire once per
  logical request. Why is one the right answer anyway, from the user's side?
- A probe is never retried. Why would retrying a probe be actively harmful?

THE COST
- Retries turn one client request into up to four at the callee, at exactly the
  moment it's least able to cope. What made that trade acceptable here?
- What would make you turn retries off?
-->
