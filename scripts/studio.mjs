/*
 * Opens Prisma Studio against a service's database, from the host.
 *
 * Host-side because Studio has --port but no --hostname: inside the container it
 * would always bind localhost and be unreachable without extra port plumbing.
 * URL resolution (postgres -> localhost) lives in lib/service-db.mjs.
 *
 * Usage: node scripts/studio.mjs <auth|books> [--port 6000]
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolveService } from './lib/service-db.mjs';

const [name, ...passthrough] = process.argv.slice(2);
const service = resolveService(name);

console.log(`Prisma Studio → ${name} (${service.redacted})`);

// Ports are pinned — Studio picks a random one otherwise — and distinct per
// service so both can run side by side. A caller-supplied --port wins.
const args = ['studio', '--url', service.url, ...passthrough];
if (!passthrough.some((a) => a === '--port' || a === '-p')) args.push('--port', String(service.studioPort));

// Run the CLI entry point under node: `shell: true` triggers DEP0190 and would
// need the URL's password escaped, while spawning npx.cmd without a shell is
// EINVAL on Windows (Node >=20).
const prismaBin = createRequire(import.meta.url).resolve('prisma/build/index.js');
const child = spawn(process.execPath, [prismaBin, ...args], {
    cwd: service.dir,
    stdio: 'inherit',
    env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
