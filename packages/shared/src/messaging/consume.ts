import { Channel } from 'amqplib';

type HandlerFunc = (routingKey: string, payload: unknown) => Promise<void>;
export type QueueConfig = {
    exchange: string;
    queue: string;
    patterns: string[];
    prefetch?: number;
    dlx?: string;
    handler?: HandlerFunc;
    // Which errors are worth retrying is the handler's knowledge (its DB, its driver), not the broker's.
    isTransient?: (err: unknown) => boolean;
    // Budget is time, not attempts: it must outlast the outage it is meant to absorb.
    retryBudgetMs?: number;
};

function backoffDelay(attempt: number, base = 100, cap = 2000) {
    const exp = Math.min(cap, base * 2 ** attempt);
    return Math.random() * exp; // full jitter
}

/* Retries transient failures until the deadline; rethrows the last error otherwise.
 * Deadline-based rather than count-based because a failing attempt against a down DB
 * can itself take seconds (DNS), so N attempts has no fixed duration. */
async function withRetry(fn: () => Promise<void>, isTransient: (err: unknown) => boolean, budgetMs: number) {
    const deadline = Date.now() + budgetMs;
    for (let attempt = 0; ; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const delay = backoffDelay(attempt);
            if (!isTransient(err) || Date.now() + delay > deadline) throw err;
            await new Promise((r) => setTimeout(r, delay));
        }
    }
}

export async function consumeEvents(channel: Channel, config: QueueConfig) {
    const { exchange, handler, patterns, queue } = config;
    await channel.assertQueue(queue, {
        durable: true,
        arguments: { ...(config.dlx && { 'x-dead-letter-exchange': config.dlx }) },
    });
    // Pattern tells the exchange which messages should be sent to the queue
    for (const pattern of patterns) await channel.bindQueue(queue, exchange, pattern);
    await channel.prefetch(config.prefetch ?? 20);

    if (!handler) return;
    const isTransient = config.isTransient ?? (() => false);
    const budgetMs = config.retryBudgetMs ?? 0;
    await channel.consume(
        queue,
        async (msg) => {
            if (msg === null) return;
            const started = Date.now();
            try {
                // JSON.parse inside the retried fn: a parse error is deterministic, so it fails fast.
                await withRetry(
                    () => handler(msg.fields.routingKey, JSON.parse(msg.content.toString())),
                    isTransient,
                    budgetMs,
                );
                channel.ack(msg);
            } catch (err) {
                /* Deterministic, or transient past its budget. requeue: false dead-letters it
                 * (reason: rejected) when the queue has a DLX, and drops it when it has none. */
                console.error(
                    {
                        err,
                        routingKey: msg.fields.routingKey,
                        messageId: msg.properties.messageId,
                        transient: isTransient(err),
                        elapsedMs: Date.now() - started,
                    },
                    config.dlx ? 'handler failed, message dead-lettered' : 'handler failed, message dropped',
                );
                channel.nack(msg, false, false);
            }
        },
        { noAck: false },
    );
}
