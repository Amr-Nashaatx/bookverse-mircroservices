import { CircuitBreaker } from '../plugins/circuit-breaker.js';

export const authServiceBreaker = new CircuitBreaker({
    minimumRequests: 10,
    failureRateThreshold: 0.5,
    name: 'auth-service',
    // auth's hop timeout is 2s.
    probeTimeoutMs: 3_000,
    windowMs: 60_000,
    cooldownMs: 50_000,
});
