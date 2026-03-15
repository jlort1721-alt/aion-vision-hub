# AION Vision Hub — Production Architecture Blueprint

## Overview

This document defines the complete production architecture for AION Vision Hub, designed to be implemented in a monorepo outside Lovable (Cursor/GitHub).

## Repository Structure

```
aion-vision-hub/
├── apps/
│   ├── backend-api/          # Express/Fastify TypeScript API
│   │   ├── src/
│   │   │   ├── controllers/  # Route handlers
│   │   │   ├── services/     # Business logic
│   │   │   ├── repositories/ # Data access
│   │   │   ├── middleware/    # Auth, RBAC, tenant, rate-limit
│   │   │   ├── validators/   # Zod schemas
│   │   │   ├── routes/       # Express/Fastify route definitions
│   │   │   └── config/       # Environment, logging
│   │   ├── Dockerfile
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── edge-gateway/         # On-premise gateway (TypeScript or Go)
│   │   ├── src/
│   │   │   ├── adapters/     # Device adapters
│   │   │   ├── discovery/    # ONVIF WS-Discovery
│   │   │   ├── streams/      # RTSP/stream management
│   │   │   ├── events/       # Device event listener
│   │   │   ├── playback/     # Playback proxy
│   │   │   ├── ptz/          # PTZ command relay
│   │   │   ├── health/       # Health reporting
│   │   │   ├── queue/        # Offline event queue
│   │   │   └── config/       # Environment config
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── frontend/             # Existing Lovable PWA (exported)
│       └── ...
│
├── packages/
│   ├── shared-contracts/     # API request/response DTOs
│   │   ├── src/
│   │   │   ├── api/          # REST endpoint contracts
│   │   │   ├── gateway/      # Gateway protocol contracts
│   │   │   ├── events/       # Event schemas
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── shared-types/         # Core domain types
│   │   ├── src/
│   │   │   ├── entities.ts
│   │   │   ├── enums.ts
│   │   │   ├── adapters.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── shared-utils/         # Common utilities
│   │   ├── src/
│   │   │   ├── logger.ts
│   │   │   ├── retry.ts
│   │   │   ├── timeout.ts
│   │   │   ├── crypto.ts
│   │   │   └── validators.ts
│   │   └── package.json
│   │
│   ├── device-adapters/      # Adapter implementations
│   │   ├── src/
│   │   │   ├── interfaces/
│   │   │   │   ├── IDeviceAdapter.ts
│   │   │   │   ├── IDiscoveryAdapter.ts
│   │   │   │   ├── IStreamAdapter.ts
│   │   │   │   ├── IPlaybackAdapter.ts
│   │   │   │   ├── IEventAdapter.ts
│   │   │   │   ├── IPTZAdapter.ts
│   │   │   │   ├── IConfigAdapter.ts
│   │   │   │   └── IHealthAdapter.ts
│   │   │   ├── hikvision/
│   │   │   │   ├── HikvisionAdapter.ts
│   │   │   │   ├── ISAPIClient.ts
│   │   │   │   └── HikvisionStreamMapper.ts
│   │   │   ├── dahua/
│   │   │   │   ├── DahuaAdapter.ts
│   │   │   │   ├── DahuaHTTPClient.ts
│   │   │   │   └── DahuaStreamMapper.ts
│   │   │   ├── onvif/
│   │   │   │   ├── GenericOnvifAdapter.ts
│   │   │   │   ├── OnvifClient.ts
│   │   │   │   └── OnvifProfileMapper.ts
│   │   │   ├── factory.ts    # AdapterFactory
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ai-orchestration/
│   │   ├── src/
│   │   │   ├── interfaces/
│   │   │   │   ├── IAIProvider.ts
│   │   │   │   ├── IPromptRegistry.ts
│   │   │   │   └── IAIGovernance.ts
│   │   │   ├── providers/
│   │   │   │   ├── OpenAIProvider.ts
│   │   │   │   ├── ClaudeProvider.ts
│   │   │   │   └── LovableProvider.ts
│   │   │   ├── prompts/
│   │   │   │   ├── event-summary.ts
│   │   │   │   ├── incident-report.ts
│   │   │   │   ├── playback-assist.ts
│   │   │   │   ├── reboot-guide.ts
│   │   │   │   ├── intercom-assist.ts
│   │   │   │   └── sop-generator.ts
│   │   │   ├── AIOrchestrator.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── mcp-orchestration/
│   │   ├── src/
│   │   │   ├── interfaces/
│   │   │   │   ├── IMCPConnector.ts
│   │   │   │   ├── IMCPToolRegistry.ts
│   │   │   │   └── IMCPExecutor.ts
│   │   │   ├── connectors/
│   │   │   │   ├── ONVIFConnector.ts
│   │   │   │   ├── NotificationConnector.ts
│   │   │   │   ├── StorageConnector.ts
│   │   │   │   ├── TicketingConnector.ts
│   │   │   │   ├── WebhookConnector.ts
│   │   │   │   └── PlaceholderConnectors.ts
│   │   │   ├── MCPRegistry.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── domotics-connectors/
│   │   ├── src/
│   │   │   ├── interfaces/
│   │   │   │   ├── IDomoticConnector.ts
│   │   │   │   ├── IDomoticDeviceService.ts
│   │   │   │   └── IDomoticActionService.ts
│   │   │   ├── connectors/
│   │   │   │   ├── eWeLinkConnector.ts
│   │   │   │   ├── SonoffConnector.ts
│   │   │   │   └── GenericRelayConnector.ts
│   │   │   ├── DomoticOrchestrator.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── access-control-connectors/
│   │   ├── src/
│   │   │   ├── interfaces/
│   │   │   │   ├── IAccessControlConnector.ts
│   │   │   │   ├── ICredentialService.ts
│   │   │   │   ├── IAccessEventService.ts
│   │   │   │   ├── IPersonRegistryService.ts
│   │   │   │   └── IVehicleRegistryService.ts
│   │   │   ├── connectors/
│   │   │   │   ├── ZKTecoConnector.ts
│   │   │   │   ├── HikvisionAccessConnector.ts
│   │   │   │   └── GenericAccessConnector.ts
│   │   │   ├── AccessOrchestrator.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── intercom-connectors/
│       ├── src/
│       │   ├── interfaces/
│       │   │   ├── IIntercomConnector.ts
│       │   │   ├── ICallSessionService.ts
│       │   │   ├── IVoiceAgentService.ts
│       │   │   └── IWelcomeMessageService.ts
│       │   ├── connectors/
│       │   │   ├── FanvilConnector.ts
│       │   │   ├── SIPBridge.ts
│       │   │   └── ElevenLabsBridge.ts
│       │   ├── IntercomOrchestrator.ts
│       │   └── index.ts
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   └── .env.example
│
├── docs/                     # Documentation
│   └── ...
│
├── tests/                    # Integration tests
│   ├── adapters/
│   ├── services/
│   └── e2e/
│
├── turbo.json               # Turborepo config
├── package.json             # Root workspace
└── tsconfig.base.json
```

