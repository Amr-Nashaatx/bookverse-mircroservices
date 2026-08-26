# The circuit breaker

## What and Why?

Circuit breakers protect the caller from making requests and using resources on a dead or overloaded service. i implemented a breaker that has 3 states 'closed' | 'open' | 'half-open'.
Typically it goes like this, as long as the breaker is closed it allows all requests through nothing new. It only starts when failures are reported and exceeded a specified threshold, in our case it is failureRateThreshold it then opens and wait for specified time namely cooldownMs in our case, after the cooldown time passes it goes to half-open state and allows only one probe request if it succeeds it means service is healthy and the breaker closes again if failed it opens and lets no requests through.

## What counts as a failure?

Timeouts and connection errors, so status codes like (503, 504) are considered failures while 4xx are not they are very normal requests they don't report a dead or overloaded service.
A special case is 500 which i chose to mean neither success nor failure, server errors do not give a clear signal for this matter.

## Scope

I use one circuit breaker per callee or service, because each service has totally different gauges and measurements, so no one fits all here.
