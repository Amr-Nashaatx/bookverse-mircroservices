/*
 * Latency percentiles per route, reconstructed from a service's pino logs.
 *
 * Answers "what did real traffic actually do?" — every route at once, with
 * status codes, from requests you did not generate. It reads logs, so it adds
 * no load to the thing it is measuring and can tell you about a slowdown that
 * already happened.
 *
 * Its counterpart is scripts/sweep.mjs, which answers the opposite question:
 * "what happens at concurrency N?" Sweep GENERATES load against one endpoint.
 * Use sweep to find a knee or A/B a change; use this to read organic traffic
 * (an .http run, a manual matrix) or to observe a system under someone else's
 * load without adding your own.
 *
 * Fastify logs each request twice: "incoming request" carries the URL, and
 * "request completed" carries responseTime + status. Neither line is useful
 * alone, so we join them.
 *
 * The join key is pid + reqId, NOT reqId: Fastify's reqId is a per-process
 * counter that resets to req-1 on every restart, and nodemon restarts often.
 * Joining on reqId alone silently merges unrelated requests.
 *
 * Usage: node scripts/latency.mjs <gateway|auth|book|review> [options]
 *   --all              include /health (excluded by default — it dwarfs everything)
 *   --route <substr>   only routes containing this substring
 *   --tail <n>         log lines to scan (default 20000)
 *   --max <ms>         drop samples above this (e.g. fault-injected runs)
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const CONTAINERS = { gateway: 'gateway', auth: 'auth-service', book: 'book-service', review: 'review-service' };

const argv = process.argv.slice(2);
const container = CONTAINERS[argv[0]];
const flag = (name, fallback) => {
    const i = argv.indexOf(name);
    return i === -1 ? fallback : argv[i + 1];
};
const includeHealth = argv.includes('--all');
const routeFilter = flag('--route', null);
const maxMs = Number(flag('--max', Infinity));

if (!container) {
    console.error(`Usage: node scripts/latency.mjs <${Object.keys(CONTAINERS).join('|')}> [--all] [--route x]`);
    process.exit(1);
}

const docker = spawn(
    'docker',
    ['compose', '--env-file', '.env.dev', 'logs', '--no-log-prefix', '--tail', flag('--tail', '20000'), container],
    { stdio: ['ignore', 'pipe', 'inherit'] },
);

const routeOf = new Map(); // `${pid}:${reqId}` -> "METHOD /path"
const samples = new Map(); // route -> { times: number[], statuses: Map }

// /books/3f2a-... -> /books/:id  so one endpoint doesn't become a thousand routes
const normalize = (url) =>
    url
        .split('?')[0]
        .replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}/g, '/:id')
        .replace(/\/\d+(?=\/|$)/g, '/:id');

createInterface({ input: docker.stdout }).on('line', (line) => {
    let r;
    try {
        r = JSON.parse(line);
    } catch {
        return; // docker's own warnings are not JSON
    }
    if (r.reqId == null) return;
    const key = `${r.pid}:${r.reqId}`;

    if (r.req?.url) {
        routeOf.set(key, `${r.req.method} ${normalize(r.req.url)}`);
        return;
    }
    if (r.responseTime == null) return;

    const route = routeOf.get(key);
    if (!route) return; // its "incoming" line fell outside the --tail window
    if (!includeHealth && route.endsWith('/health')) return;
    if (routeFilter && !route.includes(routeFilter)) return;
    if (r.responseTime > maxMs) return;

    const bucket = samples.get(route) ?? { times: [], statuses: new Map() };
    bucket.times.push(r.responseTime);
    const code = r.res?.statusCode ?? '?';
    bucket.statuses.set(code, (bucket.statuses.get(code) ?? 0) + 1);
    samples.set(route, bucket);
});

docker.on('exit', () => {
    if (samples.size === 0) {
        console.log(`No samples for ${container}. Send some traffic, or pass --all to include /health.`);
        return;
    }
    const pct = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    const ms = (n) => `${n.toFixed(n < 10 ? 1 : 0)}ms`.padStart(8);

    console.log(`\n${container} — latency by route\n`);
    console.log('  route'.padEnd(30) + 'n'.padStart(5) + 'p50'.padStart(9) + 'p90'.padStart(9) + 'p99'.padStart(9) + 'max'.padStart(9) + '   statuses');

    for (const [route, { times, statuses }] of [...samples].sort((a, b) => pct(b[1].times.slice().sort((x, y) => x - y), 0.9) - pct(a[1].times.slice().sort((x, y) => x - y), 0.9))) {
        const t = times.slice().sort((a, b) => a - b);
        const codes = [...statuses].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}×${n}`).join(' ');
        console.log(
            `  ${route}`.padEnd(30) +
                String(t.length).padStart(5) +
                ms(pct(t, 0.5)) +
                ms(pct(t, 0.9)) +
                ms(pct(t, 0.99)) +
                ms(t[t.length - 1]) +
                `   ${codes}`,
        );
    }
    console.log('\n  Set a timeout above p99 of NORMAL load, not above p50. Re-measure under concurrency.\n');
});
