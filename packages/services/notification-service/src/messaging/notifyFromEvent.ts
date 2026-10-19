import { MessageMeta, ReviewEvents } from '@bookverse/shared';
import { notificationService } from '../services/notification.service.js';
import { reviewPosted } from './reviews/reviewPosted.js';
import type { NotificationBuilder } from './types.js';

/* Routing key → builder. A new kind of notification is one entry here, one
 * builder file, and a binding for its key. */
const builders: Record<string, NotificationBuilder> = {
    [ReviewEvents.REVIEW_POSTED]: reviewPosted,
};

/* The handler every notification queue uses. It knows nothing about any one
 * kind of notification; the builder for the routing key does. */
export async function notifyFromEvent(routingKey: string, payload: unknown, meta: MessageMeta) {
    const build = builders[routingKey];
    // Both are deterministic: a retry will not add a builder or a messageId. Dead-letter them.
    if (!build) throw new Error(`no notification builder for "${routingKey}"`);
    if (!meta.messageId) throw new Error(`"${routingKey}" message has no messageId`);

    const draft = await build(payload);
    if (!draft) return;

    await notificationService.createFromEvent({ ...draft, type: routingKey, eventId: meta.messageId });
}
