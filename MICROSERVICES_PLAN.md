# Microservices Practice Project - Implementation Plan

**Project:** Book Review API - Microservices Architecture  
**Status:** Planning Phase  
**Goal:** Learn microservices patterns with production-realistic complexity  
**Approach:** New separate project (experimental, clean slate)  
**Database Strategy:** Separate database per service  
**Learning Level:** Advanced (embracing complexity)

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Service Decomposition](#service-decomposition)
3. [Database Strategy](#database-strategy)
4. [Technology Stack](#technology-stack)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Core Patterns & Challenges](#core-patterns--challenges)
7. [Repository Structure](#repository-structure)
8. [Communication Protocols](#communication-protocols)
9. [Testing Strategy](#testing-strategy)
10. [Deployment & Operations](#deployment--operations)
11. [Key Learnings](#key-learnings)

---

## System Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React)                       │
│              (Existing book-review-frontend)             │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    API GATEWAY                           │
│            (Single entry point for all requests)         │
│      Routes, Auth validation, Request logging            │
│                  Port: 3000                              │
└─────────────────────────────────────────────────────────┘
        ↓                ↓               ↓
    ┌───┴────┬──────┬────┴───┬──────┬───┴────┬──────┐
    ↓        ↓      ↓        ↓      ↓        ↓      ↓
┌─────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐
│  AUTH   │ │   BOOK   │ │ REVIEW │ │  SHELF   │ │ AUTHOR   │ │NOTIFICATION│ │   USER     │
│SERVICE  │ │ SERVICE  │ │SERVICE │ │ SERVICE  │ │ SERVICE  │ │ SERVICE    │ │  SERVICE   │
└─────────┘ └──────────┘ └────────┘ └──────────┘ └──────────┘ └────────────┘ └────────────┘
  Port 3001   Port 3002    Port 3003  Port 3004   Port 3005    Port 3006     Port 3007
    ↓           ↓            ↓          ↓          ↓             ↓             ↓
┌────────┐ ┌────────┐ ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐ ┌────────┐
│PostgreSQL │PostgreSQL│PostgreSQL │PostgreSQL│PostgreSQL│PostgreSQL     │PostgreSQL
│ auth_db   │ books_db │reviews_db │shelf_db  │author_db │notifications_db│ user_db
└────────┘ └────────┘ └──────────┘ └────────┘ └────────┘ └──────────────┘ └────────┘
    ↓           ↓            ↓          ↓          ↓             ↓             ↓
              (All services behind API Gateway)

                    ↓↓↓↓↓
          ┌─────────────────────┐
          │  MESSAGE QUEUE      │
          │  (Redis Pub/Sub or  │
          │   RabbitMQ)         │
          │                     │
          │  For async events:  │
          │  - user.created     │
          │  - book.created     │
          │  - review.created   │
          │  - shelf.updated    │
          │  - author.created   │
          └─────────────────────┘
```

### Request Flow Example

```
User creates a review:

1. Frontend → API Gateway (POST /api/reviews)
2. API Gateway
   - Validates JWT token (calls Auth Service if needed)
   - Routes to Review Service
3. Review Service
   - Validates request
   - Calls Book Service API: "GET /books/{bookId}" (sync)
   - Creates review record in reviews_db
   - Publishes event: "review.created" to Message Queue
4. Services listening to "review.created":
   - Notification Service: creates notification event
   - Book Service: updates review count (eventually)
5. Response returned through gateway to frontend
```

---

## Service Decomposition

### Overview Table

| Service          | Port | DB Name          | Primary Responsibility                    | Depends On       | Publishes Events                                     |
| ---------------- | ---- | ---------------- | ----------------------------------------- | ---------------- | ---------------------------------------------------- |
| **Auth**         | 3001 | auth_db          | User authentication, JWT tokens, sessions | -                | `user.registered`, `user.login`, `token.refreshed`   |
| **Book**         | 3002 | books_db         | Books, chapters, content management       | Auth             | `book.created`, `book.updated`, `chapter.added`      |
| **Review**       | 3003 | reviews_db       | Reviews, ratings                          | Auth, Book       | `review.created`, `review.updated`, `review.deleted` |
| **Shelf**        | 3004 | shelf_db         | Reading lists, saved books                | Auth, Book       | `shelf.created`, `book.shelved`, `shelf.updated`     |
| **Author**       | 3005 | author_db        | Author profiles, author management        | Auth, Book       | `author.created`, `author.updated`                   |
| **Notification** | 3006 | notifications_db | Notifications, subscriptions, alerts      | - (event-driven) | -                                                    |
| **User**         | 3007 | user_db          | User profiles, preferences, extended data | Auth             | `profile.updated`, `preferences.changed`             |

### Service Responsibilities

#### **Auth Service** (Foundation)

- User registration with email/password
- User login with JWT generation
- Token refresh logic
- Session management
- Password reset
- OAuth integration (future)
- **Database:** `users`, `sessions`, `refresh_tokens`, `password_resets`
- **Exports:** User entity, JWT validation logic

#### **Book Service** (Core Domain)

- Book CRUD operations
- Chapter management
- Preview/excerpt management
- Book search & filtering
- Book ratings aggregation (from Review Service)
- **Database:** `books`, `chapters`, `previews`, `book_genres`, `book_tags`
- **Dependencies:** Auth Service (user validation)
- **Challenges:** Needs review counts from Review Service

#### **Review Service** (User-Generated Content)

- Create, read, update, delete reviews
- Rating system (1-5 stars)
- Review moderation flags
- Helpful votes
- **Database:** `reviews`, `review_ratings`, `review_moderation`
- **Dependencies:** Auth Service (users), Book Service (books)
- **Challenges:**
  - Must validate book exists (call Book Service)
  - Must validate user exists (call Auth Service)
  - Eventual consistency: book review counts

#### **Shelf Service** (User Collections)

- Create/manage shelves (e.g., "Currently Reading", "Want to Read")
- Add/remove books from shelves
- Shelf sharing
- **Database:** `shelves`, `shelf_items`, `shelf_shares`
- **Dependencies:** Auth Service (users), Book Service (books)
- **Challenges:**
  - Saga Pattern: adding book might trigger multiple actions
  - Complex queries: "What books are my friends reading?"

#### **Author Service** (Content Creator Management)

- Author profiles & bios
- Author statistics (books, followers)
- Publishing history
- Author-book relationships
- **Database:** `authors`, `author_books`, `author_followers`
- **Dependencies:** Auth Service (users), Book Service (books)
- **Challenges:**
  - Book ownership: only the author can publish books

#### **Notification Service** (Event Listener)

- Notifications table (audit trail)
- Email/push notification sending
- Subscription preferences
- Notification templates
- **Database:** `notifications`, `notification_templates`, `notification_preferences`
- **Dependencies:** Event-driven only (doesn't call other services)
- **Events consumed:**
  - `user.registered` → Welcome email
  - `book.created` → Notify followers
  - `review.created` → Notify book author
  - `shelf.updated` → Notify collaborators
- **Design:** Pure event consumer, no REST API needed

#### **User Service** (Profile Management)

- User profiles (bio, avatar, etc.)
- User preferences
- User settings
- User statistics
- **Database:** `user_profiles`, `user_preferences`, `user_stats`
- **Dependencies:** Auth Service (users)
- **Note:** Extends user data from Auth Service without duplication

---

## Database Strategy

### Principles

**Golden Rule:** Each service owns its data. No service queries another service's database directly.

### Data Sharing Patterns

#### **Pattern 1: API Calls (Synchronous)**

When Service A needs data from Service B immediately:

```typescript
// Review Service creating a review
async function createReview(userId, bookId, rating) {
  // Step 1: Validate user exists (sync call to Auth)
  const user = await authServiceClient.getUser(userId);
  if (!user) throw new Error('User not found');

  // Step 2: Validate book exists (sync call to Book)
  const book = await bookServiceClient.getBook(bookId);
  if (!book) throw new Error('Book not found');

  // Step 3: Create review in own database
  const review = await db.reviews.create({
    userId,
    bookId,
    rating,
    ...
  });

  return review;
}
```

**Pros:** Immediate consistency, simple to understand  
**Cons:** Tight coupling, cascading failures, performance bottleneck

#### **Pattern 2: Event-Driven (Asynchronous)**

When Service A doesn't need immediate response:

```typescript
// Book Service: when book is created, publish event
async function createBook(data) {
  const book = await db.books.create(data);

  // Publish to message queue
  await messageQueue.publish('book.created', {
    bookId: book.id,
    authorId: book.authorId,
    title: book.title,
    ...
  });

  return book;
}

// Notification Service: listen for event
messageQueue.subscribe('book.created', async (event) => {
  // Send notification to author's followers
  await sendNotifications(...);
});
```

**Pros:** Loose coupling, non-blocking, scales better  
**Cons:** Eventual consistency, harder to debug

#### **Pattern 3: Saga Pattern (Distributed Transactions)**

When multiple steps must succeed or all fail:

```typescript
// Example: Add book to shelf + create notification
// Orchestrator approach:

async function addBookToShelf(userId, bookId, shelfId) {
  const saga = new Saga();

  try {
    // Step 1: Add to shelf
    const result1 = await saga.execute(
      () => shelfService.addBook(userId, bookId, shelfId),
      () => shelfService.removeBook(userId, bookId, shelfId) // Compensate
    );

    // Step 2: Create notification
    const result2 = await saga.execute(
      () => notificationService.notify(userId, 'Book added to shelf'),
      () => notificationService.deleteNotification(...) // Compensate
    );

    return { shelf: result1, notification: result2 };
  } catch (error) {
    await saga.compensate(); // Undo all successful steps
    throw error;
  }
}
```

**Use Case:** Operations that must be atomic across services  
**Complexity:** High, but essential for data consistency

### Handling Orphaned Data

```
Problem: User deletes account
  → Auth Service deletes user record
  → Review Service has orphaned reviews (user_id no longer exists)
  → Shelf Service has orphaned shelf_items

Solution: Event-Driven Cleanup
1. Auth Service publishes "user.deleted" event
2. Review Service consumes event, marks reviews as deleted or anonymizes
3. Shelf Service consumes event, cleans up shelves
4. User Service consumes event, deletes profile
```

### Database Replication for Read-Heavy Queries

Some services may need cross-service data:

```
Book Service wants to show "top reviewers":
  Option A (Bad): Query Review Service every time
  Option B (Good): Subscribe to "review.created" event
             Store reviewer stats locally
             Keep eventually consistent copy
```

---

## Technology Stack

### Backend Services

```yaml
Runtime & Language:
  - Node.js 18+
  - TypeScript (strict mode)

Framework:
  - Express.js (simple, familiar)
  - OR Fastify (faster, more features)

ORM/Database:
  - Prisma (type-safe, great for microservices)
  - PostgreSQL 14+ per service

Message Queue:
  - Redis Pub/Sub (simple, good for learning)
  - RabbitMQ (production-grade, feature-rich)

API Gateway:
  - express-http-proxy OR
  - custom routing with express
  - passport.js for JWT validation

Authentication:
  - JWT tokens (RS256 or HS256)
  - passport-jwt for validation

Testing:
  - Vitest (fast, familiar)
  - Supertest (HTTP testing)
  - Docker for integration tests

Monitoring & Logging:
  - Pino (fast JSON logger)
  - OpenTelemetry (distributed tracing)
  - Prometheus (metrics)

Containers & Orchestration:
  - Docker (per-service containers)
  - Docker Compose (local development)
```

### Frontend (Unchanged)

```yaml
- React + Vite (existing)
- Adjust API endpoints to point to API Gateway
```

---

## Implementation Roadmap

### Phase 1: Foundation & Setup (Week 1)

**Goal:** Get basic infrastructure running, understand project structure

#### Tasks:

- [ ] **Create new project directory**

  ```bash
  mkdir book-review-microservices
  cd book-review-microservices
  ```

- [ ] **Set up monorepo structure**

  ```
  book-review-microservices/
  ├── packages/
  │   ├── shared/          (shared code)
  │   ├── gateway/         (API Gateway)
  │   └── services/        (all 7 services)
  ├── docker-compose.yml
  ├── .env.example
  └── README.md
  ```

- [ ] **Create shared package**
  - Common types (User, Book, Review, etc.)
  - Response/error utilities
  - Pagination helpers
  - Validation schemas
  - Message queue client
  - HTTP client with circuit breaker

- [ ] **Set up Docker Compose**
  - PostgreSQL containers (x7 for each service DB)
  - Redis for pub/sub + caching
  - All services configured to start

- [ ] **Create API Gateway**
  - Routes: `/api/auth/*`, `/api/books/*`, `/api/reviews/*`, etc.
  - JWT validation middleware
  - Request logging
  - Error handling
  - CORS configuration

- [ ] **Extract & Deploy Auth Service**
  - User registration endpoint
  - Login endpoint with JWT
  - Token validation endpoint
  - Refresh token logic
  - Own PostgreSQL database
  - Docker container

**Deliverable:**

- Auth Service running on port 3001
- API Gateway routing to Auth Service
- Docker Compose running all databases
- Can register/login via gateway

**Time Estimate:** 3-4 days

---

### Phase 2: Core Services & Sync Communication (Week 2)

**Goal:** Extract Book & Review services, learn service-to-service communication

#### Tasks:

- [ ] **Extract Book Service**
  - Book CRUD endpoints
  - Chapter management
  - Search & filtering
  - Calls Auth Service to validate users
  - Own database (books_db)
  - Docker container

- [ ] **Implement HTTP client with Circuit Breaker**
  - Service-to-service HTTP calls
  - Retry logic (exponential backoff)
  - Circuit breaker (fail-fast)
  - Timeout handling
  - Request tracing

- [ ] **Extract Review Service**
  - Review CRUD endpoints
  - Calls Book Service: validate book exists
  - Calls Auth Service: validate user exists
  - Handles service failures gracefully
  - Own database (reviews_db)

- [ ] **Add Basic Request Tracing**
  - Request ID generation
  - Pass request ID through all service calls
  - Log request ID everywhere

- [ ] **Implement Error Handling Across Services**
  - Service unavailable → graceful error
  - Timeout → retry or fallback
  - Validation errors → clear messages

**Challenges You'll Face:**

- ❌ "Book Service is down, Review Service fails"
  - Solution: Implement circuit breaker + fallback response
- ❌ "Cascading timeouts when services are slow"
  - Solution: Add request timeouts + parallel requests

**Deliverable:**

- Book Service (3002) + Review Service (3003) running
- Cross-service calls working
- Circuit breaker in place
- Can create reviews with validation

**Time Estimate:** 4-5 days

---

### Phase 3: Event-Driven Architecture (Week 3)

**Goal:** Learn asynchronous communication, message queues, eventual consistency

#### Tasks:

- [ ] **Set up Message Queue (Redis Pub/Sub)**
  - Connection pooling
  - Message producer wrapper
  - Message consumer wrapper
  - Error handling & retries
  - Dead letter queue for failed messages

- [ ] **Implement Event Publishing**
  - Book Service publishes: `book.created`, `book.updated`
  - Review Service publishes: `review.created`, `review.deleted`
  - Idempotency: handle duplicate events

- [ ] **Extract Notification Service**
  - Consumes: `review.created`, `book.created`, `shelf.updated`
  - Sends notifications (log to console, can add email later)
  - Stores notification records
  - Pure event consumer (no REST API needed)

- [ ] **Extract Author Service**
  - Author management
  - Author-book relationships
  - Publishes: `author.created`, `author.updated`

- [ ] **Handle Eventual Consistency**
  - Book Service doesn't have real-time review count
  - Book Service subscribes to `review.created` event
  - Maintains eventually-consistent review count cache

- [ ] **Implement Idempotency**
  - Message IDs to prevent duplicate processing
  - Idempotency keys for notifications
  - Handle replayed events safely

**Challenges You'll Face:**

- ❌ "Same notification sent twice"
  - Solution: Idempotency keys + message deduplication
- ❌ "Message arrives but service is down"
  - Solution: Dead letter queue + retry mechanism
- ❌ "How do I debug cross-service events?"
  - Solution: Event logging + tracing

**Deliverable:**

- Message queue working
- Notification Service running
- Author Service running
- Events flowing between services
- Eventual consistency working

**Time Estimate:** 4-5 days

---

### Phase 4: Distributed Transactions & Complex Patterns (Week 4)

**Goal:** Master Saga pattern, data consistency, complex workflows

#### Tasks:

- [ ] **Extract Shelf Service**
  - Shelf management
  - Add book to shelf (calls Book Service)
  - Implement: **Saga Pattern**
    - When adding book to shelf:
      1. Validate book exists
      2. Add to shelf
      3. Create notification
      4. Update author's stats
    - If any step fails: rollback previous steps

- [ ] **Extract User Service**
  - User profiles (extends Auth user data)
  - User preferences
  - User statistics

- [ ] **Implement Saga Pattern**
  - Orchestrator approach:
    - Central service coordinates multi-step transactions
    - Example: "Add book to shelf" saga
  - Define compensating transactions (rollback logic)
  - Handle partial failures

- [ ] **Add Distributed Tracing**
  - Trace request across all services
  - Visualize service dependencies
  - Identify bottlenecks

- [ ] **Implement Service Discovery (Optional)**
  - Services register their endpoints
  - Gateway discovers services dynamically
  - Handle service restarts

**Challenges You'll Face:**

- ❌ "Multi-step transaction failed halfway"
  - Solution: Compensating transactions (undo what was done)
- ❌ "Message arrives twice, action is repeated"
  - Solution: Idempotent operations
- ❌ "Debugging saga across 5 services is hard"
  - Solution: Distributed tracing + unified logging

**Deliverable:**

- All 7 services running
- Saga patterns working
- Distributed tracing visible
- Complex workflows handled correctly

**Time Estimate:** 5-6 days

---

### Phase 5: Production Readiness (Week 5+)

**Goal:** Make it production-like, operations-ready

#### Tasks:

- [ ] **Observability**
  - Centralized logging (ELK Stack or similar)
  - Distributed tracing (Jaeger)
  - Metrics collection (Prometheus)
  - Service dashboards

- [ ] **Resilience**
  - Health check endpoints per service
  - Liveness & readiness probes
  - Graceful shutdown (drain in-flight requests)
  - Service restart policies

- [ ] **Testing**
  - Unit tests per service
  - Integration tests (service + DB)
  - End-to-end tests across services
  - Contract tests between services

- [ ] **Documentation**
  - API documentation (OpenAPI/Swagger)
  - Architecture decision records (ADR)
  - Deployment guide
  - Troubleshooting guide

- [ ] **Deployment**
  - Docker image optimization
  - Docker Compose for dev, Kubernetes for prod (optional)
  - CI/CD pipeline (GitHub Actions)
  - Database migrations strategy

- [ ] **Security**
  - Environment variables (.env files)
  - API rate limiting
  - Input validation
  - CORS configuration

**Deliverable:**

- Fully observable system
- Production-ready deployment
- Comprehensive tests
- Can scale individual services

**Time Estimate:** Ongoing, 5-10 days

---

## Core Patterns & Challenges

### Resilience Patterns

#### Circuit Breaker

```
State: CLOSED (normal)
  ↓
N failures in 30s
  ↓
State: OPEN (fail-fast)
  ↓
After 60s, try one request
  ↓
State: HALF_OPEN
  ↓
Request succeeds → CLOSED
Request fails → OPEN
```

**When to use:** All service-to-service HTTP calls

#### Retry with Exponential Backoff

```
Request fails
  ↓
Retry after 100ms
  ↓
Retry fails
  ↓
Retry after 200ms
  ↓
Retry fails
  ↓
Retry after 400ms
  ↓
Give up after 3 retries
```

**When to use:** Transient failures (network hiccup)

#### Timeout

```
Request sent
  ↓
No response after 5s
  ↓
Abort request
  ↓
Return error
```

**When to use:** Prevent cascading timeouts

### Data Consistency Patterns

#### Saga Pattern (Distributed Transactions)

**Scenario:** Adding book to shelf must:

1. Validate book exists
2. Create shelf_item record
3. Publish event to notification service
4. Update author stats

If step 3 fails, we need to undo step 2.

```typescript
async function addBookToShelf(userId, bookId, shelfId) {
  const saga = new Saga();
  const compensations = [];

  try {
    // Step 1: Validate book (no compensation needed)
    await bookService.getBook(bookId);

    // Step 2: Add to shelf
    const shelfItem = await saga.execute(
      () => shelfService.createShelfItem(userId, bookId, shelfId),
      () => shelfService.deleteShelfItem(shelfItem.id) // Compensation
    );
    compensations.push(() => shelfService.deleteShelfItem(shelfItem.id));

    // Step 3: Publish event
    await saga.execute(
      () => notificationService.notifyAddedToShelf(userId, bookId),
      () => notificationService.deleteNotification(...) // Compensation
    );

    return shelfItem;
  } catch (error) {
    // Execute all compensations in reverse order
    for (let i = compensations.length - 1; i >= 0; i--) {
      await compensations[i]();
    }
    throw error;
  }
}
```

#### Idempotency

**Problem:** Same event processed twice

```
Message: "review.created"
  ↓
Notification Service received it
  ↓
Processing...
  ↓
(Network error, message redelivered)
  ↓
Notification Service received it again
  ↓
Problem: Two notifications sent!
```

**Solution:** Idempotency Keys

```typescript
// Store idempotency key in database
async function handleReviewCreated(event) {
  const idempotencyKey = event.reviewId + ":" + event.userId;

  // Check if already processed
  const existing = await db.processedEvents.findOne({ idempotencyKey });
  if (existing) return; // Already handled

  // Process event
  await sendNotification(event);

  // Mark as processed
  await db.processedEvents.create({ idempotencyKey });
}
```

#### Eventual Consistency

**Scenario:** Review count on book

- Review Service has real-time review count
- Book Service doesn't immediately know
- Book Service subscribes to `review.created` event
- Eventually (within seconds) Book Service updates its count

```typescript
// Book Service
messageQueue.subscribe("review.created", async (event) => {
  // Update review count in our database
  await db.books.update(
    { id: event.bookId },
    { reviewCount: db.raw("reviewCount + 1") },
  );
});
```

### Common Failures & Solutions

| Failure                  | Cause                                | Solution                                         |
| ------------------------ | ------------------------------------ | ------------------------------------------------ |
| Service won't start      | Database not ready                   | Docker compose depends_on + health checks        |
| Cross-service call fails | Service is down                      | Circuit breaker + fallback                       |
| Event lost               | Message queue crashed                | Persistent queue (RabbitMQ) or Redis persistence |
| Data inconsistency       | Saga partially completed             | Compensating transactions                        |
| Cascading failures       | Service A slow → Service B times out | Timeout + circuit breaker + async where possible |
| Duplicate notifications  | Message redelivered                  | Idempotency keys                                 |

---

## Repository Structure

### Directory Layout

```
microservices-practice/
│
├── packages/
│   ├── shared/
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── index.ts           (User, Book, Review, etc.)
│   │   │   │   ├── errors.ts          (AppError, ServiceError)
│   │   │   │   └── events.ts          (Event types)
│   │   │   ├── utils/
│   │   │   │   ├── response.ts        (Success/error responses)
│   │   │   │   ├── pagination.ts
│   │   │   │   ├── validators.ts      (Common validation)
│   │   │   │   ├── logger.ts          (Centralized logging)
│   │   │   │   └── tracer.ts          (Request tracing)
│   │   │   ├── clients/
│   │   │   │   ├── httpClient.ts      (With circuit breaker)
│   │   │   │   └── messageQueue.ts    (Pub/sub wrapper)
│   │   │   └── middleware/
│   │   │       ├── errorHandler.ts
│   │   │       ├── requestLogger.ts
│   │   │       └── asyncHandler.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── services/
│       ├── auth-service/
│       │   ├── src/
│       │   │   ├── server.ts
│       │   │   ├── app.ts
│       │   │   ├── controllers/
│       │   │   ├── routes/
│       │   │   ├── services/
│       │   │   ├── models/
│       │   │   ├── middleware/
│       │   │   └── events/
│       │   ├── prisma/
│       │   │   ├── schema.prisma      (Auth-specific schema)
│       │   │   └── migrations/
│       │   ├── tests/
│       │   ├── Dockerfile
│       │   ├── .dockerignore
│       │   ├── package.json
│       │   └── tsconfig.json
│       │
│       ├── book-service/
│       ├── review-service/
│       ├── shelf-service/
│       ├── author-service/
│       ├── notification-service/
│       └── user-service/
│
├── gateway/
│   ├── src/
│   │   ├── server.ts
│   │   ├── app.ts
│   │   ├── routes/
│   │   │   ├── auth.ts              (Routes to Auth Service)
│   │   │   ├── books.ts             (Routes to Book Service)
│   │   │   ├── reviews.ts           (Routes to Review Service)
│   │   │   ├── shelves.ts           (Routes to Shelf Service)
│   │   │   ├── authors.ts           (Routes to Author Service)
│   │   │   ├── notifications.ts     (Routes to Notification Service)
│   │   │   └── users.ts             (Routes to User Service)
│   │   ├── middleware/
│   │   │   ├── auth.ts              (JWT validation)
│   │   │   ├── errorHandler.ts
│   │   │   └── requestLogger.ts
│   │   └── utils/
│   │       └── serviceDiscovery.ts
│   ├── tests/
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── docker-compose.yml               (All services + databases)
├── .env.example
├── .gitignore
├── README.md
├── ARCHITECTURE.md
└── DEPLOYMENT.md
```

### Key Files

- **docker-compose.yml:** Defines all services, databases, networks
- **packages/shared/:** Common code (types, utilities, clients)
- **Dockerfile:** Template for service containers
- **.env.example:** Environment variables template

---

## Communication Protocols

### Service-to-Service Communication

#### HTTP/REST (Synchronous)

When you need immediate response:

```typescript
// Review Service calling Book Service
import { httpClient } from "@shared/clients";

async function validateBook(bookId: string) {
  try {
    const response = await httpClient.get(
      `http://book-service:3002/api/books/${bookId}`,
      { timeout: 5000 },
    );
    return response.data;
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      throw new ServiceUnavailableError("Book Service unavailable");
    }
    throw error;
  }
}
```

**Service URLs (Docker internal):**

- Auth: `http://auth-service:3001`
- Book: `http://book-service:3002`
- Review: `http://review-service:3003`
- Shelf: `http://shelf-service:3004`
- Author: `http://author-service:3005`
- Notification: `http://notification-service:3006`
- User: `http://user-service:3007`

#### Message Queue Events (Asynchronous)

When you don't need immediate response:

```typescript
// Book Service publishing event
import { messageQueue } from "@shared/clients";

async function createBook(data) {
  const book = await db.books.create(data);

  await messageQueue.publish("book.created", {
    bookId: book.id,
    title: book.title,
    authorId: book.authorId,
    timestamp: new Date(),
  });

  return book;
}

// Notification Service consuming event
messageQueue.subscribe("book.created", async (event) => {
  const author = await db.authors.findOne({ id: event.authorId });
  const followers = await db.followers.find({ authorId: author.id });

  for (const follower of followers) {
    await notificationService.send(follower.id, {
      title: `New book: ${event.title}`,
      body: `by ${author.name}`,
    });
  }
});
```

### Event Catalog

| Event             | Publisher      | Consumers                  | Payload                                |
| ----------------- | -------------- | -------------------------- | -------------------------------------- |
| `user.registered` | Auth Service   | Notification, User Service | `{ userId, email, name }`              |
| `user.login`      | Auth Service   | User Service               | `{ userId, loginTime }`                |
| `book.created`    | Book Service   | Notification Service       | `{ bookId, title, authorId }`          |
| `book.updated`    | Book Service   | -                          | `{ bookId, title }`                    |
| `chapter.added`   | Book Service   | Notification Service       | `{ bookId, chapterId, bookTitle }`     |
| `review.created`  | Review Service | Notification, Book Service | `{ reviewId, bookId, userId, rating }` |
| `review.deleted`  | Review Service | Notification, Book Service | `{ reviewId, bookId }`                 |
| `book.shelved`    | Shelf Service  | Notification Service       | `{ shelfId, bookId, userId }`          |
| `author.created`  | Author Service | Notification Service       | `{ authorId, name }`                   |

---

## Testing Strategy

### Unit Tests (Per Service)

```typescript
// review-service/__tests__/review.service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewService } from "../src/services/reviewService";

describe("ReviewService", () => {
  let reviewService: ReviewService;
  let mockDb: any;
  let mockBookClient: any;

  beforeEach(() => {
    mockDb = { reviews: { create: vi.fn() } };
    mockBookClient = { getBook: vi.fn() };
    reviewService = new ReviewService(mockDb, mockBookClient);
  });

  it("should create review when book exists", async () => {
    mockBookClient.getBook.mockResolvedValue({ id: "book-1" });
    mockDb.reviews.create.mockResolvedValue({ id: "review-1" });

    const review = await reviewService.createReview({
      bookId: "book-1",
      userId: "user-1",
      rating: 5,
    });

    expect(review.id).toBe("review-1");
    expect(mockBookClient.getBook).toHaveBeenCalledWith("book-1");
  });

  it("should throw error when book not found", async () => {
    mockBookClient.getBook.mockRejectedValue(new Error("Book not found"));

    await expect(
      reviewService.createReview({
        bookId: "invalid",
        userId: "user-1",
        rating: 5,
      }),
    ).rejects.toThrow("Book not found");
  });
});
```

### Integration Tests (Service + DB)

```typescript
// review-service/__tests__/review.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/db";
import { app } from "../src/app";

describe("Review Service Integration", () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it("should create review and persist to database", async () => {
    const response = await request(app).post("/api/reviews").send({
      bookId: "book-1",
      userId: "user-1",
      rating: 5,
      text: "Great book!",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.rating).toBe(5);

    const review = await db.reviews.findOne({ id: response.body.data.id });
    expect(review).toBeDefined();
  });
});
```

### End-to-End Tests (Cross-Service)

```typescript
// e2e/__tests__/create-review.e2e.test.ts
describe("Create Review E2E", () => {
  it("should create book, then review, and notify author", async () => {
    // 1. Create book
    const bookRes = await request(gateway)
      .post("/api/books")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ title: "Test Book" });

    expect(bookRes.status).toBe(201);
    const bookId = bookRes.body.data.id;

    // 2. Create review
    const reviewRes = await request(gateway)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${readerToken}`)
      .send({ bookId, rating: 5, text: "Excellent!" });

    expect(reviewRes.status).toBe(201);

    // 3. Wait for event processing (eventual consistency)
    await new Promise((r) => setTimeout(r, 100));

    // 4. Verify notification was created
    const notif = await notificationDb.notifications.findOne({
      userId: authorId,
    });
    expect(notif.title).toContain("new review");
  });
});
```

### Test Pyramid

```
           / \
          /   \  E2E Tests
         /─────\  (5-10% coverage)
        /       \
       /         \
      ───────────  Integration Tests
     /             (20-30% coverage)
    /
   ─────────────── Unit Tests
  /                 (60-70% coverage)
 /___________________
```

---

## Deployment & Operations

### Local Development

```bash
# Start all services, databases, message queue
docker-compose up

# View logs
docker-compose logs -f

# Stop all
docker-compose down
```

### Docker Compose Configuration

```yaml
version: "3.8"

services:
  # API Gateway
  gateway:
    build: ./gateway
    ports:
      - "3000:3000"
    environment:
      AUTH_SERVICE_URL: http://auth-service:3001
      BOOK_SERVICE_URL: http://book-service:3002
      # ... etc
    depends_on:
      - auth-service

  # Services
  auth-service:
    build: ./services/auth-service
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://user:pass@auth-db:5432/auth_db
      REDIS_URL: redis://redis:6379
    depends_on:
      auth-db:
        condition: service_healthy
      redis:
        condition: service_healthy

  book-service:
    build: ./services/book-service
    # ... similar config

  # Databases
  auth-db:
    image: postgres:14
    environment:
      POSTGRES_DB: auth_db
      POSTGRES_PASSWORD: password
    volumes:
      - auth_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]

  # ... other DBs

  # Message Queue
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

volumes:
  auth_db_data:
  # ... other db volumes
```

### Production Deployment (Kubernetes)

Each service gets a deployment:

```yaml
# auth-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
        - name: auth-service
          image: myregistry/auth-service:latest
          ports:
            - containerPort: 3001
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: auth-service-secrets
                  key: database-url
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
          readinessProbe:
            httpGet:
              path: /ready
              port: 3001
```

### Monitoring Checklist

- [ ] Log aggregation (ELK, CloudWatch, etc.)
- [ ] Distributed tracing (Jaeger, Zipkin)
- [ ] Metrics collection (Prometheus)
- [ ] Alerts (latency, error rate, service health)
- [ ] Dashboards (service dependencies, request flow)
- [ ] Uptime monitoring (synthetic checks)

---

## Key Learnings

By completing this project, you will understand:

### Architecture & Design

- ✅ Service boundaries and data ownership
- ✅ When to use sync vs async communication
- ✅ Database per service pattern and its tradeoffs
- ✅ Monolith decomposition strategies
- ✅ API Gateway pattern

### Communication Patterns

- ✅ Service-to-service REST calls
- ✅ Publish/Subscribe with message queues
- ✅ Event-driven architecture
- ✅ Event sourcing basics
- ✅ CQRS (Command Query Responsibility Segregation) basics

### Resilience

- ✅ Circuit breaker pattern (prevent cascading failures)
- ✅ Retry with exponential backoff
- ✅ Timeouts and bulkheads
- ✅ Graceful degradation
- ✅ Handling service failures

### Data Consistency

- ✅ Distributed transactions (Saga pattern)
- ✅ Eventual consistency
- ✅ Idempotency
- ✅ Data synchronization between services
- ✅ Handling orphaned data

### Operations

- ✅ Docker containerization and Docker Compose
- ✅ Kubernetes basics (optional)
- ✅ Centralized logging
- ✅ Distributed tracing
- ✅ Service monitoring and alerting
- ✅ Health checks and readiness probes

### Debugging & Testing

- ✅ Debugging distributed systems
- ✅ Request tracing across services
- ✅ Unit testing with mocks
- ✅ Integration testing
- ✅ End-to-end testing across services
- ✅ Contract testing between services

---

## Common Gotchas

### Database Migrations

Each service owns its migrations. Run independently:

```bash
cd services/auth-service && npx prisma migrate deploy
cd services/book-service && npx prisma migrate deploy
```

### Service Discovery in Docker

Use service name as hostname:

```typescript
// ✅ Correct (within Docker)
const url = "http://book-service:3002/api/books";

// ❌ Wrong (won't work in Docker)
const url = "http://localhost:3002/api/books";
```

### Environment Variables

Each service needs its own .env with:

- Database connection string
- Message queue URL
- Other service URLs
- JWT secret
- Port

### Debugging Failing Requests

Always enable request tracing:

```bash
docker-compose logs -f review-service | grep REQUEST_ID
docker-compose logs -f book-service | grep REQUEST_ID
```

---

## Next Steps

1. **Create the new project directory** following this structure
2. **Start with Phase 1** - get Auth Service + Gateway running
3. **Reference this document** as you build each phase
4. **Track your progress** - update status as you go
5. **Document decisions** - why you chose certain patterns

---

## Additional Resources

- [Microservices Patterns - Chris Richardson](https://microservices.io/)
- [Sam Newman - Building Microservices](http://samnewman.org/)
- [12 Factor App](https://12factor.net/)
- [Distributed Systems Design - Martin Kleppmann](https://dataintensive.net/)
- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)

---

**Last Updated:** May 22, 2026  
**Status:** Ready for implementation  
**Total Estimated Time:** 4-5 weeks for full implementation
