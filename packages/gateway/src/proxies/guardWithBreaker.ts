import { CircuitBreaker } from '../plugins/circuit-breaker.js';
import { ServiceProxy } from './ServiceProxy.js';

/*
 * The seam between the two: the breaker counts outcomes and knows nothing about
 * HTTP, the proxy carries requests and knows nothing about breakers. This is the
 * only place that decides which upstream responses mean the callee is sick.
 *
 */
export function guardWithBreaker(proxy: ServiceProxy, breaker: CircuitBreaker) {
    // `refused` means the circuit is open. `probe` means this one request is the
    // half-open trial, which the proxy must not retry.
    proxy.addPreHandlerLogic(async (request, reply) => {
        const result = breaker.allowRequest();
        if (result === 'refused') return reply.status(503).header('retry-after', 1).send();
        if (result === 'probe') request.isProbe = true;
    });

    // A probe is one request by definition -- retrying it would aim more traffic
    // at a callee we already believe is sick.
    proxy.vetoRetries((request) => request.isProbe);

    // Observers only: ServiceProxy owns the single send.
    proxy.addResponseObserver((_request, response) => {
        const breakStatuscodes = [503, 504];
        if (breakStatuscodes.includes(response.statusCode)) {
            return breaker.recordFailure(`Response with status ${response.statusCode}`);
        }

        // 500 is ambiguous -- it can be one bad input rather than a sick service.
        // Recorded as neither success nor failure.
        if (response.statusCode === 500) return;

        breaker.recordSuccess();
    });

    proxy.addErrorObserver((_request, error) => breaker.recordFailure(`Request error: ${error.message}`));

    return proxy;
}
