import autocannon from 'autocannon';

const DURATION = 30;

// Add operations here as we need them — each entry is just autocannon options.
const OPERATIONS = {
    login: {
        url: 'http://localhost:3000/auth/login',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        body: '{"email": "amr@example.com", "password": "password123"}',
    },
    // Does no real work. If this saturates too, we are measuring the harness or
    // Docker's port forwarding rather than the service.
    health: {
        url: 'http://localhost:3000/health',
    },
};

// auth-service reports how much work it is holding. Exempt from the limiter and
// does no real work, so it still answers while everything else is being refused.
const PRESSURE_URL = 'http://localhost:3000/auth/pressure';

async function readPressure() {
    try {
        const res = await fetch(PRESSURE_URL, { signal: AbortSignal.timeout(10_000) });
        return res.ok ? await res.json() : null;
    } catch {
        // Not running, or refusing us — leave the column empty rather than guess.
        return null;
    }
}

async function sweep(name, maxConnections) {
    const operation = OPERATIONS[name];
    if (!operation) {
        console.error(`Unknown operation "${name}". Expected one of: ${Object.keys(OPERATIONS).join(', ')}`);
        process.exit(1);
    }

    const rows = {};

    for (let c = 1; c <= maxConnections; c++) {
        // Peak, not resting level: the question is how much work piled up.
        let peakInFlight = 0;
        // Skip a tick if the previous read is still out, so we don't stack
        // extra requests onto a busy service.
        let reading = false;
        const poller = setInterval(async () => {
            if (reading) return;
            reading = true;
            const pressure = await readPressure();
            reading = false;
            if (!pressure) return;
            peakInFlight = Math.max(peakInFlight, pressure.inFlight ?? 0);
        }, 1000);

        const res = await autocannon({
            ...operation,
            connections: c,
            duration: DURATION,

            // Keep failures out of the percentiles, so they always mean
            // "how long a successful request took".
            excludeErrorStats: true,
        });

        clearInterval(poller);

        const { latency, requests, errors, statusCodeStats, duration } = res;

        // e.g. "200:1024 504:57" — the codes say who rejected you and why.
        const codes = Object.entries(statusCodeStats)
            .map(([code, { count }]) => `${code}:${count}`)
            .join(' ');

        // Keyed by connection count so console.table's first column is `c`.
        rows[c] = {
            P50: latency.p50,
            P90: latency.p90,
            P99: latency.p99,
            reqPerSec: requests.average,
            // The gap from reqPerSec is work the user never received.
            'goodput(<=reqPerSec)': +((statusCodeStats['200']?.count ?? 0) / duration).toFixed(2),
            peakInFlight,
            // No answer at all: refused, reset, hung up. A 504 IS an answer.
            errors,
            codes,
        };
    }

    console.log(`\n${name} — ${DURATION}s per level, connections 1..${maxConnections}\n`);
    console.table(rows);
}

const [, , operation = 'login', maxConnections = '20'] = process.argv;
sweep(operation, Number(maxConnections));
