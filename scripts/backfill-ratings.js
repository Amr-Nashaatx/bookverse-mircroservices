import { PrismaClient as BookClient } from '../packages/services/book-service/src/generated/prisma/client.js';
import { PrismaClient as ReviewClient } from '../packages/services/review-service/src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolveService } from './lib/service-db.mjs';

function connect(name, Client) {
    const { url } = resolveService(name);
    return new Client({ adapter: new PrismaPg({ connectionString: url }) });
}

const bookClient = connect('books', BookClient);
const reviewsClient = connect('reviews', ReviewClient);

async function aggregateReviewesPerBook() {
    let reviews = await reviewsClient.review.groupBy({
        by: ['bookId'],
        _avg: {
            rating: true,
        },
        _count: {
            rating: true,
        },
    });

    return reviews;
}

async function updateRatings() {
    const queries = [];
    const groups = await aggregateReviewesPerBook();

    for (const group of groups) {
        const updateQuery = bookClient.book.update({
            where: { id: group.bookId },
            data: {
                reviewsAvgRating: group._avg.rating,
                reviewsCount: group._count.rating,
                reviewsLastRefresh: new Date(),
            },
        });

        queries.push(updateQuery);
    }

    await Promise.allSettled(queries);
    console.log('Added ratings to books!');
}

await updateRatings();
