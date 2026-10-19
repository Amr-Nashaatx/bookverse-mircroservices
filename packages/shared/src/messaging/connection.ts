import amqp, { Channel, RecoveringChannelModel, ChannelModel } from 'amqplib';
import { ConfirmChannel } from 'amqplib';

type SetupFunc = (channel: Channel) => Promise<void>;

let model: RecoveringChannelModel | undefined;
let channel: Channel | undefined;
let confirmChannel: ConfirmChannel | undefined;

export async function connectBroker(url: string, setup: SetupFunc) {
    model = await amqp.connect(url, {
        recovery: {
            setup: async (m: ChannelModel) => {
                channel = await m.createChannel();
                confirmChannel = await m.createConfirmChannel();
                await setup(channel);
            },
        },
    });

    model.on('reconnect-scheduled', (i) => console.warn(i, 'amqp reconnect scheduled'));
    model.on('disconnect', (err) => console.error({ err }, 'amqp disconnected'));

    return model;
}

export function getChannel() {
    if (!channel) throw new Error('broker not connected');
    return channel;
}

export function getConfirmChannel() {
    if (!confirmChannel) throw new Error('broker not connected');
    return confirmChannel;
}

export async function disconnectBroker() {
    await model?.close();
}