## Technology Stack

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Backend API | Fastify + TypeScript | High performance, schema validation, plugin ecosystem |
| Edge Gateway | TypeScript (Node.js) | Shared types with backend, easier maintenance |
| Database | PostgreSQL (Supabase) | Already in use, RLS, realtime |
| Cache | Redis | Session caching, stream state, pub/sub |
| Message Broker | MQTT | Lightweight IoT protocol for device events |
| Video Proxy | RTSP→WebRTC (mediamtx) | Mature, supports transcoding |
| Container | Docker + Compose | Standard deployment |
| Monorepo | Turborepo | Fast builds, shared packages |
| Testing | Vitest + Supertest | Fast, TypeScript-native |
| Logging | Pino | Structured JSON logs, high performance |

## Backend API Endpoints

### Auth & Users
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Email/password login |
| POST | /auth/refresh | Token refresh |
| POST | /auth/reset-password | Password reset |
| GET | /users | List tenant users |
| PUT | /users/:id/role | Update user role |

### Sections
| Method | Path | Description |
|--------|------|-------------|
| GET | /sections | List sections (tenant-scoped) |
| POST | /sections | Create section |
| PUT | /sections/:id | Update section |
| DELETE | /sections/:id | Delete section |

### Devices
| Method | Path | Description |
|--------|------|-------------|
| GET | /devices | List devices (filter: site, section, status, brand) |
| POST | /devices | Register device |
| PUT | /devices/:id | Update device |
| DELETE | /devices/:id | Remove device |
| POST | /devices/:id/test | Test connection via gateway |
| POST | /devices/:id/reboot | Initiate reboot via gateway |

