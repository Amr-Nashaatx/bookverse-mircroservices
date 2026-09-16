import { Channel } from 'amqplib';

type HandlerFunc = (routingKey: string, payload: unknown) => Promise<void>;
type QueueConfig = { exchange: string; queue: string; patterns: string[]; prefetch?: number; handler: HandlerFunc };

export async function consumeEvents(channel: Channel, config: QueueConfig) {
    const { exchange, handler, patterns, queue } = config;
    await channel.assertQueue(queue, { durable: true });
    for (const pattern of patterns) await channel.bindQueue(queue, exchange, pattern);
    await channel.prefetch(config.prefetch ?? 20);

    await channel.consume(
        queue,
        async (msg) => {
            if (msg === null) return;
            try {
                await handler(msg.fields.routingKey, JSON.parse(msg.content.toString()));
                channel.ack(msg);
            } catch (err) {
                /* requeue: false — a handler that threw once on this message will throw
                 * again on the same bytes, so requeueing is an infinite loop. */
                console.error(
                    { err, routingKey: msg.fields.routingKey, messageId: msg.properties.messageId },
                    'handler failed, message dropped',
                );
                channel.nack(msg, false, false);
            }
        },
        { noAck: false },
    );
}
