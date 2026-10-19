import { ConfirmChannel } from 'amqplib';
import { publishEvent } from './publish.js';

export type OutboxRow = { id: number; eventId: string; exchange: string; routingKey: string; payload: unknown };

export type OutboxStore = {
    fetchUnsent(limit: number): Promise<OutboxRow[]>;
    markSent(ids: number[]): Promise<void>;
};

/* Starts the loop; returns a stop function for shutdown. */
export function startRelay(
    store: OutboxStore,
    getChannel: () => ConfirmChannel,
    opts: { intervalMs: number; batchSize: number },
): () => void {
    let stopped = false;
    let timer: NodeJS.Timeout | undefined;

    async function processBatch() {
        try {
            const unsentEvents = await store.fetchUnsent(opts.batchSize);
            if (unsentEvents.length === 0) return;

            const channel = getChannel();
            for (const event of unsentEvents) {
                const { exchange, routingKey, payload } = event;
                publishEvent(channel, exchange, routingKey, payload, event.eventId);
            }

            // Mark only after RabbitMQ confirms. If this rejects, nothing is marked and the whole
            // batch goes again next tick: some of it twice, none of it lost.
            await channel.waitForConfirms();
            await store.markSent(unsentEvents.map((event) => event.id));
        } catch (error) {
            // Broker down, channel closed, database down: the rows stay unsent for the next tick.
            console.error('Relay failed: ', error);
        } finally {
            // Scheduled after the tick ends, so a slow tick never overlaps the next one.
            if (!stopped) timer = setTimeout(processBatch, opts.intervalMs);
        }
    }

    timer = setTimeout(processBatch, opts.intervalMs);
    return () => {
        stopped = true;
        clearTimeout(timer);
    };
}
