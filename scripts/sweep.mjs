/*
 * Concurrency sweep against the gateway.
 *
 * Answers "what happens at concurrency N?" — it GENERATES load against one
 * endpoint at connections 1..N and reports, per level: latency percentiles,
 * throughput, goodput, status codes, and (for auth) how much work the callee
 * was holding. Use it to find a knee or to A/B a change.
 *
 * Its counterpart is scripts/latency.mjs, which answers "what did real traffic
 * actually do?" — every route at once, reconstructed from logs, adding no load
 * of its own. Use that one to read organic traffic or to observe a system you
 * are not the one driving.
 *
 * Usage:
 *   npm run sweep                                  login, 1..20, 30s per level
 *   npm run sweep -- bookRead 16                   sweep 1..16
 *   npm run sweep -- reviewCreate 10 --only        just c=10, no sweep
 *   npm run sweep -- reviewCreate 10 --only --duration 15
 *
 *   --only          run only at the given connection count, not 1..N.
 *                   Use this for an A/B at a fixed level — a full sweep is
 *                   30s x N levels and you do not need the other rows.
 *   --duration <s>  seconds per level (default 30).
 *
 * Comparing two runs: alternate the arms within one sitting and take the median
 * of at least three. Measured capacity has drifted 4.2-6.7/sec on identical
 * code, which is wider than most effects worth measuring.
 */
import autocannon from 'autocannon';

const GATEWAY = 'http://localhost:3000';
const DEFAULT_DURATION = 30;

const CREDENTIALS = { email: 'amr@example.com', password: 'password123' };

// Reused across runs on purpose: the idempotency key means setup replays the
// same book instead of littering the database with one per sweep.
const FIXTURE_KEY = 'sweep-fixture-book';
const FIXTURE_BOOK = {
    title: 'Sweep Fixture',
    description: 'Created by scripts/sweep.mjs so load tests have something real to hit.',
    genre: ['non-fiction'],
};

/*
 * Operations are either plain autocannon options, or a function of the setup
 * context — and being a function is what marks an operation as needing setup
 * (a token and a real book). Plain objects run with no login at all, so
 * `login` and `health` still work on a stack where nothing else does.
 *
 * `pressure: true` polls auth-service's in-flight gauge alongside the run. Only
 * auth exposes one, so it is off everywhere else rather than reporting a
 * confident zero.
 */
const OPERATIONS = {
    // The CPU-bound one: two bcrypt hashes on a single event-loop thread.
    login: {
        pressure: true,
        url: `${GATEWAY}/auth/login`,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(CREDENTIALS),
    },

    // Does no real work. If this saturates too, we are measuring the harness or
    // Docker's port forwarding rather than the service.
    health: {
        url: `${GATEWAY}/health`,
    },

    // ---- book-service ----

    // The cheap read path. Public, no token.
    bookList: {
        url: `${GATEWAY}/books`,
    },

    bookById: (ctx) => ({
        url: `${GATEWAY}/books/${ctx.bookId}`,
    }),

    // Every request replays the same idempotency key, so this measures the
    // REPLAY path (key lookup + rebuild), not a fresh insert. That is the
    // honest thing to hammer: a fresh insert per request would also be
    // measuring how fast Postgres grows a table.
    bookWriteReplay: (ctx) => ({
        url: `${GATEWAY}/books`,
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${ctx.token}`,
            'idempotency-key': FIXTURE_KEY,
        },
        body: JSON.stringify(FIXTURE_BOOK),
    }),

    // ---- review-service ----

    // Public read path for a book's reviews.
    reviewList: (ctx) => ({
        url: `${GATEWAY}/reviews?bookId=${ctx.bookId}`,
    }),

    /*
     * The Build 3 A/B: run this with REVIEW_VERIFY_BOOK_EXISTS false, then
     * true, and the delta is what one synchronous hop costs on a write path.
     *
     * Expect mostly 409s, and that is fine. The unique (bookId, userId) index
     * means only the first request inserts; the rest conflict. Both arms do the
     * same database work, so the difference between them is purely the call to
     * book-service — which happens BEFORE the insert and therefore still runs
     * on every conflicting request.
     *
     * Do not "fix" this by sending a random bookId per request: with the flag
     * on, book-service would 404 every one of them, and you would be comparing
     * a 404 path against a 201 path instead of measuring the hop.
     */
    reviewCreate: (ctx) => ({
        url: `${GATEWAY}/reviews`,
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${ctx.token}`,
        },
        body: JSON.stringify({ bookId: ctx.bookId, rating: 4, comment: 'sweep' }),
    }),
};

