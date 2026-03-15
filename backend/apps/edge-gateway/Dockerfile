# ── Stage 1: Build ──
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared-contracts/package.json packages/shared-contracts/
COPY packages/common-utils/package.json packages/common-utils/
COPY packages/device-adapters/package.json packages/device-adapters/
COPY apps/edge-gateway/package.json apps/edge-gateway/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY apps/edge-gateway/ apps/edge-gateway/

# Build
RUN pnpm turbo build --filter=@aion/edge-gateway

# ── Stage 2: Production ──
FROM node:20-slim AS production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Security: run as non-root
RUN groupadd -r aion && useradd -r -g aion -m aion
WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared-contracts/package.json packages/shared-contracts/
COPY --from=builder /app/packages/shared-contracts/dist/ packages/shared-contracts/dist/
COPY --from=builder /app/packages/common-utils/package.json packages/common-utils/
COPY --from=builder /app/packages/common-utils/dist/ packages/common-utils/dist/
COPY --from=builder /app/packages/device-adapters/package.json packages/device-adapters/
COPY --from=builder /app/packages/device-adapters/dist/ packages/device-adapters/dist/
COPY --from=builder /app/apps/edge-gateway/package.json apps/edge-gateway/
COPY --from=builder /app/apps/edge-gateway/dist/ apps/edge-gateway/dist/
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/apps/edge-gateway/node_modules/ apps/edge-gateway/node_modules/

USER aion
EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3100/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "apps/edge-gateway/dist/index.js"]
