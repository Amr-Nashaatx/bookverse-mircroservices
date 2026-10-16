import { CircuitBreaker } from '../plugins/circuit-breaker.js';

export const notificationServiceBreaker = new CircuitBreaker({
    minimumRequests: 10,
    failureRateThreshold: 0.5,
    name: 'notification-service',
    // notification's hop timeout is 1s and probes are never retried.
    probeTimeoutMs: 2_000,
    windowMs: 60_000,
    cooldownMs: 50_000,
});