// auth-service reports how much work it is holding. Exempt from the limiter and
// does no real work, so it still answers while everything else is being refused.
const PRESSURE_URL = `${GATEWAY}/auth/pressure`;

async function readPressure() {
    try {
        const res = await fetch(PRESSURE_URL, { signal: AbortSignal.timeout(10_000) });
        return res.ok ? await res.json() : null;
    } catch {
        // Not running, or refusing us — leave the column empty rather than guess.
        return null;
    }
}

/*
 * Everything an operation might need, fetched ONCE before any measurement so
 * the cost of getting it never lands inside a percentile.
 */
async function setup() {
    const loginRes = await fetch(`${GATEWAY}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(CREDENTIALS),
    });
    if (!loginRes.ok) {
        console.error(`Login failed (${loginRes.status}). Is the stack up, and does ${CREDENTIALS.email} exist?`);
        process.exit(1);
    }
    const loginBody = await loginRes.json();
    const token = loginBody?.data?.tokens?.accessToken ?? loginBody?.data?.accessToken;
    if (!token) {
        console.error('Logged in but found no accessToken in the response.');
        process.exit(1);
    }

    const bookRes = await fetch(`${GATEWAY}/books`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
            'idempotency-key': FIXTURE_KEY,
        },
        body: JSON.stringify(FIXTURE_BOOK),
    });
    if (!bookRes.ok) {
        console.error(`Could not create or replay the fixture book (${bookRes.status}).`);
        process.exit(1);
    }
    const bookId = (await bookRes.json())?.data?.id;
    if (!bookId) {
        console.error('Fixture book response carried no id.');
        process.exit(1);
    }

    return { token, bookId };
}

async function run(name, connections, duration, { only }) {
    const entry = OPERATIONS[name];
    if (!entry) {
        console.error(`Unknown operation "${name}". Expected one of: ${Object.keys(OPERATIONS).join(', ')}`);
        process.exit(1);
    }

    // A function-valued operation needs a token and a real book; a plain one
    // does not, so don't make `login` and `health` depend on a working login.
    const operation = typeof entry === 'function' ? entry(await setup()) : entry;
    const { pressure: wantPressure = false, ...options } = operation;

    const rows = {};
    const levels = only ? [connections] : Array.from({ length: connections }, (_, i) => i + 1);

    for (const c of levels) {
        // Peak, not resting level: the question is how much work piled up.
        let peakInFlight = 0;
        // Skip a tick if the previous read is still out, so we don't stack
        // extra requests onto a busy service.
        let reading = false;
        const poller = wantPressure
            ? setInterval(async () => {
                  if (reading) return;
                  reading = true;
                  const p = await readPressure();
                  reading = false;
                  if (p) peakInFlight = Math.max(peakInFlight, p.inFlight ?? 0);
              }, 1000)
            : null;

        const res = await autocannon({
            ...options,
            connections: c,
            duration,

            // Keep failures out of the percentiles, so they always mean
            // "how long a successful request took".
            excludeErrorStats: true,
        });

        if (poller) clearInterval(poller);

        const { latency, requests, errors, statusCodeStats, duration: actual } = res;

        // e.g. "200:1024 504:57" — the codes say who rejected you and why.
        const codes = Object.entries(statusCodeStats)
            .map(([code, { count }]) => `${code}:${count}`)
            .join(' ');

        // Anything 2xx reached the user. Counting only 200 undercounts a route
        // that answers 201 or 204.
        const delivered = Object.entries(statusCodeStats)
            .filter(([code]) => code.startsWith('2'))
            .reduce((sum, [, { count }]) => sum + count, 0);

        // Keyed by connection count so console.table's first column is `c`.
        rows[c] = {
            P50: latency.p50,
            P90: latency.p90,
            P99: latency.p99,
            reqPerSec: requests.average,
            // The gap from reqPerSec is work the user never received.
            'goodput(<=reqPerSec)': +(delivered / actual).toFixed(2),
            ...(wantPressure ? { peakInFlight } : {}),
            // No answer at all: refused, reset, hung up. A 504 IS an answer.
            errors,
            codes,
        };
    }

    const scope = only ? `connections ${connections}` : `connections 1..${connections}`;
    console.log(`\n${name} — ${duration}s per level, ${scope}\n`);
    console.table(rows);
}

const argv = process.argv.slice(2);
const flag = (n, fallback) => {
    const i = argv.indexOf(n);
    return i === -1 ? fallback : argv[i + 1];
};
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1] === '--duration'));

const [operation = 'login', connections = '20'] = positional;
run(operation, Number(connections), Number(flag('--duration', DEFAULT_DURATION)), {
    only: argv.includes('--only'),
});
