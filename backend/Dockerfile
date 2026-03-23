# ==========================================================
# Clave Seguridad: Production Backend Dockerfile
# ==========================================================
FROM node:20-bullseye-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /usr/src/app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend-api/package.json apps/backend-api/
COPY packages/common-utils/package.json packages/common-utils/
COPY packages/shared-contracts/package.json packages/shared-contracts/
COPY packages/device-adapters/package.json packages/device-adapters/
COPY apps/edge-gateway/package.json apps/edge-gateway/

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build all packages
RUN pnpm run -r build

# ==========================================================
# Production stage — slim runtime
# ==========================================================
FROM node:20-bullseye-slim

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /usr/src/app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/backend-api/package.json apps/backend-api/
COPY packages/common-utils/package.json packages/common-utils/
COPY packages/shared-contracts/package.json packages/shared-contracts/
COPY packages/device-adapters/package.json packages/device-adapters/
COPY apps/edge-gateway/package.json apps/edge-gateway/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built output from builder
COPY --from=builder /usr/src/app/apps/backend-api/dist apps/backend-api/dist
COPY --from=builder /usr/src/app/packages/common-utils/dist packages/common-utils/dist
COPY --from=builder /usr/src/app/packages/shared-contracts/dist packages/shared-contracts/dist
COPY --from=builder /usr/src/app/packages/device-adapters/dist packages/device-adapters/dist

# Copy migration files
COPY apps/backend-api/src/db/migrations apps/backend-api/src/db/migrations

EXPOSE 3000

WORKDIR /usr/src/app/apps/backend-api

CMD ["node", "dist/index.js"]
