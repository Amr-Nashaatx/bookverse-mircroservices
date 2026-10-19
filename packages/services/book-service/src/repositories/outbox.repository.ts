import prisma from '../lib/prisma.js';

export const OutboxStore = {
    async fetchUnsent(limit: number) {
        // Oldest first. Not commit order (ids are handed out at insert), and it doesn't need to be:
        // nothing is skipped, because a row stays unsent until it is confirmed.
        return await prisma.outbox.findMany({ where: { sentAt: null }, orderBy: { id: 'asc' }, take: limit });
    },
    async markSent(ids: number[]) {
        await prisma.outbox.updateMany({ where: { id: { in: ids } }, data: { sentAt: new Date() } });
    },
};
