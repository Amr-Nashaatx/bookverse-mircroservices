import prisma from '../lib/prisma.js';

export type NotificationPageOptions = { take: number; skip: number };

export const notificationRepository = {
    /* Newest first, ending with `id`: two notifications created in the same
     * millisecond would otherwise land on both pages, or neither. Served by the
     * (userId, createdAt DESC, id) index. */
    async findForUser(userId: string, page: NotificationPageOptions) {
        return prisma.notification.findMany({
            where: { userId },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
            skip: page.skip,
            take: page.take,
        });
    },
};
