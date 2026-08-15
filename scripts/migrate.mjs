/*
 * Authors a Prisma migration for a service, from the host.
 *
 * This is `prisma migrate dev` — it CREATES a migration from schema changes and
 * applies it. Distinct from `npm run migrate:auth|books`, which run
 * `migrate deploy` inside the container: deploy only applies migrations that
 * already exist, and never authors one.
 *
 * Requires a running Postgres (`npm run compose`) — migrate dev also creates and
 * drops a shadow database to detect drift. Commit the generated
 * prisma/migrations/ directory; it is the artifact deploy consumes.
 *
 * Usage: npm run migrate:books:dev -- --name add_idempotency_key
 *        node scripts/migrate.mjs books --name add_idempotency_key [--create-only]
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolveService } from './lib/service-db.mjs';

const [name, ...passthrough] = process.argv.slice(2);
const service = resolveService(name);

console.log(`prisma migrate dev → ${name} (${service.redacted})\n`);

const prismaBin = createRequire(import.meta.url).resolve('prisma/build/index.js');
const child = spawn(process.execPath, [prismaBin, 'migrate', 'dev', ...passthrough], {
    cwd: service.dir,
    stdio: 'inherit', // migrate dev prompts on drift / missing --name
    env: process.env,
});

/*
 * migrate dev is documented to trigger generators, but does not reliably do so
 * here - leaving the generated client describing columns the migration just
 * dropped. That compiles fine and fails at query time, so regenerate always.
 */
child.on('exit', (code) => {
    if (code !== 0) process.exit(code ?? 1);

    const generate = spawn(process.execPath, [prismaBin, 'generate'], {
        cwd: service.dir,
        stdio: 'inherit',
        env: process.env,
    });
    generate.on('exit', (genCode) => {
        if (genCode === 0) console.log('Done. Commit prisma/migrations/ - deploy needs it.');
        process.exit(genCode ?? 0);
    });
});
