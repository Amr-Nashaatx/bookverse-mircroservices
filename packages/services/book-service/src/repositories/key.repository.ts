import prisma from '../lib/prisma.js';

export const keyRepository = {
    async findKeyByAuthorAndId(authorId: string, keyId: string) {
        return await prisma.idempotencyKey.findUnique({ where: { authorId_key: { authorId, key: keyId } } });
    },
};
