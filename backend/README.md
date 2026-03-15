# AION Vision Hub -- Backend Monorepo

Production-grade backend for the AION Vision Hub video management platform. This monorepo contains the **Cloud Backend API** and the **On-Premise Edge Gateway**, built with TypeScript, Fastify 5, Drizzle ORM, and PostgreSQL.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quickstart](#quickstart)
- [Monorepo Structure](#monorepo-structure)
- [Available Scripts](#available-scripts)
- [Documentation](#documentation)
- [Tech Stack](#tech-stack)

---

## Architecture Overview

```
                          CLOUD                                 ON-PREMISE
                +-----------------------+              +-----------------------+
  Frontend ---> |   Backend API (:3000) |              | Edge Gateway (:3100)  |
  (React)       |   - REST/WebSocket    | <----------> |   - Device adapters   |
                |   - Auth & RBAC       |   Heartbeat  |   - Stream manager    |
                |   - Drizzle ORM       |   & Events   |   - Discovery         |
                +-----------+-----------+              +-----------+-----------+
                            |                                      |
                   +--------+--------+                    +--------+--------+
                   |   PostgreSQL    |                    |   MediaMTX      |
                   |   (:5432)       |                    |   RTSP/WebRTC   |
                   +-----------------+                    |   (:8554/8889)  |
                                                          +--------+--------+
                                                                   |
                                                          +--------+--------+
                                                          | IP Cameras      |
                                                          | (Hikvision,     |
                                                          |  Dahua, ONVIF)  |
                                                          +-----------------+
```

---

## Prerequisites

| Requirement  | Version  | Notes                            |
|-------------|----------|----------------------------------|
| Node.js     | >= 20.0  | LTS recommended                  |
| pnpm        | >= 9.15  | Workspace package manager        |
| Docker      | >= 24.0  | For database and MediaMTX        |
| PostgreSQL  | >= 16    | Only if running without Docker   |

---

## Quickstart

### Local Development (without Docker)

```bash
cd backend

# 1. Copy and configure environment
cp .env.example .env
# Edit .env -- set JWT_SECRET to a string of at least 32 characters

# 2. Install dependencies
pnpm install

# 3. Build all packages and apps
pnpm build

# 4. Start PostgreSQL (via Docker or local install)
docker compose up postgres -d

# 5. Run database migrations
pnpm db:migrate

# 6. Start both API and Gateway in development mode
pnpm dev
```

### Full Stack with Docker Compose

```bash
cd backend
cp .env.example .env
# Edit .env with your JWT_SECRET (required)

docker compose up
# Starts: PostgreSQL, Backend API, Edge Gateway, MediaMTX
```

### Service URLs (default)

| Service          | URL                          |
|-----------------|------------------------------|
| Backend API     | http://localhost:3000         |
| Edge Gateway    | http://localhost:3100         |
| PostgreSQL      | localhost:5432                |
| MediaMTX RTSP   | rtsp://localhost:8554         |
| MediaMTX WebRTC | http://localhost:8889         |
| MediaMTX HLS    | http://localhost:8888         |
| MediaMTX API    | http://localhost:9997         |

---

## Monorepo Structure

```
backend/
|-- apps/
|   |-- backend-api/          # Cloud Backend API (Fastify 5, Drizzle, PostgreSQL)
|   |   |-- src/
|   |   |   |-- config/       # Environment configuration (Zod-validated)
|   |   |   |-- db/           # Drizzle ORM schema and client
|   |   |   |-- plugins/      # Fastify plugins (auth, tenant, audit)
|   |   |   |-- middleware/   # Error handler, rate limiter, request ID
|   |   |   |-- modules/      # Feature modules (15 modules)
|   |   |   |   |-- health/   # Health check endpoints
|   |   |   |   |-- auth/     # JWT authentication
|   |   |   |   |-- tenants/  # Multi-tenant management
|   |   |   |   |-- users/    # User management
|   |   |   |   |-- roles/    # Role-based access control
|   |   |   |   |-- devices/  # Device CRUD and lifecycle
|   |   |   |   |-- sites/    # Site/location management
|   |   |   |   |-- streams/  # Stream registration and URLs
|   |   |   |   |-- events/   # Security event management
|   |   |   |   |-- incidents/# Incident tracking and response
|   |   |   |   |-- integrations/ # Webhook, SMS, Slack integrations
|   |   |   |   |-- ai-bridge/    # OpenAI/Anthropic AI proxy
|   |   |   |   |-- mcp-bridge/   # Model Context Protocol connectors
|   |   |   |   |-- reports/      # Report generation
|   |   |   |   |-- audit/        # Audit log queries
|   |   |   |-- app.ts        # Application bootstrap
|   |   |   |-- index.ts      # Server entrypoint
|   |   |-- Dockerfile
|   |   |-- package.json
|   |
|   |-- edge-gateway/         # On-Premise Edge Gateway (Fastify 5)
|       |-- src/
|       |   |-- config/       # Gateway environment configuration
|       |   |-- services/     # Core services (7 services)
|       |   |   |-- device-manager.ts
|       |   |   |-- stream-manager.ts
|       |   |   |-- discovery.ts
|       |   |   |-- event-ingestion.ts
|       |   |   |-- playback-manager.ts
|       |   |   |-- health-monitor.ts
|       |   |   |-- credential-vault.ts
|       |   |-- policies/     # Retry, timeout, reconnect, stream selection
|       |   |-- cache/        # LRU cache with TTL
|       |   |-- api/          # REST API routes (7 route groups)
|       |   |-- app.ts        # Gateway bootstrap
|       |   |-- index.ts      # Server entrypoint
|       |-- Dockerfile
|       |-- package.json
|
|-- packages/
|   |-- shared-contracts/     # TypeScript interfaces and types
|   |   |-- src/
|   |       |-- domain.ts     # Business domain types (Tenant, User, Device, etc.)
|   |       |-- adapters.ts   # Adapter interfaces (8 interfaces)
|   |       |-- streaming.ts  # Stream policy, state machine, MediaMTX types
|   |       |-- api.ts        # Request/response contracts
|   |       |-- events.ts     # Gateway events, WebSocket messages
|   |       |-- errors.ts     # Typed error codes and AppError classes
|   |
|   |-- device-adapters/      # Camera brand adapters
|   |   |-- src/
|   |       |-- base-adapter.ts          # Abstract base with shared logic
|   |       |-- hikvision/adapter.ts     # ISAPI protocol adapter
|   |       |-- dahua/adapter.ts         # CGI/RPC protocol adapter
|   |       |-- onvif/adapter.ts         # Generic ONVIF adapter
|   |       |-- factory.ts              # AdapterFactory with brand routing
|   |
|   |-- common-utils/         # Shared utilities
|       |-- src/
|           |-- logger.ts     # Pino logger factory
|           |-- retry.ts      # Exponential backoff with jitter
|           |-- crypto.ts     # AES-256-GCM encrypt/decrypt
|           |-- validation.ts # Zod schema helpers
|           |-- result.ts     # Result type utilities
|           |-- date.ts       # Date formatting helpers
|
|-- docker-compose.yml        # Full stack: Postgres, API, Gateway, MediaMTX
|-- pnpm-workspace.yaml       # pnpm workspace definition
|-- turbo.json                # Turborepo pipeline configuration
|-- tsconfig.base.json        # Shared TypeScript config
|-- .env.example              # Environment template
|-- package.json              # Root scripts and metadata
```

---

## Available Scripts

All scripts run from the `backend/` root directory:

| Script              | Description                                      |
|--------------------|--------------------------------------------------|
| `pnpm dev`         | Start all apps in development mode (watch)       |
| `pnpm dev:api`     | Start only the Backend API                       |
| `pnpm dev:gateway` | Start only the Edge Gateway                      |
| `pnpm build`       | Build all packages and apps                      |
| `pnpm test`        | Run all tests (Vitest)                           |
| `pnpm test:watch`  | Run tests in watch mode                          |
| `pnpm lint`        | Lint all packages                                |
| `pnpm typecheck`   | TypeScript type checking                         |
| `pnpm clean`       | Remove all dist/ and node_modules/               |
| `pnpm db:generate` | Generate Drizzle migration files                 |
| `pnpm db:migrate`  | Run database migrations                          |
| `pnpm docker:build`| Build Docker images                              |
| `pnpm docker:up`   | Start all Docker services                        |
| `pnpm docker:down` | Stop all Docker services                         |

---

## Documentation

| Document                              | Description                                    |
|---------------------------------------|------------------------------------------------|
| [Architecture](docs/Architecture.md)  | System architecture, data flow, module map     |
| [Gateway](docs/Gateway.md)            | Edge gateway services, policies, API catalog   |
| [Adapters](docs/Adapters.md)          | Device adapter strategy pattern and brands     |
| [Streaming](docs/Streaming.md)        | RTSP ingestion, MediaMTX, stream state machine |
| [API Reference](docs/API.md)          | Backend API endpoints and contracts            |
| [Security](docs/Security.md)          | Auth, RBAC, encryption, audit logging          |
| [Deployment](docs/Deployment.md)      | Docker, environment variables, scaling         |
| [Roadmap](docs/Roadmap.md)            | Development phases and future plans            |

---

## Tech Stack

| Layer              | Technology                                          |
|-------------------|-----------------------------------------------------|
| Runtime           | Node.js 20+ (ES2022)                                |
| Language          | TypeScript 5.7 (strict mode)                        |
| HTTP Framework    | Fastify 5                                            |
| ORM               | Drizzle ORM 0.38                                     |
| Database          | PostgreSQL 16                                        |
| Validation        | Zod 3.23                                             |
| Authentication    | @fastify/jwt (JWT Bearer tokens)                     |
| Logging           | Pino 9                                               |
| Testing           | Vitest 3                                             |
| Build System      | Turborepo + pnpm 9.15 workspaces                    |
| Streaming         | MediaMTX (RTSP to WebRTC/HLS bridge)                |
| Containerization  | Docker Compose 3.9                                   |
| Encryption        | Node.js crypto (AES-256-GCM)                         |
| Camera Protocols  | ISAPI, Dahua CGI/RPC, ONVIF (WS-Discovery)          |

---

## Package Dependencies

```
@aion/backend-api
  |-- @aion/shared-contracts
  |-- @aion/common-utils

@aion/edge-gateway
  |-- @aion/shared-contracts
  |-- @aion/common-utils
  |-- @aion/device-adapters

@aion/device-adapters
  |-- @aion/shared-contracts
  |-- @aion/common-utils

@aion/common-utils
  (no internal dependencies)

@aion/shared-contracts
  (no internal dependencies)
```

---

## License

Proprietary. All rights reserved.
