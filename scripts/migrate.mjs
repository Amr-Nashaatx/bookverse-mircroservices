/*
 * Runs Prisma Migrate for a service, from the host. Two modes:
 *
 *   (default)  `prisma migrate dev`    — CREATES a migration from schema changes
 *                                        and applies it. Needs --name.
 *   --deploy   `prisma migrate deploy` — only applies migrations that already
 *                                        exist. Never authors one, no shadow
 *                                        database, never prompts.
 *
 * Both run on the HOST, against localhost:5432. That is deliberate and it is
 * the only supported path in dev.
 *
 * There used to be `npm run migrate:<svc>` wrappers that ran `migrate deploy`
 * INSIDE the service container. They were deleted because dev compose mounts
 * only src/, not prisma/ — so the container read the migrations and schema
 * baked into its image at build time. A stale image reported "no pending
 * migrations to apply" while one was pending, against a schema.prisma several
 * renames out of date. `prisma:migrate:deploy` is still in each service's
 * package.json: inside a freshly built production image it is correct, because
 * there the baked-in prisma/ IS current. It is only dev where the image lags
 * the working tree, and that is exactly where the wrappers were used.
 *
 * Requires a running Postgres (`npm run compose`). migrate dev additionally
 * creates and drops a shadow database to detect drift. Commit the generated
 * prisma/migrations/ directory; it is the artifact deploy consumes.
 *
 * Usage: npm run migrate:books:dev -- --name add_idempotency_key
 *        npm run migrate:books:deploy
 *        node scripts/migrate.mjs books --name add_idempotency_key [--create-only]
 *        node scripts/migrate.mjs books --deploy
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolveService } from './lib/service-db.mjs';

const [name, ...argv] = process.argv.slice(2);
const service = resolveService(name);

const deploy = argv.includes('--deploy');
const passthrough = argv.filter((a) => a !== '--deploy');
const subcommand = deploy ? 'deploy' : 'dev';

console.log(`prisma migrate ${subcommand} → ${name} (${service.redacted})\n`);

const prismaBin = createRequire(import.meta.url).resolve('prisma/build/index.js');
const child = spawn(process.execPath, [prismaBin, 'migrate', subcommand, ...passthrough], {
    cwd: service.dir,
    stdio: 'inherit', // migrate dev prompts on drift / missing --name
    env: process.env,
});

/*
 * migrate dev is documented to trigger generators, but does not reliably do so
 * here - leaving the generated client describing columns the migration just
 * dropped. That compiles fine and fails at query time, so regenerate always.
 * migrate deploy never runs generators at all, so it needs this too.
 */
child.on('exit', (code) => {
    if (code !== 0) process.exit(code ?? 1);

    const generate = spawn(process.execPath, [prismaBin, 'generate'], {
        cwd: service.dir,
        stdio: 'inherit',
        env: process.env,
    });
    generate.on('exit', (genCode) => {
        if (genCode === 0 && !deploy) console.log('Done. Commit prisma/migrations/ - deploy needs it.');
        process.exit(genCode ?? 0);
    });
});
