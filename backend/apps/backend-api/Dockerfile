# ── Stage 1: Build ──
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/shared-contracts/package.json packages/shared-contracts/
COPY packages/common-utils/package.json packages/common-utils/
COPY apps/backend-api/package.json apps/backend-api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ packages/
COPY apps/backend-api/ apps/backend-api/

# Build
RUN pnpm turbo build --filter=@aion/backend-api

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
COPY --from=builder /app/apps/backend-api/package.json apps/backend-api/
COPY --from=builder /app/apps/backend-api/dist/ apps/backend-api/dist/
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/apps/backend-api/node_modules/ apps/backend-api/node_modules/

USER aion
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "apps/backend-api/dist/index.js"]
