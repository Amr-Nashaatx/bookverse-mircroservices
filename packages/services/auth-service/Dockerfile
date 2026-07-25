# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy root package files for monorepo
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/services/auth-service ./packages/services/auth-service
COPY packages/shared ./packages/shared

# Install shared package dependencies
WORKDIR /app/packages/shared
RUN npm install
RUN npm run build

# Install and build the auth service
WORKDIR /app/packages/services/auth-service
RUN npm install
RUN npm run build

# Runtime stage
FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/services/auth-service ./packages/services/auth-service
COPY packages/shared ./packages/shared

# Install production dependencies for auth service only
WORKDIR /app/packages/services/auth-service
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/packages/services/auth-service/dist ./packages/services/auth-service/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

WORKDIR /app/packages/services/auth-service

EXPOSE 3001

# Start the service. Run migrations manually with `npm run migrate:auth` from the repo root.
CMD ["npm", "start"]
