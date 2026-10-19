export const Queues = {
    NOTIFICATIONS_REVIEWS: 'notifications.reviews',
    // Shared by every notification queue: they all dead-letter to notifications.dlx.
    NOTIFICATIONS_DLQ: 'notifications.dlq',
} as const;