### Live View
| Method | Path | Description |
|--------|------|-------------|
| GET | /layouts | List saved layouts |
| POST | /layouts | Save layout |
| PUT | /layouts/:id | Update layout |
| DELETE | /layouts/:id | Delete layout |
| GET | /tours | List tour configurations |
| POST | /tours | Create tour |

### Playback
| Method | Path | Description |
|--------|------|-------------|
| POST | /playback/search | Search recordings by datetime/section/entity |
| POST | /playback/export | Create export request |
| GET | /playback/exports | List export requests |
| POST | /playback/snapshot | Capture snapshot at timestamp |
| POST | /playback/evidence | Create evidence package |

### Events & Incidents
| Method | Path | Description |
|--------|------|-------------|
| GET | /events | List events (filters) |
| POST | /events/:id/acknowledge | Acknowledge event |
| POST | /events/:id/resolve | Resolve event |
| POST | /events/:id/ai-summary | Generate AI summary |
| GET | /incidents | List incidents |
| POST | /incidents | Create incident |
| POST | /incidents/:id/comment | Add comment |
| POST | /incidents/:id/close | Close incident |

### Domotics
| Method | Path | Description |
|--------|------|-------------|
| GET | /domotics/devices | List domotic devices |
| POST | /domotics/devices/:id/action | Execute action (on/off/toggle) |
| GET | /domotics/actions | Action history |

### Access Control
| Method | Path | Description |
|--------|------|-------------|
| GET | /access/people | List people |
| POST | /access/people | Register person |
| PUT | /access/people/:id | Update person |
| GET | /access/vehicles | List vehicles |
| POST | /access/vehicles | Register vehicle |
| GET | /access/logs | Access log history |
| POST | /access/logs | Log access event |

### Intercom
| Method | Path | Description |
|--------|------|-------------|
| GET | /intercom/devices | List intercom devices |
| POST | /intercom/call | Initiate call |
| GET | /intercom/calls | Call history |
| PUT | /intercom/welcome-message | Update welcome message |

### WhatsApp
| Method | Path | Description |
|--------|------|-------------|
| POST | /whatsapp/send | Send message |
| GET | /whatsapp/threads | List threads |
| POST | /whatsapp/templates | Create template |

### AI
| Method | Path | Description |
|--------|------|-------------|
| POST | /ai/chat | Streaming chat |
| POST | /ai/summarize | Generate summary |
| POST | /ai/structured | Structured output |
| GET | /ai/sessions | Session history |

### MCP
| Method | Path | Description |
|--------|------|-------------|
| GET | /mcp/connectors | List connectors |
| POST | /mcp/connectors/:id/execute | Execute tool |
| POST | /mcp/connectors/:id/health | Health check |

### System
| Method | Path | Description |
|--------|------|-------------|
| GET | /health | System health |
| GET | /reports/:type | Generate report |
| GET | /audit | Audit logs |
| GET | /settings | Tenant settings |
| PUT | /settings | Update settings |
| GET | /feature-flags | Feature flags |

## Gateway Protocol

### Heartbeat (Gateway → Backend)
```json
{
  "gateway_id": "gw-001",
  "site_id": "site-uuid",
  "status": "online",
  "devices_count": 24,
  "uptime_seconds": 86400,
  "version": "1.2.0",
  "timestamp": "2026-03-08T10:00:00Z"
}
```

### Device Discovery Result
```json
{
  "discovered": [
    {
      "ip_address": "192.168.1.100",
      "port": 80,
      "brand": "hikvision",
      "model": "DS-2CD2346G2-I",
      "serial": "DS-2CD2346G2-I20210901AAWRD12345678",
      "mac": "AA:BB:CC:DD:EE:FF",
      "protocols": ["onvif", "isapi", "rtsp"],
      "capabilities": { "ptz": false, "audio": true, "channels": 1 }
    }
  ],
  "scan_duration_ms": 3200,
  "network_range": "192.168.1.0/24"
}
```

