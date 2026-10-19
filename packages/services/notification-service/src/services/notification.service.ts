import { Page, toPage, toSkipTake } from '@bookverse/shared';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import type { Notification } from '../generated/prisma/index.js';
import { NewNotification, notificationRepository } from '../repositories/notification.repository.js';
import type { ListNotificationsQuery, NotificationData } from '../schemas/notification.schemas.js';

// Shape a Prisma Notification (with Date objects) into the serializable response DTO.
function serialize(notification: Notification): NotificationData {
    return {
        id: notification.id,
        type: notification.type,
        message: notification.message,
        // Written only by createFromEvent, always with this flat shape.
        data: notification.data as NotificationData['data'],
        createdAt: notification.createdAt.toISOString(),
    };
}

export const notificationService = {
    /* `userId` is the authenticated caller; the route supplies it from the
     * verified identity, never from the query. */
    async listNotifications(userId: string, query: ListNotificationsQuery): Promise<Page<NotificationData>> {
        const pageQuery = { page: query.page, limit: query.limit, sort: query.sort };
        const { skip, take } = toSkipTake(pageQuery);

        const rows = await notificationRepository.findForUser(userId, { skip, take });
        return toPage(rows.map(serialize), pageQuery);
    },

    /* At-least-once delivery means the same event can arrive twice. The unique
     * eventId refuses the second insert; that is "already have it", so return
     * normally and the message is acked. No check-then-insert: two copies
     * arriving together would both pass the check. */
    async createFromEvent(notification: NewNotification): Promise<void> {
        try {
            await notificationRepository.create(notification);
        } catch (e) {
            if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
                console.log({ eventId: notification.eventId, type: notification.type }, 'duplicate event ignored');
                return;
            }
            throw e;
        }
    },
};
