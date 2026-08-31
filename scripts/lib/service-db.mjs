/*
 * Shared resolution of a service's database URL for HOST-side Prisma commands.
 *
 * .env.dev holds URLs pointing at the compose service hostname (`postgres`),
 * which does not resolve outside the compose network. Compose publishes 5432 on
 * the host, so rewriting the host is all that is needed to run Prisma tools
 * locally — and locally is where they belong: `prisma generate` is unreliable on
 * the Node-24 alpine image, and generating inside the container writes into the
 * mounted src/ and trips nodemon into a restart loop mid-write.
 */
import { config } from 'dotenv';

export const SERVICES = {
    auth: { dir: 'packages/services/auth-service', urlVar: 'AUTH_SERVICE_DATABASE_URL', studioPort: 5555 },
    books: { dir: 'packages/services/book-service', urlVar: 'BOOK_SERVICE_DATABASE_URL', studioPort: 5556 },
    reviews: { dir: 'packages/services/review-service', urlVar: 'REVIEW_SERVICE_DATABASE_URL', studioPort: 5557 },
};

export function resolveService(name) {
    const service = SERVICES[name];
    if (!service) {
        console.error(`Unknown service "${name ?? ''}". Expected one of: ${Object.keys(SERVICES).join(', ')}`);
        process.exit(1);
    }

    const { error } = config({ path: '.env.dev', quiet: true });
    if (error) {
        console.error('Could not read .env.dev — run this from the repo root.');
        process.exit(1);
    }

    const raw = process.env[service.urlVar];
    if (!raw) {
        console.error(`${service.urlVar} is not set in .env.dev`);
        process.exit(1);
    }

    const url = raw.replace(/@postgres:/, '@localhost:');
    // prisma.config.ts resolves this via env() at load time, so it must be set
    // in the child's environment even when we also pass --url.
    process.env[service.urlVar] = url;

    return { ...service, url, redacted: url.replace(/:\/\/[^@]*@/, '://***:***@') };
}
