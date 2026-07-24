# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy root package files for monorepo
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/services/book-service ./packages/services/book-service
COPY packages/shared ./packages/shared

# Install shared package dependencies
WORKDIR /app/packages/shared
RUN npm install
RUN npm run build

# Install and build the book service (build runs `prisma generate && tsc`)
WORKDIR /app/packages/services/book-service
RUN npm install
RUN npm run build

# Runtime stage
FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/services/book-service ./packages/services/book-service
COPY packages/shared ./packages/shared

# Install production dependencies for book service only
WORKDIR /app/packages/services/book-service
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/packages/services/book-service/dist ./packages/services/book-service/dist
COPY --from=builder /app/packages/services/book-service/src/generated ./packages/services/book-service/src/generated
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

WORKDIR /app/packages/services/book-service

EXPOSE 3002

# Start the service. Run migrations manually with `npm run migrate:books` from the repo root.
CMD ["npm", "start"]