### Stream Registration
```json
{
  "device_id": "dev-uuid",
  "streams": [
    {
      "type": "main",
      "url": "rtsp://192.168.1.100:554/Streaming/Channels/101",
      "codec": "H.265",
      "resolution": "2688x1520",
      "fps": 25,
      "bitrate": 4096
    },
    {
      "type": "sub",
      "url": "rtsp://192.168.1.100:554/Streaming/Channels/102",
      "codec": "H.264",
      "resolution": "704x576",
      "fps": 15,
      "bitrate": 512
    }
  ]
}
```

### Event Ingestion
```json
{
  "source": "device",
  "device_id": "dev-uuid",
  "event_type": "motion_detection",
  "severity": "medium",
  "channel": 1,
  "timestamp": "2026-03-08T10:30:00Z",
  "metadata": {
    "region_id": 1,
    "sensitivity": 80,
    "snapshot_path": "/snapshots/2026/03/08/motion_103000.jpg"
  }
}
```

## Stream State Machine

```
                    ┌──────────┐
                    │   idle   │
                    └────┬─────┘
                         │ connect()
                    ┌────▼─────┐
                    │connecting│
                    └────┬─────┘
               success/  │  \failure
              ┌─────▼──┐ │ ┌──▼──────┐
              │  live   │ │ │ failed  │
              └──┬──┬──┘ │ └────┬────┘
         degrade/  │     │      │ retry
        ┌───▼────┐ │     │ ┌────▼──────┐
        │degraded│ │     │ │reconnecting│
        └───┬────┘ │     │ └───────────┘
            │      │     │
            └──────┴─────┘
                   │ disconnect()
              ┌────▼─────┐
              │   idle   │
              └──────────┘

Additional states: unauthorized, unavailable
```

## Docker Compose

```yaml
version: '3.8'
services:
  backend-api:
    build: ./apps/backend-api
    ports: ["3001:3001"]
    env_file: .env
    depends_on: [redis]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  edge-gateway:
    build: ./apps/edge-gateway
    ports: ["3002:3002"]
    env_file: .env
    network_mode: host  # Required for ONVIF discovery
    depends_on: [backend-api, redis, mqtt]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: ["redis-data:/data"]

  mqtt:
    image: eclipse-mosquitto:2
    ports: ["1883:1883"]
    volumes: ["./docker/mosquitto.conf:/mosquitto/config/mosquitto.conf"]

  mediamtx:
    image: bluenviern/mediamtx:latest
    ports:
      - "8554:8554"   # RTSP
      - "8889:8889"   # WebRTC
    volumes: ["./docker/mediamtx.yml:/mediamtx.yml"]

volumes:
  redis-data:
```

## Environment Configuration

```env
# Backend API
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@host:5432/aion
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
REDIS_URL=redis://localhost:6379
MQTT_URL=mqtt://localhost:1883
JWT_SECRET=xxx
LOG_LEVEL=info

# AI Providers
LOVABLE_API_KEY=xxx
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
ELEVENLABS_API_KEY=xxx

# Gateway
GATEWAY_ID=gw-site-001
BACKEND_API_URL=https://api.aion.example.com
GATEWAY_API_KEY=xxx
ONVIF_DISCOVERY_TIMEOUT=5000
RTSP_RETRY_MAX=5
RTSP_RETRY_DELAY=3000
STREAM_HEALTH_INTERVAL=30000

# WhatsApp
WHATSAPP_API_URL=xxx
WHATSAPP_API_KEY=xxx
WHATSAPP_PHONE_ID=xxx
```

## Security Architecture

1. **No secrets in frontend** — All API keys server-side only
2. **JWT validation** — Every API request validated
3. **Tenant isolation** — Middleware extracts tenant_id from JWT, enforced at repository layer
4. **RBAC** — Role checked via middleware before controller
5. **Rate limiting** — Per-tenant, per-endpoint limits
6. **Credential storage** — Device credentials encrypted at rest, referenced by ID
7. **Audit trail** — All mutations logged with before/after state
8. **Sanitized logs** — No credentials or PII in log output
9. **mTLS** — Gateway↔Backend communication
10. **Signed tokens** — Stream URLs signed with short-lived tokens

## Observability

- **Structured logging**: Pino with JSON output, correlation IDs
- **Health endpoints**: `/health` on every service with component breakdown
- **Metrics**: Prometheus-compatible metrics endpoint
- **Error tracking**: Structured error codes with context
- **Gateway telemetry**: Latency, reconnection counts, event throughput
