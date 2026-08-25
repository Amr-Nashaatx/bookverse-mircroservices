# Load shedding in auth-service

<!--
Prompts — delete each as you answer it. Prose, not a template.

THE PROBLEM
- What actually happens to auth-service past ~4 concurrent logins, and why is
  bcrypt on a single thread the whole reason?
- Say plainly why more load past that point buys queue time instead of
  throughput. The response-time curve, in words.

FINDING THE NUMBER
- How did you measure capacity, and why does the answer move between runs
  (4.2-6.7/sec)? What do you do with a number that drifts?
- limit = capacity x the latency you're willing to serve. Show your arithmetic,
  and say which two facts the 8 depends on.
- Why does the limit sit ABOVE the gateway's pool of 4 rather than equal to it?
  What did you lose when they were equal?

THE PART MOST PEOPLE GET WRONG — this is the transferable bit
- You tried two symptom signals first. Write down the measurement: healthy
  reads 198ms, fully collapsed reads 226ms. Why is that fatal?
- The rule it generalises to: a signal that saturates cannot measure a quantity
  that keeps growing. Where else might you hit that?
- Why count directly instead? And when would you have no choice but a symptom?

OPERATING IT
- Which routes must always answer, and what happens to a shedding service in an
  orchestrator if /health is not one of them?
- Liveness and readiness are different questions. Which one is "not right now"?
- What does the user see? Why must it not read like a rejected password?
- Once the limiter is on, in-flight pins at the limit. So what actually tells
  you how much demand you're refusing?
- Retry-After: you had to go and find what consumes it. What did you find, and
  what would have happened if the gateway had retried the shed 503?

THE COST — the honest part
- The A/B: at moderate overload the limiter bought no goodput at all, only
  latency. At heavy overload it was 4-18x. Explain why, in terms of when work
  starts being wasted.
- So what is a limiter actually for? (Hint: it doesn't add capacity.)
-->
