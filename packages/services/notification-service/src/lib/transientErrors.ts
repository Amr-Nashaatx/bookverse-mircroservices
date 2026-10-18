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

export function isTransientFetchError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null || !('name' in err)) return false;
    if (err.name === 'TypeError' || err.name === 'TimeoutError') return true;
    if (err.name === 'HttpError') {
        if (!('status' in err)) return false;
        const codes = [502, 503, 504];
        if (codes.includes(err.status as number)) return true;
    }
    return false;
}
