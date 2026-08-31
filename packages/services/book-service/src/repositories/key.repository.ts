import prisma from '../lib/prisma.js';

export const keyRepository = {
    async findKeyByOwnerAndId(ownerUserId: string, keyId: string) {
        return await prisma.idempotencyKey.findUnique({ where: { ownerUserId_key: { ownerUserId, key: keyId } } });
    },
};
