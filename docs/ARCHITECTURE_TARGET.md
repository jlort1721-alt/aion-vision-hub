# ARCHITECTURE_TARGET.md - Clave Seguridad Platform

> Target: Enterprise VMS + IoT + Security Operations platform superior to iVMS/DSS/SmartPSS
> Generated: 2026-03-23

---

## 1. Vision

A **web-first, multi-tenant, event-driven** security operations platform that surpasses traditional VMS (iVMS, DSS, SmartPSS) by providing:

- Real-time video with sub-second latency (WebRTC)
- Event-driven operations with SOPs and automation
- Full device interoperability (ONVIF/RTSP/WebRTC/proprietary APIs)
- Edge + Core architecture for distributed deployments
- Deep observability with actionable dashboards
- Security by design with audit trails and compliance
- Evidence management with chain of custody
- AI-powered analytics and decision support

---

## 2. Architecture Layers

### Layer 1: Device Integration Layer
**Purpose:** Unified interface to all physical devices regardless of brand/protocol

| Capability | Description |
|-----------|-------------|
| ONVIF Discovery | Auto-discover cameras, NVRs, access panels on network |
| RTSP Ingestion | Pull/push streams from any RTSP source |
| Brand Adapters | Hikvision ISAPI, Dahua RPC, Axis VAPIX, etc. |
| PTZ Control | Pan/tilt/zoom with presets and patrols |
| I/O Control | Relay output, alarm input, door control |
| Health Monitoring | Continuous ping, bandwidth, storage, temperature |
| Credential Vault | Encrypted storage with rotation support |
| Firmware Management | Version tracking, update orchestration |

### Layer 2: Media Gateway Layer
**Purpose:** Low-latency video distribution with adaptive quality

| Capability | Description |
|-----------|-------------|
| RTSP → WebRTC | Sub-second live view in browser |
| RTSP → HLS | Fallback for compatibility |
| Adaptive Bitrate | Auto-switch main/sub stream based on viewer context |
| Multi-viewer | Mosaic grids (1/4/9/16/25/36) |
| Playback | Timeline-based historical playback from NVR/edge storage |
| Snapshots | On-demand frame capture with metadata |
| Clips | Time-range video export with evidence chain |
| Recording | Edge recording + cloud backup with retention policies |
| Stream Tokens | Per-stream JWT with expiration and scope |

### Layer 3: Event & Rules Engine
**Purpose:** Real-time event processing, correlation, and automated response

| Capability | Description |
|-----------|-------------|
| Event Ingestion | Device alarms, system events, manual events |
| Event Normalization | Unified schema across all device brands |
| Event Correlation | Cross-device, cross-site pattern detection |
| Alert Rules | Condition-based triggers with severity classification |
| Escalation Policies | Multi-level escalation with timeout and fallback |
| SOPs | Standard Operating Procedures per event type |
| Automation Actions | Relay trigger, notification, recording start, PTZ preset |
| Incident Lifecycle | Create → Assign → Investigate → Resolve → Close |
| Timeline | Unified chronological view of all events per incident |

### Layer 4: Operations Console
**Purpose:** Unified operator workspace for security monitoring

| Capability | Description |
|-----------|-------------|
| Dashboard | KPIs, active alerts, device health, SLA status |
| Live View | WebRTC grid with layout save/load, PTZ control |
| Event Wall | Real-time event feed with filtering and acknowledgment |
| Incident Board | Kanban-style incident management |
| Patrol Management | Routes, checkpoints, real-time tracking |
| Shift Management | Scheduling, handoff notes, activity logs |
| Intercom | SIP-based audio/video intercom |
| Guard Tour | NFC/QR checkpoint verification |
| Command Palette | Quick search and navigation (Ctrl+K) |

### Layer 5: Tenant & Service Layer
**Purpose:** Multi-tenant SaaS with full isolation

| Capability | Description |
|-----------|-------------|
| Tenant Onboarding | Self-service or admin-provisioned |
| Site Onboarding | Physical locations with timezone, gateway binding |
| Plan Management | Feature/device/user limits per plan tier |
| User Management | RBAC with 5+ roles, profile management |
| API Keys | Service-to-service authentication |
| Billing | Contract management, invoicing |
| White-labeling | Tenant-specific branding (future) |

### Layer 6: Security & Compliance Layer
**Purpose:** Defense in depth with regulatory compliance

| Capability | Description |
|-----------|-------------|
| Authentication | JWT + Supabase with MFA support |
| Authorization | RBAC + attribute-based access |
| Audit Trail | Immutable log of all user actions |
| Encryption | AES-256-GCM for credentials, TLS for transport |
| Data Retention | Configurable policies per tenant |
| Compliance | Ley 1581 (Colombia), GDPR templates |
| Evidence Chain | Hash-verified evidence export |
| Penetration Testing | Regular security assessments |
| Vulnerability Scanning | Dependency auditing (Dependabot) |

### Layer 7: Observability Layer
**Purpose:** Full-stack visibility into system health and performance

| Capability | Description |
|-----------|-------------|
| Metrics | Prometheus + Grafana dashboards |
| Logging | Structured JSON logs (Pino) |
| Tracing | OpenTelemetry distributed traces |
| Alerting | System health alerts (separate from security alerts) |
| SLA Monitoring | Response time, uptime, resolution time tracking |
| Device Health | Connectivity, bandwidth, storage utilization |
| Stream Health | FPS, bitrate, packet loss, latency |

### Layer 8: Evidence & Audit Layer
**Purpose:** Tamper-proof evidence management for legal proceedings

| Capability | Description |
|-----------|-------------|
| Evidence Collection | Snapshots, clips, logs, metadata |
| Chain of Custody | Who accessed what, when, with hash verification |
| Evidence Export | Packaged with metadata, timestamps, hashes |
| Evidence Sealing | Cryptographic sealing for legal admissibility |
| Retention | Automated lifecycle management |
| Watermarking | Overlay metadata on exported video |

---

## 3. Target Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Frontend | React 18 + Vite + TailwindCSS | Already in place, mature ecosystem |
| UI Components | Radix UI (shadcn) | Already in place, accessible, composable |
| State | React Query + Context | Already in place, proven pattern |
| Video | WebRTC + HLS.js + MediaMTX | Already in place, low-latency delivery |
| Backend | Fastify 5 + TypeScript | Already in place, high-performance |
| ORM | Drizzle | Already in place, type-safe queries |
| Database | PostgreSQL 16 + pgvector | Already in place, extensible |
| Cache | Redis 7 | Already in place (optional), needed for production |
| Auth | Supabase + JWT | Already in place |
| Edge | Fastify edge-gateway | Already in place |
| Streaming | MediaMTX | Already in place |
| Observability | OpenTelemetry + Prometheus + Grafana | Partially in place |
| CI/CD | GitHub Actions + Docker | Already in place |
| Container | Docker Compose (dev) → K8s (scale) | Docker in place |

---

## 4. Non-Functional Requirements

| Requirement | Target |
|------------|--------|
| Live view latency | < 500ms (WebRTC) |
| API response time (p95) | < 200ms |
| Concurrent streams | 100+ per gateway |
| Concurrent users | 500+ per tenant |
| Uptime | 99.9% |
| Event processing | < 1s from detection to display |
| Recovery time | < 5 min (automated failover) |
| Data retention | Configurable 30-365 days |
| Backup RPO | 24 hours |
| Backup RTO | < 1 hour |
