import { ServiceEdgeSpec } from '../proxies/ServiceProxy.js';
import { config } from './index.js';

export const authProxySepc: ServiceEdgeSpec = {
    prefix: '/auth',
    upstream: config.services.auth,
    connections: 4,
    forwardsIdentity: false,
};

export const bookProxySepc: ServiceEdgeSpec = {
    prefix: '/books',
    upstream: config.services.book,
    connections: 8,
    forwardsIdentity: true,
};

export const reviewProxySpec: ServiceEdgeSpec = {
    prefix: '/reviews',
    upstream: config.services.review,
    connections: 8,
    forwardsIdentity: true,
};
