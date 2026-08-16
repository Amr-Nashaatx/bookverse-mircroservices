# BookVerse API

A book-review backend, built as microservices. Every service boundary, and most
of the machinery between them, exists to handle a specific way distributed
systems fail — the reasoning for each choice lives in [`docs/decisions/`](docs/decisions/).

## Running it

```bash
npm run compose                                   # bring the stack up (dev)
npm run migrate:books:dev -- --name <name>        # author a migration
npm run generate:books                            # regenerate the Prisma client
```

The gateway is the only public entry point: `http://localhost:3000`.
`requests.http` and `experiments.http` (VS Code REST Client) exercise it — the
first for the happy path, the second for deliberately breaking things.

| | |
|---|---|
| `npm run logs:<svc>` | tail a service's logs, pretty-printed (`-- --errors` to filter) |
| `npm run latency:<svc>` | per-route p50/p90/p99, reconstructed from those logs |
| `npm run studio:<svc>` | Prisma Studio against that service's database |

## What's running

```
                    ┌───────────────┐
   client  ───────► │    gateway    │  :3000   only public entry
                    └───┬───────┬───┘
              /auth     │       │     /books
                    ┌───▼───┐ ┌─▼─────────┐
                    │ auth  │ │   book    │
                    │ :3001 │ │   :3002   │
                    └───┬───┘ └─────┬─────┘
                        │           │
                   auth_db      books_db        one Postgres instance,
                                                one database per service
```

**gateway** — verifies the JWT, strips any client-supplied `x-user-*` headers,
and injects the caller's verified identity plus a shared secret proving the
request came from the gateway. Every hop out of it has a deliberate timeout.

**auth-service** — signup, login, logout, refresh. Owns users and sessions.

**book-service** — public reads, authenticated writes, ownership checks on
update. Owns books. `POST /books` is idempotent.

Services never read each other's tables. Anything one service needs from
another it asks for over HTTP — or, later, learns about from an event.

## API

| | |
|---|---|
| `POST /auth/signup` · `POST /auth/login` | public |
| `POST /auth/refresh` · `POST /auth/logout` | public |
| `GET /books` · `GET /books/:id` | public |
| `POST /books` | authenticated · requires `Idempotency-Key` |
| `PATCH /books/:id` | authenticated · owner only |

## Stack

TypeScript · Fastify + TypeBox · Prisma · PostgreSQL · RabbitMQ · Docker Compose

npm workspaces: `packages/gateway`, `packages/services/*`, and `packages/shared`
for the cross-cutting pieces — error handling, the caller-auth and identity
plugins, and shared types.

## Status

Gateway, auth-service and book-service are running end to end. Remaining
services and the event-driven paths between them are being added incrementally;
this README grows with them.
