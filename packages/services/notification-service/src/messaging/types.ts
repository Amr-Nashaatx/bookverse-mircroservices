/* What a builder decides about one event: who is told, and what. */
export type NotificationDraft = {
    userId: string;
    message: string;
    // Flat on purpose: ids and small values a client links with, not a copy of the event.
    data: Record<string, string | number | boolean | null>;
};

/* One per notification type. Turns an event payload into a draft, or null when
 * there is nobody to tell. */
export type NotificationBuilder = (payload: unknown) => Promise<NotificationDraft | null>;
