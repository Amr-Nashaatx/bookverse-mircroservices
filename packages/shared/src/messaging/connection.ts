import amqp, { Channel, RecoveringChannelModel, ChannelModel } from 'amqplib';

type SetupFunc = (channel: Channel) => Promise<void>;

let model: RecoveringChannelModel | undefined;
let channel: Channel | undefined;

export async function connectBroker(url: string, setup: SetupFunc) {
    model = await amqp.connect(url, {
        recovery: {
            setup: async (m: ChannelModel) => {
                channel = await m.createChannel();
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
export async function disconnectBroker() {
    await model?.close();
}
