const TRANSIENT_CODES = new Set([
    // Prisma engine codes: connection, timeout, pool exhaustion, write conflict ("Please retry your transaction")
    'P1001',
    'P1002',
    'P1008',
    'P1017',
    'P2024',
    'P2034',
    // Node network errors: DNS, refused, reset, timed out
    'EAI_AGAIN',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    // Postgres SQLSTATE: admin_shutdown (restart kills pooled connections), cannot_connect_now (starting up)
    '57P01',
    '57P03',
]);

export function isTransientDbError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null || !('code' in err)) return false;
    return typeof err.code === 'string' && TRANSIENT_CODES.has(err.code);
}

/* A non-2xx answer from another service. fetch resolves on those rather than
 * throwing, so this turns one into something the retry can classify. */
export class HttpError extends Error {
    constructor(readonly status: number) {
        super(`HTTP ${status}`);
        this.name = 'HttpError';
    }
}

// The gateway answered, but could not get an answer from the service behind it.
const TRANSIENT_HTTP_STATUSES = new Set([502, 503, 504]);

export function isTransientFetchError(err: unknown): boolean {
    if (err instanceof HttpError) return TRANSIENT_HTTP_STATUSES.has(err.status);
    // fetch rejects with TypeError('fetch failed') when it cannot reach the host at all.
    // Any other TypeError is a bug in our code, and retrying a bug only delays the dead letter.
    if (err instanceof TypeError) return err.message === 'fetch failed';
    // AbortSignal.timeout expired.
    return err instanceof Error && err.name === 'TimeoutError';
}
