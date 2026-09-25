/* Errors worth retrying, from what this stack actually throws.
 * Prisma 7 with the pg driver adapter surfaces connection failures with the Node/pg code
 * (EAI_AGAIN was observed with postgres stopped), not the P1xxx codes in Prisma's error reference. */
const TRANSIENT_CODES = new Set([
    // Prisma engine codes: connection, timeout, pool exhaustion, write conflict ("Please retry your transaction")
    'P1001', 'P1002', 'P1008', 'P1017', 'P2024', 'P2034',
    // Node network errors: DNS, refused, reset, timed out
    'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
    // Postgres SQLSTATE: admin_shutdown (restart kills pooled connections), cannot_connect_now (starting up)
    '57P01', '57P03',
]);

export function isTransientDbError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null || !('code' in err)) return false;
    return typeof err.code === 'string' && TRANSIENT_CODES.has(err.code);
}
