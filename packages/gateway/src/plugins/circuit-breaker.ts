import { FastifyBaseLogger } from 'fastify';

/*
 * A circuit breaker for ONE callee: when it is clearly failing, stop calling it
 * for a while. Create one per callee -- a shared breaker would mean book-service
 * being down stops logins, the cascade this exists to prevent.
 *
 * Knows nothing about HTTP. Which responses count as failures is decided next to
 * the proxy that made the call. See docs/decisions/overload/circuit-breaker.md.
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
    /** Which callee this breaker guards. Only used in logs -- make it readable. */
    name: string;

    /** How far back we look when judging health. With minimumRequests, this sets
     *  a minimum traffic rate: below it, evidence expires before it accumulates
     *  and the breaker can never open. */
    windowMs: number;

    /** Fewest results in the window before the failure rate means anything.
     *  Without this, one failed request on a quiet morning is a 100% failure rate. */
    minimumRequests: number;

    /** Failure rate at or above which we open. 0.5 = half of them failing. */
    failureRateThreshold: number;

    /** How long before a silent probe is assumed lost and another is let through.
     *  Must exceed how long a request can take, or every caller becomes a probe. */
    probeTimeoutMs: number;

    /** How long we stay open before allowing a single probe through. */
    cooldownMs: number;
}

/** One recorded attempt. `at` is what makes the window slide. */
interface Outcome {
    at: number;
    failed: boolean;
}

export interface CircuitBreaker {
    /** Call before making the request. False means: do not call the callee. */
    allowRequest(): 'allowed' | 'refused' | 'probe';
    /** The attempt came back healthy. */
    recordSuccess(): void;
    /** The attempt failed. `reason` is only for the transition log. */
    recordFailure(reason: string): void;
    /** Lets you see the state rather than infer it. */
    snapshot(): { state: CircuitState; failures: number; total: number };
}

export function createCircuitBreaker(options: CircuitBreakerOptions, log: FastifyBaseLogger): CircuitBreaker {
    let state: CircuitState = 'closed';
    let outcomes: Outcome[] = [];

    /** When we opened, so we know when the cooldown is up. */
    let openedAt = 0;

    /** True while the single half-open probe is still out. */
    let probeInFlight = false;
    let probeSentAt = 0;

    /** Drop anything older than the window -- what makes it sliding. */
    function prune(now: number): void {
        outcomes = outcomes.filter((o) => o.at > now - options.windowMs);
    }

    function counts(): { failures: number; total: number } {
        const failures = outcomes.reduce((n, o) => n + (o.failed ? 1 : 0), 0);
        return { failures, total: outcomes.length };
    }

    // The only place `state` is assigned, so every change is logged with the
    // counts that caused it. Never set `state` directly.
    function transitionTo(next: CircuitState, reason: string): void {
        if (next === state) return;

        const { failures, total } = counts();
        log.warn({ breaker: options.name, from: state, to: next, failures, total, reason }, 'circuit breaker');

        // state transitions
        let closedToOpen = next === 'open' && state === 'closed';
        let halfOpenToOpen = next === 'open' && state === 'half-open';
        let openTopHalfOpen = next === 'half-open' && state === 'open';
        let halfOpenToClosed = next === 'closed' && state === 'half-open';

        if (closedToOpen) openedAt = Date.now();
        else if (halfOpenToOpen) {
            openedAt = Date.now();
            probeInFlight = false;
        } else if (openTopHalfOpen) {
            probeInFlight = false;
        } else if (halfOpenToClosed) {
            probeInFlight = false;
            outcomes = [];
        }

        state = next;
    }

    function shouldOpen(now: number): boolean {
        prune(now);
        const { failures, total } = counts();

        // The volume floor comes FIRST -- a rate computed from two samples is noise.
        if (total < options.minimumRequests) return false;

        return failures / total >= options.failureRateThreshold;
    }

    return {
        allowRequest(): 'allowed' | 'refused' | 'probe' {
            const now = Date.now();

            if (state === 'open') {
                // Checked when someone asks rather than on a timer -- nothing to
                // cancel on shutdown, and an idle circuit costs nothing.
                if (now - openedAt < options.cooldownMs) return 'refused';
                transitionTo('half-open', 'cooldown elapsed');
            }

            if (state === 'half-open') {
                // Exactly one probe at a time. The timeout is what stops a probe
                // that never reports back from wedging the circuit shut forever.
                if (probeInFlight && now - probeSentAt < options.probeTimeoutMs) return 'refused';
                probeInFlight = true;
                probeSentAt = Date.now();
                return 'probe';
            }

            return 'allowed';
        },

        recordSuccess(): void {
            // In half-open this is the probe reporting clean; elsewhere it is
            // just bookkeeping. Only the former moves the state.
            outcomes.push({ at: Date.now(), failed: false });
            if (state === 'half-open') {
                transitionTo('closed', 'probe success');
            }
        },

        recordFailure(reason: string): void {
            const now = Date.now();

            // A failed probe is the whole answer on its own -- no threshold needed.
            outcomes.push({ at: now, failed: true });
            if (state === 'half-open') transitionTo('open', 'probe failed');
            else if (shouldOpen(now)) transitionTo('open', reason);
        },

        snapshot() {
            prune(Date.now());
            return { state, ...counts() };
        },
    };
}
