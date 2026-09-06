import { AppError } from '@bookverse/shared';
import { config } from '../config/index.js';
import { CircuitBreaker } from '../plugins/circuit-breaker.js';

export interface RequestSpec {
    id: string;
    url: string;
    timeoutMs: number;
    breaker?: CircuitBreaker;
}
/**
 * The envelope every BookVerse service answers in. The payload the caller
 * actually wants is one level down, in `data`.
 */
export type ApiEnvelope<T = unknown> = { timestamp: string; message: string; data: T };

/**
 * `T` defaults to `unknown` rather than `any` on purpose: a caller that does not
 * say what it expects has to narrow before it can use the payload.
 */
export type FetchResult<T = unknown> =
    | { ok: true; specId: string; data: ApiEnvelope<T> }
    | { ok: false; specId: string; error: AppError };

export async function fetchWithTimeout<T = unknown>(spec: RequestSpec): Promise<FetchResult<T>> {
    try {
        const response = await fetch(spec.url, {
            signal: AbortSignal.timeout(spec.timeoutMs),
            headers: { 'x-gateway-secret': config.secrets.gatewaySecret },
        });
        if (!response.ok) {
            throw response;
        }
        // The one unchecked step in the file, and it is unavoidable: the wire
        // gives us bytes and we assert a shape. Everything downstream is checked.
        const json = (await response.json()) as ApiEnvelope<T>;
        return { ok: true, specId: spec.id, data: json };
    } catch (err) {
        if (err instanceof DOMException && err.name === 'TimeoutError') {
            const timedOut = new AppError(`${spec.id} timed out after ${spec.timeoutMs}ms`, 504);
            return { ok: false, specId: spec.id, error: timedOut };
        }

        if (err instanceof Response) {
            return { ok: false, specId: spec.id, error: new AppError(`could not fetch ${spec.id}`, err.status) };
        }

        // No response at all -- DNS, connection refused, socket reset. The cause
        // is kept in the message because handleFailure builds a fresh error for
        // the client and this one only ever reaches the log.
        const cause = err instanceof Error ? err.message : String(err);
        return { ok: false, specId: spec.id, error: new AppError(`${spec.id} unreachable: ${cause}`, 503) };
    }
}
