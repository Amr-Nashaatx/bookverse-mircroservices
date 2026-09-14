import { Channel } from 'amqplib';
import { randomUUID } from 'node:crypto';

export function publishEvent(channel: Channel, exchange: string, routingKey: string, payload: unknown): boolean {
    return channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
        contentType: 'application/json',
        messageId: randomUUID(),
        timestamp: Date.now(),
    });
}
