# Deferred: request deadlines and admission control

<!--
Prompts — delete each as you answer it. Prose, not a template.
This note records something NOT built, and why. That's worth as much as the
ones that were: it stops the next person rediscovering it badly.

THE MEASUREMENT THAT STARTED IT
- Sixteen concurrent logins. Users waited 2346ms (p99 2476ms) against a hop
  timeout set to 2000ms — and the gateway returned ZERO 504s. Write down what
  that means: we reported success on requests that had already blown the budget
  we set for them.
- Where does the clock start, and where should it start? Say plainly why "each
  hop is bounded" and "the user's wait is bounded" are different claims.

THE ATTEMPT THAT DID NOTHING
- You stamped a deadline on arrival and clamped the hop timeout to what was
  left. It changed nothing. Why? (The handler runs on ARRIVAL, before the pool
  makes anything wait — so there was never any elapsed time to subtract.)
- The lesson to keep: a deadline pays nothing until something WAITS before
  dispatching. It and admission control are one feature, not two.

THE DESIGN YOU LANDED ON — and the one you rejected
- First design: bound the queue using Little's Law, refuse when L/lambda
  exceeds the request's remaining budget. Why did you back away from it?
- The objection was operational, and it's the interesting part: a completion
  rate in config is a snapshot that goes wrong SILENTLY when the work gets
  slower. Say what that costs compared to the alternative.
- The version that needs no capacity number: hold the queue yourself, wait for
  a slot for at most the remaining budget, refuse if the wait runs out.
- What that version gives up: the refusal is slow, not early. Saying no EARLY
  requires predicting the wait, and prediction requires either a configured
  capacity or a measured one. If you ever want it, measure (rolling median of
  dispatched-minus-enqueued), don't configure.

WHY DEFERRED
- What does the system do today instead, and why is that acceptable at this
  traffic?
- What would have to happen for this to be worth building? Name the trigger
  concretely enough that you'd recognise it.
-->
