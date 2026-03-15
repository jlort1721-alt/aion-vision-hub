# Deployment

This document covers deployment options for the AION Vision Hub backend, including Docker Compose for full-stack deployment, individual service deployment, environment variable reference, database setup, health checks, and scaling considerations.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Docker Compose Deployment](#docker-compose-deployment)
- [Individual Service Deployment](#individual-service-deployment)
- [Environment Variables Reference](#environment-variables-reference)
- [Database Setup](#database-setup)
- [Health Check Endpoints](#health-check-endpoints)
- [Scaling Considerations](#scaling-considerations)

---

## Prerequisites

| Component   | Version  | Purpose                                    |
|------------|----------|--------------------------------------------|
| Node.js    | >= 20.0  | Runtime for backend services               |
| pnpm       | >= 9.15  | Package manager (workspace support)        |
| Docker     | >= 24.0  | Container runtime                          |
| Docker Compose | >= 2.20 | Multi-container orchestration          |
| PostgreSQL | >= 16    | Primary database (can run via Docker)      |

---

## Docker Compose Deployment

The full stack can be deployed with a single command using Docker Compose.

### Quick Start

```bash
cd backend

# 1. Create environment file
cp .env.example .env

# 2. Configure required secrets
#    JWT_SECRET must be at least 32 characters
echo "JWT_SECRET=$(openssl rand -base64 48)" >> .env

# 3. Start all services
docker compose up -d

# 4. Check service health
docker compose ps
docker compose logs -f backend-api
```

### Services Deployed

| Service        | Image                       | Port(s)            | Depends On    |
|---------------|-----------------------------|--------------------|---------------|
| `postgres`    | `postgres:16-alpine`        | 5432               | --            |
| `backend-api` | Built from `apps/backend-api/Dockerfile` | 3000   | `postgres`    |
| `edge-gateway`| Built from `apps/edge-gateway/Dockerfile` | 3100  | `backend-api` |
| `mediamtx`    | `bluenviron/mediamtx:latest`| 8554, 8888, 8889, 9997 | --       |

### Service Startup Order

```
1. postgres     (waits for pg_isready health check)
2. mediamtx     (starts independently)
3. backend-api  (waits for postgres healthy)
4. edge-gateway (waits for backend-api healthy)
```

### Stopping Services

```bash
# Stop all services (preserve data volumes)
docker compose down

# Stop and remove data volumes
docker compose down -v

# Rebuild images after code changes
docker compose build
docker compose up -d
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend-api
docker compose logs -f edge-gateway

# Last 100 lines
docker compose logs --tail=100 backend-api
```

---

## Individual Service Deployment

### Backend API (without Docker)

```bash
cd backend

# Install dependencies
pnpm install

# Build all packages (required -- backend-api depends on shared packages)
pnpm build

# Set up environment
export DATABASE_URL="postgres://aion:password@localhost:5432/aion_vision_hub"
export JWT_SECRET="your-jwt-secret-minimum-32-characters-long"
export NODE_ENV=production
export PORT=3000

# Run database migrations
pnpm db:migrate

# Start the server
node apps/backend-api/dist/index.js
```

### Edge Gateway (without Docker)

```bash
cd backend

# Build all packages
pnpm build

# Set up environment
export JWT_SECRET="your-jwt-secret-minimum-32-characters-long"  # Must match Backend API
export GATEWAY_ID="gw-site-01"
export BACKEND_API_URL="http://backend-api-host:3000"
export MEDIAMTX_API_URL="http://localhost:9997"
export NODE_ENV=production
export PORT=3100

# Start the server
node apps/edge-gateway/dist/index.js
```

### Development Mode

```bash
cd backend
pnpm install

# Start both services with hot reload
pnpm dev

# Or start individually
pnpm dev:api      # Backend API only
pnpm dev:gateway  # Edge Gateway only
```

---

## Environment Variables Reference

### Shared Variables

| Variable        | Required | Default         | Description                              |
|----------------|----------|-----------------|------------------------------------------|
| `NODE_ENV`     | No       | `development`   | `development`, `production`, or `test`   |
| `LOG_LEVEL`    | No       | `info`          | `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `JWT_SECRET`   | **Yes**  | --              | JWT signing key (min 32 chars). Must match across services |

### Backend API Environment Variables

| Variable                    | Required | Default                       | Description                           |
|----------------------------|----------|-------------------------------|---------------------------------------|
| `PORT`                     | No       | `3000`                        | HTTP server port                      |
| `HOST`                     | No       | `0.0.0.0`                     | HTTP server bind address              |
| `DATABASE_URL`             | **Yes**  | --                            | PostgreSQL connection URL             |
| `JWT_ISSUER`               | No       | `aion-vision-hub`             | JWT issuer claim                      |
| `JWT_EXPIRATION`           | No       | `24h`                         | JWT token expiration                  |
| `CORS_ORIGINS`             | No       | `http://localhost:5173`       | Comma-separated allowed origins       |
| `RATE_LIMIT_MAX`           | No       | `100`                         | Max requests per time window          |
| `RATE_LIMIT_WINDOW_MS`     | No       | `60000`                       | Rate limit window in milliseconds     |
| `OPENAI_API_KEY`           | No       | --                            | OpenAI API key for AI bridge          |
| `ANTHROPIC_API_KEY`        | No       | --                            | Anthropic API key for AI bridge       |
| `CREDENTIAL_ENCRYPTION_KEY`| No       | Falls back to `JWT_SECRET`    | AES-256-GCM key for credentials       |

### Edge Gateway Environment Variables

| Variable                          | Required | Default                   | Description                           |
|----------------------------------|----------|---------------------------|---------------------------------------|
| `PORT`                           | No       | `3100`                    | HTTP server port                      |
| `HOST`                           | No       | `0.0.0.0`                 | HTTP server bind address              |
| `GATEWAY_ID`                     | No       | `gw-default`              | Unique gateway identifier             |
| `SITE_ID`                        | No       | --                        | Associated site identifier            |
| `BACKEND_API_URL`                | No       | `http://localhost:3000`   | Cloud Backend API URL                 |
| `BACKEND_API_KEY`                | No       | --                        | API key for backend communication     |
| `CORS_ORIGINS`                   | No       | `http://localhost:5173`   | Comma-separated allowed origins       |
| `MEDIAMTX_API_URL`              | No       | `http://localhost:9997`   | MediaMTX management API URL           |
| `MEDIAMTX_RTSP_PORT`            | No       | `8554`                    | MediaMTX RTSP listening port          |
| `DEVICE_CONNECT_TIMEOUT_MS`     | No       | `5000`                    | Device connection timeout             |
| `DEVICE_PING_INTERVAL_MS`       | No       | `30000`                   | Health check interval per device      |
| `DEVICE_RECONNECT_MAX_ATTEMPTS` | No       | `5`                       | Max reconnection attempts             |
| `DEVICE_RECONNECT_BASE_DELAY_MS`| No       | `2000`                    | Initial reconnect delay               |
| `DISCOVERY_TIMEOUT_MS`          | No       | `10000`                   | Network discovery timeout             |
| `DISCOVERY_NETWORK_RANGE`       | No       | `192.168.1.0/24`          | Network CIDR for camera discovery     |
| `CACHE_MAX_ENTRIES`             | No       | `500`                     | Maximum LRU cache entries             |
| `CACHE_TTL_MS`                  | No       | `300000`                  | Cache entry TTL (5 minutes)           |
| `HEARTBEAT_INTERVAL_MS`         | No       | `60000`                   | Heartbeat reporting interval          |
| `CREDENTIAL_ENCRYPTION_KEY`     | No       | Falls back to `JWT_SECRET`| AES-256-GCM key for credentials       |

### Docker Compose Variables

| Variable              | Required | Default                | Description                        |
|----------------------|----------|------------------------|------------------------------------|
| `POSTGRES_PASSWORD`  | No       | `aion_dev_password`    | PostgreSQL password                |
| `JWT_SECRET`         | **Yes**  | --                     | Shared JWT secret (enforced)       |
| `CORS_ORIGINS`       | No       | `http://localhost:5173`| Frontend origin                    |
| `LOG_LEVEL`          | No       | `info`                 | Log verbosity for all services     |
| `OPENAI_API_KEY`     | No       | --                     | OpenAI API key                     |
| `ANTHROPIC_API_KEY`  | No       | --                     | Anthropic API key                  |
| `GATEWAY_ID`         | No       | `gw-local-01`          | Gateway identifier                 |
| `SITE_ID`            | No       | --                     | Site identifier                    |
| `DISCOVERY_NETWORK_RANGE` | No  | `192.168.1.0/24`       | Camera discovery network           |

---

## Database Setup

### Using Docker (recommended for development)

PostgreSQL is included in `docker-compose.yml`:

```bash
# Start only PostgreSQL
docker compose up postgres -d

# Default credentials:
#   Database: aion_vision_hub
#   User:     aion
#   Password: aion_dev_password (or POSTGRES_PASSWORD env var)
#   Port:     5432
```

### Manual PostgreSQL Setup

```sql
-- Create database and user
CREATE USER aion WITH PASSWORD 'your_password';
CREATE DATABASE aion_vision_hub OWNER aion;
GRANT ALL PRIVILEGES ON DATABASE aion_vision_hub TO aion;
```

### Drizzle Migrations

Database schema is managed by Drizzle ORM with migration files:

```bash
# Generate migration files from schema changes
pnpm db:generate

# Apply pending migrations
pnpm db:migrate
```

### Schema Location

Schema definitions are in `apps/backend-api/src/db/schema/`:

| File              | Tables                        |
|------------------|-------------------------------|
| `tenants.ts`     | `tenants`, `tenant_settings`  |
| `users.ts`       | `users`                       |
| `devices.ts`     | `devices`                     |
| `events.ts`      | `events`, `audit_logs`        |
| `incidents.ts`   | `incidents`, `evidence`, `comments` |

### Database Connection

```typescript
// apps/backend-api/src/db/client.ts
// Uses postgres.js driver with Drizzle ORM
// Connection URL from DATABASE_URL environment variable
```

---

## Health Check Endpoints

Both services expose health check endpoints for container orchestration.

### Backend API Health Checks

| Endpoint           | Purpose          | Auth Required | Response                        |
|-------------------|------------------|---------------|---------------------------------|
| `GET /health`     | Liveness probe   | No            | `{ status: "healthy", uptime }` |
| `GET /health/ready`| Readiness probe | No            | `{ status: "ready" }`           |
| `GET /health/metrics` | Runtime stats | No           | Memory, CPU, uptime             |

### Edge Gateway Health Checks

| Endpoint              | Purpose            | Auth Required | Response                           |
|----------------------|--------------------|---------------|------------------------------------|
| `GET /health`        | Liveness + status  | No            | Status, uptime, device/stream count|
| `GET /health/ready`  | Readiness probe    | No            | `{ status: "ready" }`             |
| `GET /health/devices`| Device health      | No            | Per-device health status           |

### Docker Health Checks

Health checks are configured in `docker-compose.yml`:

```yaml
# Backend API
healthcheck:
  test: ["CMD", "node", "-e", "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]
  interval: 30s
  timeout: 5s
  retries: 3

# Edge Gateway
healthcheck:
  test: ["CMD", "node", "-e", "fetch('http://localhost:3100/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"]
  interval: 30s
  timeout: 5s
  retries: 3

# PostgreSQL
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U aion -d aion_vision_hub"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### Kubernetes Probes (example)

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## Scaling Considerations

### Backend API Scaling

The Backend API is **stateless** and can be horizontally scaled:

```
                    +-- Backend API (replica 1) --+
Load Balancer ----->|-- Backend API (replica 2) --+--> PostgreSQL
                    +-- Backend API (replica 3) --+
```

**Requirements for horizontal scaling:**

- All replicas must share the same `JWT_SECRET`
- All replicas connect to the same PostgreSQL instance
- Rate limiting needs a shared store (Redis) for cross-replica consistency
- WebSocket connections require sticky sessions or a dedicated WebSocket gateway

### Edge Gateway Scaling

The Edge Gateway is designed as **one instance per site**. It is **not** horizontally scaled at a single site because:

- It maintains in-memory device connections
- It tracks stream state locally
- It manages the credential vault in memory

**Multi-site scaling** is achieved by deploying one gateway per physical location, each with a unique `GATEWAY_ID`.

### Database Scaling

| Approach              | When to Use                                      |
|----------------------|-------------------------------------------------|
| Connection pooling   | Immediately (PgBouncer or built-in)             |
| Read replicas        | When read traffic exceeds single instance capacity|
| Partitioning         | When `events` or `audit_logs` tables grow large  |
| Sharding by tenant   | Extreme multi-tenant scale (thousands of tenants)|

### MediaMTX Scaling

- Each site has its own MediaMTX instance
- MediaMTX handles RTSP-to-WebRTC/HLS bridging per-site
- No cross-site media routing (each gateway manages its own streams)

### Recommended Production Architecture

```
  CLOUD
  +---------------------------------------------------+
  |  Load Balancer (nginx/ALB)                         |
  |       |                                            |
  |  +----+----+----+                                  |
  |  | API x3  |    +--> PostgreSQL (primary)          |
  |  +---------+    |    +-> Read replica              |
  |                 |                                  |
  |  Redis (rate limiting, session state)              |
  +---------------------------------------------------+

  SITE A                        SITE B
  +---------------------+      +---------------------+
  |  Gateway + MediaMTX  |      |  Gateway + MediaMTX  |
  |  Cameras (N)         |      |  Cameras (N)         |
  +---------------------+      +---------------------+
```

### Performance Considerations

| Component      | Bottleneck              | Mitigation                          |
|---------------|------------------------|--------------------------------------|
| Backend API   | Database connections   | Connection pooling, read replicas    |
| Backend API   | Rate limit store       | Redis-backed rate limiter            |
| Edge Gateway  | Concurrent streams     | Stream policy limits (4 main, 32 sub)|
| Edge Gateway  | Device health checks   | Configurable interval, async checks  |
| MediaMTX      | RTSP bandwidth         | Sub-stream preference for mosaics    |
| PostgreSQL    | Event/audit log volume | Table partitioning by date           |
