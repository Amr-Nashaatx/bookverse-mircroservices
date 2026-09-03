import { CircuitBreaker } from '../plugins/circuit-breaker.js';

export const bookServiceBreaker = new CircuitBreaker({
    minimumRequests: 10,
    failureRateThreshold: 0.5,
    name: 'book-service',
    // book's hop timeout is 1s and probes are never retried.
    probeTimeoutMs: 2_000,
    // With minimumRequests this sets a minimum traffic rate: at 10_000 it
    // demanded a sustained 1 req/sec we do not have, so it could never open.
    windowMs: 60_000,
    cooldownMs: 50_000,
});
