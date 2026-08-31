/*
 * Tails a service's logs, pretty-printed.
 *
 * Fastify logs pino JSON to stdout, which Docker captures — so `docker compose
 * logs` is where every request, error and stack trace already lives. Raw it's
 * unreadable (stacks come through as escaped \n), so we pipe it through
 * pino-pretty. `--no-log-prefix` is required: Docker's "gateway  | " prefix
 * would otherwise break JSON parsing.
 *
 * Usage: node scripts/logs.mjs <gateway|auth|book|review> [--errors] [-- <docker flags>]
 *   --errors   only level >= 50 (pino: 50 = error, 60 = fatal)
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';

const CONTAINERS = { gateway: 'gateway', auth: 'auth-service', book: 'book-service', review: 'review-service' };

const argv = process.argv.slice(2);
const container = CONTAINERS[argv[0]];
const errorsOnly = argv.includes('--errors');
const dockerFlags = argv.slice(1).filter((a) => a !== '--errors');

if (!container) {
    console.error(`Usage: node scripts/logs.mjs <${Object.keys(CONTAINERS).join('|')}> [--errors]`);
    process.exit(1);
}

const docker = spawn(
    'docker',
    ['compose', '--env-file', '.env.dev', 'logs', '--no-log-prefix', '-f', '--tail', '100', ...dockerFlags, container],
    { stdio: ['ignore', 'pipe', 'inherit'] },
);

// pino-pretty reads JSON lines on stdin. Run its CLI under node so this works
// the same on Windows (no .cmd spawn, no shell escaping).
const prettyBin = createRequire(import.meta.url).resolve('pino-pretty/bin.js');
const pretty = spawn(process.execPath, [prettyBin, '--translateTime', 'SYS:HH:MM:ss.l', '--singleLine'], {
    stdio: ['pipe', 'inherit', 'inherit'],
});

// Docker interleaves its own non-JSON warnings with the container's output;
// forward only parseable JSON lines so pino-pretty doesn't choke.
createInterface({ input: docker.stdout }).on('line', (line) => {
    let record;
    try {
        record = JSON.parse(line);
    } catch {
        return;
    }
    if (errorsOnly && (record.level ?? 0) < 50) return;
    pretty.stdin.write(line + '\n');
});

const shutdown = () => {
    docker.kill();
    pretty.kill();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
docker.on('exit', () => pretty.stdin.end());
pretty.on('exit', (code) => process.exit(code ?? 0));
