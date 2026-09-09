/*
 * Seeds login-able users, published books and reviews, straight to the
 * databases. Not through the API: there is no publish path, so every book the
 * API creates is DRAFT and invisible to GET /books.
 *
 * books_db and reviews_db are separate with no foreign key, so book ids are
 * generated here and reviews reference them.
 *
 * The shape matters more than the volume — duplicate titles exercise the id
 * tiebreaker, DRAFT rows the status filter, null publish dates the NULLS LAST
 * placement, uneven review counts hasMore.
 *
 * Seeded rows are marked and nothing else is touched: users by an
 * @bookverse.test email, books by a "seed" genre, reviews by their book.
 *
 * Usage:  npm run seed
 *         npm run seed -- --books=1000 --reviews=8000 --users=60
 *         npm run seed -- --clean
 */
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { resolveService } from './lib/service-db.mjs';

import { PrismaClient as AuthClient } from '../packages/services/auth-service/src/generated/prisma/client.js';
import { PrismaClient as BookClient } from '../packages/services/book-service/src/generated/prisma/client.js';
import { PrismaClient as ReviewClient } from '../packages/services/review-service/src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

// ── options ──────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split('=')[1] : fallback;
};

const options = {
    books: Number(flag('books', 200)),
    reviews: Number(flag('reviews', 1000)),
    users: Number(flag('users', 30)),
    // Your account joins the pool, so some seeded rows are yours to edit.
    me: flag('me', 'amr@example.com'),
    clean: argv.includes('--clean'),
};

const SEED_MARKER = 'seed';
const SEED_EMAIL_DOMAIN = '@bookverse.test';
const SEED_PASSWORD = 'password123';
/* Pool entries for your account; everyone else gets one. */
const MY_WEIGHT = 6;

// ── content pools ────────────────────────────────────────────────────────────

const GENRES = ['fantasy', 'sci-fi', 'mystery', 'romance', 'history', 'engineering', 'non-fiction', 'horror'];

const ADJECTIVES = ['Distributed', 'Silent', 'Broken', 'Last', 'Hidden', 'Crimson', 'Patient', 'Eternal', 'Frozen', 'Restless'];
const NOUNS = ['Systems', 'Garden', 'Protocol', 'Empire', 'Machine', 'Harvest', 'Cathedral', 'Voyage', 'Archive', 'Tide'];

/* Deliberate collisions, so ?sort=title has real ties to break. */
const DUPLICATE_TITLES = ['The Same Title', 'Common Ground', 'Untitled'];

