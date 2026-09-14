import amqp, { Channel, RecoveringChannelModel } from 'amqplib';

type SetupFunc = (channel: Channel) => Promise<void>;

let model: RecoveringChannelModel | undefined;

export async function connectBroker(url: string, setup: SetupFunc) {
    model = await amqp.connect(url, {
        recovery: {
            setup: async (m: RecoveringChannelModel) => {
                const channel = await m.createChannel();
                await setup(channel);
            },
        },
    });

    model.on('reconnect-scheduled', (i) => console.warn(i, 'amqp reconnect scheduled'));
    model.on('disconnect', (err) => console.error({ err }, 'amqp disconnected'));

    return model;
}

export async function disconnectBroker() {
    model?.close();
}
