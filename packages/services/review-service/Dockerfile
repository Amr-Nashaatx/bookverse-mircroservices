# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy root package files for monorepo
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/services/review-service ./packages/services/review-service
COPY packages/shared ./packages/shared

# Install shared package dependencies
WORKDIR /app/packages/shared
RUN npm install
RUN npm run build

# Install and build the review service (`npm run build` = tsc).
# The Prisma client is generated on the host and copied in via the build context
# (mirrors book-service). We do NOT run `prisma generate` in the image: it's a
# portable WASM client (pg driver adapter), so the host-generated output runs here,
# and prisma generate is unreliable on this Linux/Node image anyway.
WORKDIR /app/packages/services/review-service
RUN npm install
RUN npm run build

# Runtime stage
FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/services/review-service ./packages/services/review-service
COPY packages/shared ./packages/shared

# Install production dependencies for review service only
WORKDIR /app/packages/services/review-service
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/packages/services/review-service/dist ./packages/services/review-service/dist
COPY --from=builder /app/packages/services/review-service/src/generated ./packages/services/review-service/src/generated
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

WORKDIR /app/packages/services/review-service

EXPOSE 3003

# Start the service. In dev, migrate from the HOST: `npm run migrate:reviews:deploy`
# (or :dev to author one). Do not migrate from inside this container in dev --
# compose mounts only src/, so the baked-in prisma/ here lags the working tree.
CMD ["npm", "start"]
