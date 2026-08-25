# The circuit breaker

<!--
Prompts — delete each as you answer it. Prose, not a template.

THE PROBLEM
- A saturated service doesn't return errors. It returns 200 OK, correct body,
  four seconds late. What does that do to a breaker that counts error
  responses?
- So what actually converts "slow" into something countable? Follow that back
  to why you set per-hop timeouts in the first place.

WHAT COUNTS AS A FAILURE
- Timeouts and connection errors: yes. 4xx: no — say why counting them would
  lock everyone out during a spike of bad requests.
- 500 is the interesting one. You decided it means neither success nor failure.
  Write down the argument, including the sharp version: "doesn't mean
  unhealthy" is not the same claim as "means healthy", and recording it as a
  success would let fast errors mask slow ones.
- What does your failure rate threshold already protect against, that you were
  tempted to solve with the classification instead?

THE THREE NUMBERS — this is the exercise
For each of windowMs, minimumRequests, failureRateThreshold, cooldownMs: what
does it cost at double, and at half? Not the value — the consequence.
- The one you found the hard way: windowMs and minimumRequests together set a
  MINIMUM TRAFFIC RATE. At 10s/10 you needed a sustained 1 req/sec or the
  breaker could never open at all. How did you discover that? (You couldn't
  trip it by hand — and that was the finding, not the obstacle.)
- cooldownMs vs windowMs: what did clearing the window on close buy you, and
  what would have happened without it?

HALF-OPEN
- Exactly one probe. What happens to a recovering service if you send the flood
  that's been waiting?
- The probe is never retried. Why?
- The probe slot is released on a timeout as well as on a verdict. What breaks
  if it isn't? (You'd met the same bug before as a counter that only went up.)

SCOPE
- One breaker per callee. Say what a single shared breaker would do the first
  time book-service went down.
- What would you have to change to run two gateway instances? What does each
  instance know about the other's opinion of a callee?

WHAT IT COST
- What does an open circuit do to a user, and is that better or worse than what
  they had before?
-->
