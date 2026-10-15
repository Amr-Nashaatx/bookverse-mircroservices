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
    // One statement = one snapshot, so each aggregate is paired with the counter value it belongs to.
    // LEFT JOIN + COALESCE: books whose reviews predate the counter still get a copy, at version 0.
    // Casts make the values match the Float and Int columns they are written into.
    let reviews = await reviewsClient.$queryRaw`
        SELECT r."bookId", AVG(r.rating)::float AS "avgRating", COUNT(*)::int AS count,
               COALESCE(v.version, 0) AS version
        FROM "Review" r
        LEFT JOIN "BookReviewVersion" v ON v."bookId" = r."bookId"
        GROUP BY r."bookId", v.version
    `;
    return reviews;
}

async function updateRatings() {
    const queries = [];
    const groups = await aggregateReviewesPerBook();
    for (const group of groups) {
        const updateQuery = bookClient.book.update({
            where: { id: group.bookId, OR: [{ reviewsVersion: null }, { reviewsVersion: { lt: group.version } }] },
            data: {
                reviewsAvgRating: group.avgRating,
                reviewsCount: group.count,
                reviewsLastRefresh: new Date(),
                reviewsVersion: group.version,
            },
        });

        queries.push(updateQuery);
    }

    await Promise.allSettled(queries);
    console.log('Added ratings to books!');
}

await updateRatings();
