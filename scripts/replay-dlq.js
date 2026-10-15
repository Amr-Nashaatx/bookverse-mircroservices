import { config } from 'dotenv';
import amqplib from 'amqplib';

config({ path: '.env.dev' });

const { RABBITMQ_DEFAULT_USER, RABBITMQ_DEFAULT_PASS } = process.env;
const URL = `amqp://${RABBITMQ_DEFAULT_USER}:${RABBITMQ_DEFAULT_PASS}@localhost:5672`;

const DLQ = 'reviews.dlq';
const TARGET = 'reviews';

const conn = await amqplib.connect(URL);
const ch = await conn.createConfirmChannel();

const { messageCount } = await ch.checkQueue(DLQ);

// Reply all messages no filter.
for (let i = 0; i < messageCount; i++) {
    const msg = await ch.get(DLQ, { noAck: false });
    if (!msg) break;

    ch.publish('', TARGET, msg.content, msg.properties);

    await ch.waitForConfirms();

    ch.ack(msg);
}

console.log(`Republished ${messageCount} messages`);

await ch.close();
await conn.close();
