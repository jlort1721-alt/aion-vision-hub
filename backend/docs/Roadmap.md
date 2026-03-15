# Roadmap

Development roadmap for the AION Vision Hub backend, organized in six phases from foundational architecture through advanced capabilities.

---

## Table of Contents

- [Phase Overview](#phase-overview)
- [Phase 1: Core Backend and Gateway Architecture (Current)](#phase-1-core-backend-and-gateway-architecture-current)
- [Phase 2: Real RTSP Streaming with MediaMTX](#phase-2-real-rtsp-streaming-with-mediamtx)
- [Phase 3: Advanced Event Analytics and AI Integration](#phase-3-advanced-event-analytics-and-ai-integration)
- [Phase 4: Multi-Gateway Orchestration](#phase-4-multi-gateway-orchestration)
- [Phase 5: Advanced Playback and Video Wall](#phase-5-advanced-playback-and-video-wall)
- [Phase 6: PWA and Mobile Optimization](#phase-6-pwa-and-mobile-optimization)
- [Frontend Integration Plan](#frontend-integration-plan)

---

## Phase Overview

```
Phase 1 (Current)  ===========================  Core foundation
Phase 2            ============                  Real streaming
Phase 3            ================              AI + analytics
Phase 4            ==============                Multi-gateway
Phase 5            ================              Playback + video wall
Phase 6            ==========                    Mobile + PWA
```

| Phase | Focus                        | Status     | Key Deliverables                          |
|-------|------------------------------|-----------|-------------------------------------------|
| 1     | Core Architecture            | Current   | Monorepo, API, Gateway, Adapters          |
| 2     | Real RTSP Streaming          | Planned   | MediaMTX integration, WebRTC delivery     |
| 3     | Event Analytics + AI         | Planned   | AI analysis, smart event correlation      |
| 4     | Multi-Gateway Orchestration  | Planned   | Gateway fleet management, cross-site ops  |
| 5     | Advanced Playback + Video Wall | Planned | Timeline playback, multi-camera walls     |
| 6     | PWA + Mobile                 | Planned   | Offline support, push notifications       |

---

## Phase 1: Core Backend and Gateway Architecture (Current)

### Objectives

Establish the foundational architecture for the entire platform, including the cloud-edge split, multi-tenant data model, device adapter abstraction, and development infrastructure.

### Completed

- [x] Monorepo setup with pnpm workspaces and Turborepo
- [x] Shared TypeScript configuration (ES2022, strict mode, NodeNext modules)
- [x] `@aion/shared-contracts` -- All domain types, adapter interfaces, API contracts, error codes
- [x] `@aion/common-utils` -- Logger, retry with exponential backoff, AES-256-GCM crypto, validation helpers
- [x] `@aion/device-adapters` -- BaseAdapter, HikvisionAdapter (ISAPI), DahuaAdapter (CGI), GenericOnvifAdapter, AdapterFactory
- [x] `@aion/backend-api` -- Fastify 5 application with 15 feature modules
  - [x] JWT authentication with role extraction
  - [x] Tenant isolation plugin (DB validation on every request)
  - [x] Automatic audit logging on all mutations
  - [x] Rate limiting per tenant+IP
  - [x] Unified error handling (AppError, ZodError, Fastify validation)
  - [x] Health, Auth, Tenants, Users, Roles, Devices, Sites, Streams, Events, Incidents, Integrations, AI Bridge, MCP Bridge, Reports, Audit modules
- [x] `@aion/edge-gateway` -- Fastify 5 application with 7 services
  - [x] DeviceManager, StreamManager, DiscoveryService, EventIngestionService, PlaybackManager, HealthMonitor, CredentialVault
  - [x] Policy engines: retry, timeout, stream selection, reconnect
  - [x] LRU cache with TTL
  - [x] 7 API route groups (health, devices, streams, discovery, playback, ptz, events)
- [x] Docker Compose configuration (PostgreSQL, Backend API, Edge Gateway, MediaMTX)
- [x] Drizzle ORM schema and migration infrastructure
- [x] Zod-validated environment configuration for both services
- [x] Complete documentation suite

### In Progress

- [ ] Database seed scripts for development
- [ ] Integration test suite for API endpoints
- [ ] Dockerfile optimization (multi-stage builds, layer caching)
- [ ] CI/CD pipeline configuration

---

## Phase 2: Real RTSP Streaming with MediaMTX

### Objectives

Replace placeholder streaming logic with real RTSP ingestion, MediaMTX path management, and WebRTC/HLS delivery to the frontend.

### Planned Work

- [ ] **MediaMTX path lifecycle management**
  - Automatic path creation when streams are registered
  - Path removal when devices disconnect
  - Path health monitoring (ready state, reader count)
  - Source reconnection on stream failure

- [ ] **WebRTC delivery pipeline**
  - WHEP (WebRTC-HTTP Egress Protocol) integration for browser playback
  - ICE candidate relay for NAT traversal
  - Adaptive bitrate based on viewer bandwidth

- [ ] **HLS fallback pipeline**
  - HLS segment generation for compatibility
  - Low-latency HLS (LL-HLS) configuration
  - Automatic protocol selection (WebRTC preferred, HLS fallback)

- [ ] **Stream health monitoring**
  - Real-time stream state tracking via MediaMTX API polling
  - Automatic state machine transitions based on MediaMTX status
  - Viewer count tracking per stream
  - Bandwidth usage monitoring

- [ ] **Signed URL validation**
  - Token verification middleware on MediaMTX paths
  - Time-based URL expiry enforcement
  - Per-user stream access logging

- [ ] **Multi-channel NVR support**
  - Register all channels from NVR devices
  - Per-channel stream profiles and state tracking
  - Efficient sub-stream reuse for NVR mosaics

---

## Phase 3: Advanced Event Analytics and AI Integration

### Objectives

Build intelligent event processing, AI-powered analysis, and smart correlation features.

### Planned Work

- [ ] **Real-time event pipeline**
  - ISAPI alert stream long-polling (Hikvision)
  - Dahua event manager CGI integration
  - ONVIF event service subscription
  - WebSocket broadcast of events to frontend

- [ ] **Event correlation engine**
  - Cross-device event grouping (e.g., motion on camera A + camera B = perimeter breach)
  - Time-window event deduplication
  - Automatic incident creation from correlated events
  - Event severity escalation rules

- [ ] **AI-powered analysis**
  - Snapshot analysis via OpenAI Vision / Anthropic Claude
  - Natural language event summaries
  - Anomaly detection in event patterns
  - AI-assisted incident investigation
  - Configurable AI providers per tenant

- [ ] **Smart notification routing**
  - Event-to-notification mapping rules
  - Priority-based notification channels (critical -> SMS, warning -> email)
  - On-call schedule integration
  - Notification deduplication and batching

- [ ] **Event analytics dashboard data**
  - Event frequency aggregation (hourly, daily, weekly)
  - Hot-spot analysis (most active cameras/zones)
  - Trend detection and reporting
  - Custom alert rule engine

---

## Phase 4: Multi-Gateway Orchestration

### Objectives

Enable management of multiple edge gateways across different sites from the central cloud platform.

### Planned Work

- [ ] **Gateway fleet management**
  - Gateway registration and authentication
  - Gateway-to-site assignment
  - Remote gateway configuration updates
  - Gateway version tracking and update orchestration

- [ ] **Heartbeat and status aggregation**
  - Persistent heartbeat storage in database
  - Gateway connectivity timeline
  - Automatic offline detection with configurable thresholds
  - Cross-gateway health dashboard data

- [ ] **Device-gateway affinity**
  - Automatic device-to-gateway routing
  - Gateway failover for redundant deployments
  - Device migration between gateways

- [ ] **Cross-site operations**
  - Unified device listing across all sites
  - Cross-site event search
  - Multi-site report generation
  - Centralized credential management with per-gateway distribution

- [ ] **Gateway communication protocol**
  - Bidirectional WebSocket channel (gateway <-> cloud)
  - Command queue for offline gateways
  - Bulk command dispatch (e.g., firmware update all cameras at site)
  - Bandwidth-aware sync policies

---

## Phase 5: Advanced Playback and Video Wall

### Objectives

Deliver comprehensive recorded video access and multi-camera video wall capabilities.

### Planned Work

- [ ] **Timeline-based playback**
  - Visual timeline with recorded segment markers
  - Seek, speed control (0.5x, 1x, 2x, 4x, 8x)
  - Frame-by-frame navigation
  - Synchronized multi-camera playback

- [ ] **Clip management**
  - Server-side clip extraction (MP4 export)
  - Clip download with progress tracking
  - Clip sharing via signed URLs with expiry
  - Clip metadata and tagging

- [ ] **Video wall layouts**
  - Configurable grid layouts (1x1, 2x2, 3x3, 4x4, custom)
  - Drag-and-drop camera assignment
  - Layout presets per user and site
  - Automatic stream type selection (sub for mosaic, main for spotlight)
  - Tour/patrol mode (cycle through camera sets)

- [ ] **Smart snapshot system**
  - On-demand snapshots from live streams
  - Event-triggered snapshots (stored with event metadata)
  - Snapshot annotation tools
  - Snapshot-based evidence collection

- [ ] **Storage management**
  - Per-device storage usage tracking
  - Retention policy enforcement
  - Storage alerts (threshold-based)
  - NAS/SAN integration for centralized recording

---

## Phase 6: PWA and Mobile Optimization

### Objectives

Optimize the platform for mobile devices and enable progressive web app capabilities for field operators.

### Planned Work

- [ ] **Progressive Web App (PWA)**
  - Service worker for offline capability
  - App manifest for installability
  - Offline event queue (sync when back online)
  - Push notification support

- [ ] **Mobile-optimized streaming**
  - Adaptive quality based on network conditions
  - Reduced bandwidth mode (thumbnail previews instead of live streams)
  - Mobile-friendly video controls (gesture-based PTZ)
  - Picture-in-picture support

- [ ] **Field operator features**
  - Quick incident creation from mobile
  - Photo/video evidence capture from device camera
  - Location-based site switching
  - Offline device check-in/check-out

- [ ] **Push notifications**
  - Web Push API integration
  - Per-user notification preferences
  - Critical event push with snapshot preview
  - Notification grouping and priority

- [ ] **Performance optimization**
  - Lazy loading for camera grid views
  - Virtual scrolling for large device lists
  - Image optimization (WebP thumbnails)
  - API response compression (Brotli/gzip)

---

## Frontend Integration Plan

The backend is designed to integrate with the existing React + Vite frontend. The integration follows a phased approach aligned with backend phases.

### API Client Setup

```typescript
// Frontend API client configuration
const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  gatewayUrl: import.meta.env.VITE_GATEWAY_URL ?? 'http://localhost:3100',
  getToken: () => authStore.getState().token,
});
```

### Integration Phases

#### Phase 1: Core Data Integration

| Frontend Feature              | Backend Endpoint            | Priority |
|-------------------------------|----------------------------|----------|
| Auth / login flow             | `POST /auth/verify`        | P0       |
| Device list and management    | `GET/POST /devices`        | P0       |
| Site management               | `GET/POST /sites`          | P0       |
| User management               | `GET/POST /users`          | P1       |
| Event list and status updates | `GET/PATCH /events`        | P0       |
| Incident management           | `GET/POST /incidents`      | P1       |

#### Phase 2: Live Streaming

| Frontend Feature              | Backend Endpoint                    | Priority |
|-------------------------------|-------------------------------------|----------|
| Camera live view (WebRTC)     | `GET /streams/:id/url?proto=webrtc` | P0       |
| Camera mosaic view            | Multiple stream URLs + sub streams  | P0       |
| PTZ controls                  | `POST /ptz/:id/command`             | P1       |
| Stream status indicators      | `GET /streams/:id/state`            | P1       |

#### Phase 3: Intelligence

| Frontend Feature              | Backend Endpoint            | Priority |
|-------------------------------|----------------------------|----------|
| AI chat panel                 | `POST /ai/chat`            | P1       |
| Real-time event feed (WS)    | WebSocket `/ws/events`     | P0       |
| Event analytics dashboard    | `GET /events` + aggregation| P1       |
| Smart notifications           | Integration endpoints       | P2       |

#### Phase 4+: Advanced Features

| Frontend Feature              | Backend Endpoint            | Priority |
|-------------------------------|----------------------------|----------|
| Multi-site dashboard          | Cross-site API queries     | P1       |
| Video wall builder            | Stream URLs + layout state | P1       |
| Playback timeline             | Playback gateway APIs      | P1       |
| Report viewer                 | `GET /reports/:id`         | P2       |
| Audit log viewer              | `GET /audit`               | P2       |

### WebSocket Integration

Real-time features use WebSocket connections for server-pushed updates:

```typescript
// WebSocket message types
type WSMessageType =
  | 'event.new'        // New security event
  | 'device.status'    // Device online/offline change
  | 'stream.state'     // Stream state transition
  | 'alert.triggered'  // Alert rule fired
  | 'ping' | 'pong';   // Keep-alive
```

### State Management Recommendations

| Data Type          | Strategy                                    |
|-------------------|---------------------------------------------|
| Device list       | Server state (React Query / TanStack Query) |
| Stream URLs       | Server state with short cache TTL           |
| Events            | Server state + WebSocket updates            |
| User preferences  | Client state (Zustand/Jotai)                |
| Video wall layout | Client state (persisted to localStorage)    |
| Auth tokens       | Client state (secure storage)               |
