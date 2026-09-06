import { ServiceEdgeSpec } from '../proxies/ServiceProxy.js';
import { config } from './index.js';

export const authProxySepc: ServiceEdgeSpec = {
    prefix: '/auth',
    upstream: config.services.auth,
    connections: 4,
    // Login is two bcrypt ops on one event-loop thread (~1.3s for 10 concurrent),
    // so this hop is deliberately the slowest. See docs/decisions/partial-failure/timeouts.md.
    timeoutMs: 2_000,
    forwardsIdentity: false,
};

export const bookProxySepc: ServiceEdgeSpec = {
    prefix: '/books',
    upstream: config.services.book,
    connections: 8,
    timeoutMs: 1_000,
    forwardsIdentity: true,
};

export const reviewProxySpec: ServiceEdgeSpec = {
    prefix: '/reviews',
    upstream: config.services.review,
    connections: 8,
    // Copied from book as a starting point -- re-measure with scripts/sweep.mjs
    // once review-service does more real work.
    timeoutMs: 1_000,
    forwardsIdentity: true,
};