const COMMENTS = [
    'Held up under partition.',
    'Started strong, lost me halfway.',
    'The middle third is the reason to read it.',
    'Would recommend, with reservations.',
    'Not what I expected, better for it.',
    'Competent and forgettable.',
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// ── clients ──────────────────────────────────────────────────────────────────

function connect(name, Client) {
    const { url } = resolveService(name);
    return new Client({ adapter: new PrismaPg({ connectionString: url }) });
}

const auth = connect('auth', AuthClient);
const books = connect('books', BookClient);
const reviews = connect('reviews', ReviewClient);

async function disconnectAll() {
    await Promise.all([auth.$disconnect(), books.$disconnect(), reviews.$disconnect()]);
}

// ── clean ────────────────────────────────────────────────────────────────────

async function clean() {
    const seeded = await books.book.findMany({ where: { genre: { has: SEED_MARKER } }, select: { id: true } });
    const bookIds = seeded.map((b) => b.id);

    // Reviews first — nothing enforces the order, and the missing FK would
    // happily leave them orphaned.
    const deletedReviews = await reviews.review.deleteMany({ where: { bookId: { in: bookIds } } });
    const deletedBooks = await books.book.deleteMany({ where: { genre: { has: SEED_MARKER } } });
    // Sessions cascade from User.
    const deletedUsers = await auth.user.deleteMany({ where: { email: { endsWith: SEED_EMAIL_DOMAIN } } });

    console.log(`removed  ${deletedUsers.count} users · ${deletedBooks.count} books · ${deletedReviews.count} reviews`);
}

// ── users ────────────────────────────────────────────────────────────────────

async function seedUsers() {
    /* One hash for every account. Wrong for real credentials; here they all
     * share one published password anyway, and it turns N hashes into one. */
    const password = await bcrypt.hash(SEED_PASSWORD, 10);

    const rows = Array.from({ length: options.users }, (_, i) => {
        const n = String(i + 1).padStart(2, '0');
        return {
            id: randomUUID(),
            name: `Seed Reader ${n}`,
            email: `seed-${n}${SEED_EMAIL_DOMAIN}`,
            password,
            role: 'USER',
        };
    });

    await auth.user.createMany({ data: rows, skipDuplicates: true });

    // Re-read so a re-run reuses the accounts that already exist.
    const seeded = await auth.user.findMany({
        where: { email: { endsWith: SEED_EMAIL_DOMAIN } },
        select: { id: true, email: true },
    });

    const me = await auth.user.findUnique({ where: { email: options.me }, select: { id: true, email: true } });

    // Weighting is just repetition, so pick() favours you with no extra path.
    const pool = seeded.map((u) => u.id);
    if (me) for (let i = 0; i < MY_WEIGHT; i++) pool.push(me.id);

    return { pool, seededCount: seeded.length, me };
}

// ── books ────────────────────────────────────────────────────────────────────

function makeBook(index, ownerUserId) {
    const duplicate = Math.random() < 0.08;
    const title = duplicate ? pick(DUPLICATE_TITLES) : `The ${pick(ADJECTIVES)} ${pick(NOUNS)}`;

    // ~15% never reach the catalogue, so the status filter visibly does something.
    const roll = Math.random();
    const status = roll < 0.12 ? 'DRAFT' : roll < 0.15 ? 'ARCHIVED' : 'PUBLISHED';

    /* A few published books have no date — null is "never told", not "long ago". */
    const datedPublished = status === 'PUBLISHED' && Math.random() > 0.05;
    const publishedAt = datedPublished ? new Date(Date.now() - between(0, 1095) * 86_400_000) : null;

    const genre = [pick(GENRES), SEED_MARKER];
    if (Math.random() < 0.35) genre.unshift(pick(GENRES));

    return {
        id: randomUUID(),
        title,
        ownerUserId,
        description: `${title} — book ${index + 1} of the seeded catalogue.`,
        genre: [...new Set(genre)],
        status,
        publishedAt,
        createdAt: new Date(Date.now() - between(0, 1200) * 86_400_000),
    };
}

async function seedBooks(pool) {
    const rows = Array.from({ length: options.books }, (_, i) => makeBook(i, pick(pool)));
    await createInChunks(books.book, rows);
    return rows;
}

// ── reviews ──────────────────────────────────────────────────────────────────

/* Lopsided on purpose — a flat 5-per-book never exercises hasMore. */
function reviewCount() {
    const r = Math.random();
    if (r < 0.45) return 0;
    if (r < 0.85) return between(1, 3);
    if (r < 0.97) return between(4, 15);
    return between(20, 64);
}

function seedReviewsFor(book, pool, budget, taken) {
    // @@unique([bookId, userId]) caps a book at one review per reader.
    const used = taken.get(book.id);
    const free = pool.filter((id) => !used.has(id));
    const wanted = Math.min(reviewCount(), free.length, budget);
    if (wanted === 0) return [];

    const reviewers = free.sort(() => Math.random() - 0.5).slice(0, wanted);
    const published = book.publishedAt ?? book.createdAt;

    for (const id of reviewers) used.add(id);

    return reviewers.map((userId) => ({
        id: randomUUID(),
        bookId: book.id,
        userId,
        rating: between(1, 5),
        comment: Math.random() < 0.85 ? pick(COMMENTS) : null,
        createdAt: new Date(published.getTime() + between(1, 400) * 86_400_000),
    }));
}

async function seedReviews(bookRows, pool) {
    // Reviews land on books a reader could actually have found.
    const candidates = bookRows.filter((b) => b.status === 'PUBLISHED').sort(() => Math.random() - 0.5);
    const readers = [...new Set(pool)];
    const taken = new Map(candidates.map((b) => [b.id, new Set()]));

    /* Repeated passes: one skewed pass runs out of books long before budget,
     * since 45% draw zero. Tops up until spent or saturated. */
    const rows = [];
    let exhausted = false;
    while (rows.length < options.reviews && !exhausted) {
        const before = rows.length;
        for (const book of candidates) {
            if (rows.length >= options.reviews) break;
            rows.push(...seedReviewsFor(book, readers, options.reviews - rows.length, taken));
        }
        // A pass that added nothing means every book is at capacity.
        exhausted = rows.length === before;
    }

    if (rows.length < options.reviews) {
        const ceiling = candidates.length * readers.length;
        console.log(`note: ${options.reviews} reviews requested, ${rows.length} possible — one per reader per book caps this at ${ceiling}.`);
    }

    await createInChunks(reviews.review, rows);
    return rows;
}

// ── helpers ──────────────────────────────────────────────────────────────────

/* One INSERT per chunk instead of thousands of round trips. */
async function createInChunks(model, rows, size = 500) {
    for (let i = 0; i < rows.length; i += size) {
        await model.createMany({ data: rows.slice(i, i + size), skipDuplicates: true });
    }
}

// ── run ──────────────────────────────────────────────────────────────────────

try {
    if (options.clean) {
        await clean();
    } else {
        const { pool, seededCount, me } = await seedUsers();
        const bookRows = await seedBooks(pool);
        const reviewRows = await seedReviews(bookRows, pool);

        const published = bookRows.filter((b) => b.status === 'PUBLISHED').length;

        console.log(`\nseeded  ${seededCount} users · ${bookRows.length} books (${published} published) · ${reviewRows.length} reviews`);
        console.log(`log in as any seeded user:  seed-01${SEED_EMAIL_DOMAIN} / ${SEED_PASSWORD}`);
        console.log(
            me
                ? `${options.me} is in the pool at ${MY_WEIGHT}x weight, so a good share of these are yours to edit.`
                : `${options.me} not found in auth_db — seeded rows are owned by fake users only.`,
        );
        console.log(`\nundo with:  npm run seed -- --clean`);
    }
} finally {
    await disconnectAll();
}
