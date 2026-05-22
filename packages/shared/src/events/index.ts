export const Events = {
    BOOK_CREATED: 'book.created',
    REVIEW_CREATED: 'review.created',
    // ... more later
} as const;

export type BookCreatedPayload = {
    bookId: string;
    authorId: string;
    title: string;
};

// .. more payloads later
