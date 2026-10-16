import { ApiResponse, authenticateUser } from '@bookverse/shared';
import { notificationService } from '../services/notification.service.js';
import { ListNotificationsQuerySchema, NotificationPageResponseSchema } from '../schemas/notification.schemas.js';
import { FastifyTypeboxInstance } from '../types/fastify.js';

export async function notificationRoutes(fastify: FastifyTypeboxInstance) {
    /*
        PROTECTED: the caller's own notifications, newest first.
        Input:  page (ListNotificationsQuerySchema)
        Output: one page of notifications addressed to request.user
    */
    fastify.get(
        '/',
        {
            preHandler: authenticateUser,
            schema: { querystring: ListNotificationsQuerySchema, response: { 200: NotificationPageResponseSchema } },
        },
        async (request, reply) => {
            const userId = request.user!.id;
            const page = await notificationService.listNotifications(userId, request.query);
            reply.status(200).send(new ApiResponse('notifications fetched', page));
        },
    );
}
