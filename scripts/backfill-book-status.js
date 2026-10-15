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

const books = await bookClient.book.findMany({ select: { status: true, id: true, version: true } });

// Guarded upsert, the same statement the consumer runs: this script races live status events,
// so a row the consumer already moved to a newer version must not be overwritten. Safe to rerun.
for (const b of books) {
    await reviewsClient.$executeRaw`
        INSERT INTO "BookStatus" ("bookId", status, version) VALUES (${b.id}, ${b.status}, ${b.version})
        ON CONFLICT ("bookId") DO UPDATE SET status = EXCLUDED.status, version = EXCLUDED.version
        WHERE "BookStatus".version < EXCLUDED.version`;
}
console.log(`Backfilled ${books.length} book statuses`);
