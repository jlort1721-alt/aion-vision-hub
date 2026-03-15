# Architecture

This document describes the high-level architecture of the AION Vision Hub backend, including the split between the Cloud Backend API and the On-Premise Edge Gateway, the package dependency graph, module breakdown, and core data flows.

---

## Table of Contents

- [System Overview](#system-overview)
- [High-Level Architecture](#high-level-architecture)
- [Deployment Topology](#deployment-topology)
- [Package Dependency Graph](#package-dependency-graph)
- [Backend API Module Map](#backend-api-module-map)
- [Edge Gateway Service Map](#edge-gateway-service-map)
- [Data Flows](#data-flows)
- [Technology Decisions](#technology-decisions)

---

## System Overview

The AION Vision Hub backend is split into two independently deployable services:

1. **Backend API** (`@aion/backend-api`) -- The central cloud service that manages tenants, users, devices, events, incidents, reports, and integrations. It exposes a REST API consumed by the frontend and acts as the source of truth for all business data.

2. **Edge Gateway** (`@aion/edge-gateway`) -- An on-premise service deployed at each physical site. It communicates directly with IP cameras using brand-specific adapters (Hikvision ISAPI, Dahua CGI, ONVIF), manages RTSP streams through MediaMTX, handles device discovery, and forwards events to the cloud API.

Three shared packages underpin both services:

- **`@aion/shared-contracts`** -- TypeScript interfaces and types shared across the entire monorepo.
- **`@aion/device-adapters`** -- Camera brand adapter implementations (Hikvision, Dahua, ONVIF).
- **`@aion/common-utils`** -- Cross-cutting utilities (logging, retry, crypto, validation).

---

## High-Level Architecture

```
  +-------------------+         +-------------------+         +-------------------+
  |                   |  REST   |                   |  HTTP   |                   |
  |   Frontend App    +-------->|   Backend API     +-------->|   PostgreSQL 16   |
  |   (React + Vite)  |         |   (Fastify 5)     |         |                   |
  |                   |<--------+   Port 3000       |<--------+   Port 5432       |
  +-------------------+  JSON   +---------+---------+         +-------------------+
                                          |
                                          | Heartbeat,
                                          | Events,
                                          | Health Reports
                                          |
                                +---------+---------+
                                |                   |
                                | Edge Gateway      |
                                | (Fastify 5)       |
                                | Port 3100         |
                                +---+---+---+-------+
                                    |   |   |
                         +----------+   |   +----------+
                         |              |              |
                  +------+------+ +-----+-----+ +-----+------+
                  |  MediaMTX   | |  Camera   | |  Camera    |
                  |  RTSP Proxy | |  Adapter  | |  Adapter   |
                  |  8554/8889  | | (Hikvision| | (Dahua/    |
                  |  /8888      | |  ISAPI)   | |  ONVIF)    |
                  +-------------+ +-----------+ +------------+
                                       |              |
                                  +----+----+    +----+----+
                                  | IP Cam  |    | IP Cam  |
                                  +---------+    +---------+
```

---

## Deployment Topology

```
  CLOUD INFRASTRUCTURE                    SITE A (On-Premise)
  +----------------------------+          +----------------------------+
  |                            |          |                            |
  |  +----------+  +--------+ |  WAN     |  +----------+  +--------+ |
  |  | Backend  |  | Postgres| |<-------->|  | Edge     |  | Media  | |
  |  | API      |  |        | |          |  | Gateway  |  | MTX    | |
  |  +----------+  +--------+ |          |  +----+-----+  +--------+ |
  |                            |          |       |                    |
  +----------------------------+          |  +----+--+--+--+--+       |
                                          |  |Cam1|Cam2|Cam3|NVR|     |
                                          |  +----+----+----+---+     |
                                          +----------------------------+

                                          SITE B (On-Premise)
                                          +----------------------------+
                                          |  +----------+  +--------+  |
                                          |  | Edge     |  | Media  |  |
                                          |  | Gateway  |  | MTX    |  |
                                          |  +----+-----+  +--------+  |
                                          |       |                     |
                                          |  +----+--+--+              |
                                          |  |Cam4|Cam5|               |
                                          |  +----+----+               |
                                          +----------------------------+
```

Each site runs its own Edge Gateway instance. The gateway communicates with the central Backend API for configuration synchronization, event forwarding, and health reporting.

---

## Package Dependency Graph

```
@aion/shared-contracts          (leaf -- no internal deps)
        ^        ^
        |        |
@aion/common-utils              (leaf -- no internal deps)
        ^    ^   ^
        |    |   |
        |    |   +------- @aion/device-adapters
        |    |                 ^
        |    |                 |
        |    +-----------+     |
        |                |     |
  @aion/backend-api    @aion/edge-gateway
```

| Package                  | Internal Dependencies                          |
|-------------------------|-------------------------------------------------|
| `@aion/shared-contracts`| None                                            |
| `@aion/common-utils`    | None                                            |
| `@aion/device-adapters` | `@aion/shared-contracts`, `@aion/common-utils`  |
| `@aion/backend-api`     | `@aion/shared-contracts`, `@aion/common-utils`  |
| `@aion/edge-gateway`    | `@aion/shared-contracts`, `@aion/common-utils`, `@aion/device-adapters` |

---

## Backend API Module Map

The Backend API is organized into 15 feature modules, each following the pattern: `routes.ts`, `service.ts`, `schemas.ts`.

| #  | Module         | Prefix           | Description                                          |
|----|---------------|------------------|------------------------------------------------------|
| 1  | health        | `/health`        | Liveness, readiness, and metrics endpoints           |
| 2  | auth          | `/auth`          | JWT token verification and refresh                   |
| 3  | tenants       | `/tenants`       | Multi-tenant CRUD and settings management            |
| 4  | users         | `/users`         | User management within tenant scope                  |
| 5  | roles         | `/roles`         | Role definitions and permission queries              |
| 6  | devices       | `/devices`       | Device registration, updates, test, health           |
| 7  | sites         | `/sites`         | Physical site/location management                    |
| 8  | streams       | `/streams`       | Stream registration and signed URL generation        |
| 9  | events        | `/events`        | Security event ingestion and lifecycle               |
| 10 | incidents     | `/incidents`     | Incident tracking, evidence, comments                |
| 11 | integrations  | `/integrations`  | Webhook, SMS, Slack, email notification setup        |
| 12 | ai-bridge     | `/ai`            | AI chat proxy (OpenAI, Anthropic)                    |
| 13 | mcp-bridge    | `/mcp`           | Model Context Protocol connector management          |
| 14 | reports       | `/reports`       | Report generation (events, incidents, audit)         |
| 15 | audit         | `/audit`         | Audit log query and export                           |

### Cross-Cutting Concerns

| Layer       | Component              | Purpose                                      |
|------------|------------------------|----------------------------------------------|
| Plugin     | `auth.ts`              | JWT verification, role extraction             |
| Plugin     | `tenant.ts`            | Tenant existence and active status check      |
| Plugin     | `audit.ts`             | Automatic audit logging on mutations          |
| Middleware | `error-handler.ts`     | Unified error response format                 |
| Middleware | `rate-limiter.ts`      | Per-tenant+IP rate limiting                   |
| Middleware | `request-id.ts`        | UUID request correlation                      |

---

## Edge Gateway Service Map

The Edge Gateway contains 7 core services, 4 policy engines, and 1 cache layer:

### Services

| #  | Service              | File                       | Responsibility                              |
|----|---------------------|----------------------------|----------------------------------------------|
| 1  | DeviceManager       | `device-manager.ts`        | Device connection lifecycle, adapter routing |
| 2  | StreamManager       | `stream-manager.ts`        | Stream registration, MediaMTX integration    |
| 3  | DiscoveryService    | `discovery.ts`             | Network scanning and device identification   |
| 4  | EventIngestionService | `event-ingestion.ts`     | Camera event subscription and forwarding     |
| 5  | PlaybackManager     | `playback-manager.ts`      | Recorded video search, playback, export      |
| 6  | HealthMonitor       | `health-monitor.ts`        | Periodic device health checks, auto-reconnect|
| 7  | CredentialVault     | `credential-vault.ts`      | AES-256-GCM encrypted credential storage     |

### Policy Engines

| Policy         | File                 | Behavior                                         |
|---------------|----------------------|--------------------------------------------------|
| RetryPolicy   | `policies/retry.ts`  | Exponential backoff with jitter, configurable limits|
| TimeoutPolicy | `policies/timeout.ts`| Per-operation timeout enforcement                |
| StreamPolicy  | `policies/stream-policy.ts` | Context-based stream selection, concurrency limits|
| ReconnectPolicy | `policies/reconnect.ts` | Per-device reconnect tracking, exponential backoff|

### Cache

| Component  | File                     | Strategy                                    |
|-----------|--------------------------|----------------------------------------------|
| LocalCache| `cache/local-cache.ts`   | LRU eviction, TTL expiry, configurable size  |

---

## Data Flows

### 1. Authentication Flow

```
Frontend                Backend API              Database
   |                        |                        |
   |-- POST /auth/verify -->|                        |
   |   (JWT token)          |-- Verify JWT sig ----->|
   |                        |   Extract claims       |
   |                        |-- Check tenant ------->|
   |                        |   active?              |
   |<-- { valid, userId,    |                        |
   |      tenantId, role }--|                        |
```

### 2. Device Management Flow

```
Frontend              Backend API              Edge Gateway           Camera
   |                      |                        |                     |
   |-- POST /devices ---->|                        |                     |
   |   (create device)    |-- Store in DB -------->|                     |
   |                      |                        |                     |
   |-- POST /devices/:id  |                        |                     |
   |   /test ------------>|-- POST /devices/test ->|                     |
   |                      |                        |-- ISAPI/CGI/ONVIF ->|
   |                      |                        |<-- Device info -----|
   |<-- { success, caps } |<-- { success, caps } --|                     |
```

### 3. Streaming Flow

```
Frontend              Edge Gateway             MediaMTX              Camera
   |                      |                       |                     |
   |-- GET /streams/:id   |                       |                     |
   |   /url?proto=webrtc->|                       |                     |
   |                      |-- Register path ----->|                     |
   |                      |   source=rtsp://cam   |-- Pull RTSP ------>|
   |                      |                       |<-- Video stream ----|
   |<-- { url, token } ---|                       |                     |
   |                      |                       |                     |
   |-- WebRTC SDP ------->|-------- proxy ------->|                     |
   |<-- Video frames -----|<----------------------|                     |
```

### 4. Event Ingestion Flow

```
Camera                Edge Gateway              Backend API           Database
   |                      |                        |                     |
   |-- Alert stream ----->|                        |                     |
   |   (ISAPI/CGI)        |-- Parse event          |                     |
   |                      |-- Forward ------------>|                     |
   |                      |   POST /events         |-- Insert event ---->|
   |                      |                        |-- Notify via WS --->|
   |                      |                        |   (to frontend)     |
```

### 5. Heartbeat and Health

```
Edge Gateway              Backend API
   |                          |
   |-- Every 60s ----------->|
   |   POST /gateways/:id    |
   |   /heartbeat             |
   |   { connectedDevices,    |
   |     activeStreams,        |
   |     status }              |
   |                          |
   |   Health Monitor runs    |
   |   every 30s per device   |
   |   (ping + getHealth)     |
```

---

## Technology Decisions

| Decision                    | Rationale                                                |
|----------------------------|----------------------------------------------------------|
| Fastify 5 over Express    | Superior performance, built-in validation, plugin system |
| Drizzle ORM over Prisma   | Type-safe, SQL-first, lighter weight, faster migrations  |
| pnpm + Turborepo          | Fast installs, strict dependency hoisting, parallel builds|
| Zod for validation        | Runtime + compile-time type safety, schema composition   |
| Pino for logging          | Structured JSON logging, extremely fast, low overhead    |
| AES-256-GCM for creds     | Authenticated encryption, no credential leakage          |
| MediaMTX for streaming    | Zero-config RTSP to WebRTC/HLS bridge, API-driven       |
| Strategy pattern for adapters | Clean vendor abstraction, easy to add new brands     |
| Monorepo with workspaces  | Shared types, atomic refactors, single CI pipeline       |
