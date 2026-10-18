import { ReviewPostedPayload } from '@bookverse/shared';
import { config } from '../../config/index.js';
import { notificationService } from '../../services/notification.service.js';
import { Book } from '../../types/api.js';

export const reviewPostedHandler = async (_routingKey: string, payload: unknown) => {
    const reviewEvent = payload as ReviewPostedPayload;
    const { bookId } = reviewEvent;

    // Book owner, reviewer name
    const bookServiceUrl = `${config.gateway.url}/books`;

    const response = await fetch(`${bookServiceUrl}/${bookId}`);
    if (!response.ok) {
        throw { name: 'HttpError', status: response.status };
    }

    const { title, reviewsAvgRating } = (await response.json()).data as Book;
    await notificationService.createNotificationFromEvent({
        bookId,
        bookTitle: title,
        rating: reviewsAvgRating,
        userId: reviewEvent.reviewerId,
        reviewId: reviewEvent.reviewId,
    });
};
