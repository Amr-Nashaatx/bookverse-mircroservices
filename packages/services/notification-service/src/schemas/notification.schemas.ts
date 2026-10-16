import { pageQueryProps, pageSchema } from '@bookverse/shared';
import { Type, Static } from '@sinclair/typebox';

/* One ordering: a notification list is read newest first, nobody browses it
 * any other way. The page half is the same contract every list answers with. */
export const NotificationSortValues = ['newest'] as const;

export const ListNotificationsQuerySchema = Type.Object({
    ...pageQueryProps({ sortValues: NotificationSortValues, defaultSort: 'newest', defaultLimit: 20, maxLimit: 50 }),
});
export type ListNotificationsQuery = Static<typeof ListNotificationsQuerySchema>;

// Response Schemas — no userId: a caller only ever sees their own.
export const NotificationSchema = Type.Object({
    id: Type.String({ format: 'uuid' }),
    reviewId: Type.String(),
    bookId: Type.String(),
    bookTitle: Type.String(),
    rating: Type.Integer(),
    createdAt: Type.String({ format: 'date-time' }),
});

// `data` is Optional to mirror the shared ApiResponse contract (`data?: T`).
export const NotificationPageResponseSchema = Type.Object({
    timestamp: Type.String({ format: 'date-time' }),
    message: Type.String(),
    data: Type.Optional(pageSchema(NotificationSchema)),
});

// Inferred types
export type NotificationData = Static<typeof NotificationSchema>;
