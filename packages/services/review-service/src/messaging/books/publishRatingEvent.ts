import { getChannel, publishEvent, ReviewEvents, REVIEWS_EXCHANGE } from '@bookverse/shared';

type ReviewEvent = keyof typeof ReviewEvents;
export async function publishRatingEvent(
    bookId: string,
    event: ReviewEvent,
    aggregates: { count: number; avgRating: number | null; version: number },
) {
    try {
        const channel = getChannel();
        publishEvent(channel, REVIEWS_EXCHANGE, ReviewEvents[event], { ...aggregates, bookId });
    } catch (err) {
        console.error({ err, bookId, event }, 'rating event not published');
    }
}
