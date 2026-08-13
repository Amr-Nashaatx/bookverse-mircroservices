/*
 * Opens Prisma Studio against a service's database from the HOST.
 *
 * Why a script rather than a plain npm script:
 *  - .env.dev's URLs use the Docker service hostname (`postgres`), which doesn't
 *    resolve outside the compose network. Compose publishes 5432, so we rewrite
 *    the host to localhost and pass it via `prisma studio --url`.
 *  - Studio has no --hostname flag, so it always binds localhost. Running it
 *    inside the container would be unreachable without extra port plumbing.
 *
 * Usage: node scripts/studio.mjs <auth|books> [--port 5556]
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { config } from 'dotenv';

// Ports are pinned (Studio picks a random one otherwise) and distinct, so both
// can run side by side — handy when comparing auth users to book authorIds.
const SERVICES = {
    auth: { dir: 'packages/services/auth-service', urlVar: 'AUTH_SERVICE_DATABASE_URL', port: 5555 },
    books: { dir: 'packages/services/book-service', urlVar: 'BOOK_SERVICE_DATABASE_URL', port: 5556 },
};

const [name, ...passthrough] = process.argv.slice(2);
const service = SERVICES[name];

if (!service) {
    console.error(`Usage: node scripts/studio.mjs <${Object.keys(SERVICES).join('|')}> [prisma studio flags]`);
    process.exit(1);
}

const { error } = config({ path: '.env.dev', quiet: true });
if (error) {
    console.error('Could not read .env.dev from the repo root. Run this from the repo root.');
    process.exit(1);
}

const raw = process.env[service.urlVar];
if (!raw) {
    console.error(`${service.urlVar} is not set in .env.dev`);
    process.exit(1);
}

// postgres:5432 (compose network) -> localhost:5432 (published port)
const url = raw.replace(/@postgres:/, '@localhost:');

console.log(`Prisma Studio → ${name} (${url.replace(/:\/\/[^@]*@/, '://***:***@')})`);

// A caller-supplied --port wins over the default.
const args = ['prisma', 'studio', '--url', url, ...passthrough];
if (!passthrough.some((a) => a === '--port' || a === '-p')) args.push('--port', String(service.port));

// Run the CLI entry point with node rather than going through npx: `shell: true`
// triggers DEP0190 and would need the URL's password escaped, while spawning
// npx.cmd without a shell is EINVAL on Windows (Node >=20).
const prismaBin = createRequire(import.meta.url).resolve('prisma/build/index.js');

const child = spawn(process.execPath, [prismaBin, ...args.slice(1)], {
    cwd: service.dir,
    stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
