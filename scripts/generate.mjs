/*
 * Regenerates a service's Prisma client, from the host.
 *
 * Read-only against the database — it reads schema.prisma and writes the client
 * into src/generated/prisma. Host-side deliberately: generate is unreliable on
 * the Node-24 alpine image, and running it in the dev container writes into the
 * mounted src/, tripping nodemon into a restart loop mid-write.
 *
 * `migrate dev` already runs this, so it is only needed for schema edits that
 * do not warrant a migration, or after pulling someone else's migration.
 *
 * Usage: npm run generate:books
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolveService } from './lib/service-db.mjs';

const [name, ...passthrough] = process.argv.slice(2);
const service = resolveService(name);

console.log(`prisma generate → ${name}`);

const prismaBin = createRequire(import.meta.url).resolve('prisma/build/index.js');
const child = spawn(process.execPath, [prismaBin, 'generate', ...passthrough], {
    cwd: service.dir,
    stdio: 'inherit',
    env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 0));
