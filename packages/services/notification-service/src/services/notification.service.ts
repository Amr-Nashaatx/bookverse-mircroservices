import { Page, toPage, toSkipTake } from '@bookverse/shared';
import type { Notification } from '../generated/prisma/index.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import type { ListNotificationsQuery, NotificationData } from '../schemas/notification.schemas.js';

// Shape a Prisma Notification (with Date objects) into the serializable response DTO.
function serialize(notification: Notification): NotificationData {
    return {
        id: notification.id,
        reviewId: notification.reviewId,
        bookId: notification.bookId,
        bookTitle: notification.bookTitle,
        rating: notification.rating,
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
};
