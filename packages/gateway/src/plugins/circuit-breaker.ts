/*
 * A circuit breaker for ONE callee: when it is clearly failing, stop calling it
 * for a while. Create one per callee -- a shared breaker would mean book-service
 * being down stops logins, the cascade this exists to prevent.
 *
 * Knows nothing about HTTP, and does no logging of its own -- it announces its
 * state changes and whoever wired it decides where those go. Which responses
 * count as failures is decided next to the proxy that made the call.
 * See docs/decisions/overload/circuit-breaker.md.
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

/** Everything the breaker knows at the moment it changes state. */
export type CircuitTransition = {
    breaker: string;
    from: CircuitState;
    to: CircuitState;
    failures: number;
    total: number;
    reason: string;
};

type TransitionListener = (transition: CircuitTransition) => void;

/** One recorded attempt. `at` is what makes the window slide. */
interface Outcome {
    at: number;
    failed: boolean;
}

export class CircuitBreaker {
    private state: CircuitState = 'closed';
    private outcomes: Outcome[] = [];

    /** When we opened, so we know when the cooldown is up. */
    private openedAt = 0;

    /** True while the single half-open probe is still out. */
    private probeInFlight = false;
    private probeSentAt = 0;

    private listeners: TransitionListener[] = [];

    constructor(private options: CircuitBreakerOptions) {}

    /** Told on every state change. Register as many as you like. */
    onTransition(listener: TransitionListener) {
        this.listeners.push(listener);
        return this;
    }

    /** Drop anything older than the window -- what makes it sliding. */
    private prune(now: number): void {
        this.outcomes = this.outcomes.filter((o) => o.at > now - this.options.windowMs);
    }

    private counts(): { failures: number; total: number } {
        const failures = this.outcomes.reduce((n, o) => n + (o.failed ? 1 : 0), 0);
        return { failures, total: this.outcomes.length };
    }

    // The only place `state` is assigned, so every change is logged with the
    // counts that caused it. Never set `state` directly.
    private transitionTo(next: CircuitState, reason: string): void {
        if (next === this.state) return;

        const { failures, total } = this.counts();
        const transition: CircuitTransition = {
            breaker: this.options.name,
            from: this.state,
            to: next,
            failures,
            total,
            reason,
        };

        for (const notify of this.listeners) {
            // Swallowed on purpose: a listener that throws  a logger with a
            // bad stream must not leave the breaker mid-transition.
            try {
                notify(transition);
            } catch {}
        }

        // state transitions
        let closedToOpen = next === 'open' && this.state === 'closed';
        let halfOpenToOpen = next === 'open' && this.state === 'half-open';
        let openTopHalfOpen = next === 'half-open' && this.state === 'open';
        let halfOpenToClosed = next === 'closed' && this.state === 'half-open';

        if (closedToOpen) this.openedAt = Date.now();
        else if (halfOpenToOpen) {
            this.openedAt = Date.now();
            this.probeInFlight = false;
        } else if (openTopHalfOpen) {
            this.probeInFlight = false;
        } else if (halfOpenToClosed) {
            this.probeInFlight = false;
            this.outcomes = [];
        }

        this.state = next;
    }

    private shouldOpen(now: number): boolean {
        this.prune(now);
        const { failures, total } = this.counts();

        // The volume floor comes FIRST -- a rate computed from two samples is noise.
        if (total < this.options.minimumRequests) return false;

        return failures / total >= this.options.failureRateThreshold;
    }

    /** Call before making the request. False means: do not call the callee. */
    allowRequest(): 'allowed' | 'refused' | 'probe' {
        const now = Date.now();

        if (this.state === 'open') {
            // Checked when someone asks rather than on a timer -- nothing to
            // cancel on shutdown, and an idle circuit costs nothing.
            if (now - this.openedAt < this.options.cooldownMs) return 'refused';
            this.transitionTo('half-open', 'cooldown elapsed');
        }

        if (this.state === 'half-open') {
            // Exactly one probe at a time. The timeout is what stops a probe
            // that never reports back from wedging the circuit shut forever.
            if (this.probeInFlight && now - this.probeSentAt < this.options.probeTimeoutMs) return 'refused';
            this.probeInFlight = true;
            this.probeSentAt = Date.now();
            return 'probe';
        }

        return 'allowed';
    }

    /** The attempt came back healthy. */
    recordSuccess(): void {
        // In half-open this is the probe reporting clean; elsewhere it is
        // just bookkeeping. Only the former moves the state.
        this.outcomes.push({ at: Date.now(), failed: false });
        if (this.state === 'half-open') {
            this.transitionTo('closed', 'probe success');
        }
    }

    /** The attempt failed. `reason` is only for the transition log. */
    recordFailure(reason: string): void {
        const now = Date.now();

        // A failed probe is the whole answer on its own -- no threshold needed.
        this.outcomes.push({ at: now, failed: true });
        if (this.state === 'half-open') this.transitionTo('open', 'probe failed');
        else if (this.shouldOpen(now)) this.transitionTo('open', reason);
    }

    /** Lets you see the state rather than infer it. */
    snapshot(): { state: CircuitState; failures: number; total: number } {
        this.prune(Date.now());
        return { state: this.state, ...this.counts() };
    }
}
