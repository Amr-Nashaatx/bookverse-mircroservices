# BookVerse API

A book-review backend, built as microservices. Every service boundary, and most
of the machinery between them, exists to handle a specific way distributed
systems fail — the reasoning for each choice lives in [`docs/decisions/`](docs/decisions/).

## Running it

```bash
cp .env.example .env.dev                          # then fill in the blanks
npm run compose                                   # bring the stack up (dev)
npm run migrate:books:dev -- --name <name>        # author a migration + apply it
npm run migrate:books:deploy                      # apply existing migrations only
npm run generate:books                            # regenerate the Prisma client
```

Migrations run from the **host**, never from inside a service container: dev
compose mounts only `src/`, so a container's baked-in `prisma/` lags the working
tree and will confidently report nothing to do while a migration is pending.

The gateway is the only public entry point: `http://localhost:3000`. The files
in [`http/`](http/) (VS Code REST Client) exercise it — `requests.http` for the
happy path, `experiments.http` and `circuit-breaker.http` for deliberately
breaking things, `reviews.http` for the newest service boundary.

| | |
|---|---|
| `npm run logs:<svc>` | tail a service's logs, pretty-printed (`-- --errors` to filter) |
| `npm run studio:<svc>` | Prisma Studio against that service's database |

Two measurement tools, answering opposite questions — reach for the one that
matches what you're asking:

| | | |
|---|---|---|
| `npm run sweep -- <op> <c>` | **what happens at concurrency N?** | *generates* load against one endpoint; percentiles, throughput, goodput, status codes. Add `--only` for a single level, `--duration <s>` to shorten. |
| `npm run latency:<svc>` | **what did real traffic actually do?** | *observes* logs; every route at once, adds no load, works on requests you didn't generate. |

## What's running

```
                      ┌───────────────┐
   client  ─────────► │    gateway    │  :3000   only public entry
                      └──┬────┬────┬──┘
             /auth ──────┘    │    └────── /reviews
                           /books
              ┌────────┐  ┌────────┐  ┌────────┐
              │  auth  │  │  book  │  │ review │
              │ :3001  │  │ :3002  │  │ :3003  │
              └───┬────┘  └───┬────┘  └───┬────┘
                  │           │           │
              auth_db     books_db    reviews_db     one Postgres instance,
                                                     one database per service
```

**gateway** — verifies the JWT, strips any client-supplied `x-user-*` headers,
and injects the caller's verified identity plus a shared secret proving the
request came from the gateway. Every hop out of it has a deliberate timeout.

**auth-service** — signup, login, logout, refresh. Owns users and sessions.

**book-service** — public reads, authenticated writes, ownership checks on
update. Owns books. `POST /books` is idempotent.

**review-service** — public reads, authenticated writes, one review per reader
per book. Owns reviews. It stores a `bookId` without checking that the book
exists: book-service is a deliberate *soft* dependency, so reviews stay writable
during a book-service outage. See
[`docs/decisions/boundaries/`](docs/decisions/boundaries/).

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
| `GET /reviews?bookId=` · `GET /reviews/:id` | public |
| `POST /reviews` | authenticated · one per reader per book |
| `PATCH /reviews/:id` · `DELETE /reviews/:id` | authenticated · owner only |

## Stack

TypeScript · Fastify + TypeBox · Prisma · PostgreSQL · RabbitMQ · Docker Compose

npm workspaces: `packages/gateway`, `packages/services/*`, and `packages/shared`
for the cross-cutting pieces — error handling, the response envelope, and the
caller-auth and identity plugins.

`shared` holds **infrastructure only, never domain models**. A type describing
what a Book or a Review *is* belongs to the one service that owns it: sharing it
would mean a product decision about reviews forces book-service to be rebuilt
and redeployed, which is the coupling microservices exist to avoid.

## Status

Gateway, auth-service and book-service are running end to end. Remaining
services and the event-driven paths between them are being added incrementally;
this README grows with them.
