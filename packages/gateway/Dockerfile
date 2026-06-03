# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy root package files for monorepo
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/gateway ./packages/gateway
COPY packages/shared ./packages/shared

# Install shared package dependencies
WORKDIR /app/packages/shared
RUN npm install
RUN npm run build

# Install and build the gateway
WORKDIR /app/packages/gateway
RUN npm install
RUN npm run build

# Runtime stage
FROM node:24-alpine

WORKDIR /app

COPY package.json ./
COPY tsconfig.base.json ./
COPY packages/gateway ./packages/gateway
COPY packages/shared ./packages/shared

# Install production dependencies for gateway only
WORKDIR /app/packages/gateway
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/packages/gateway/dist ./packages/gateway/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

WORKDIR /app/packages/gateway

EXPOSE 3000

# Start the gateway service
CMD ["npm", "start"]
