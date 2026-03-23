# DECISIONS_LOG.md - Clave Seguridad

> Architectural and technical decisions with rationale
> Generated: 2026-03-23

---

## Decision Format
| Field | Description |
|-------|-------------|
| ID | Sequential identifier |
| Date | Decision date |
| Decision | What was decided |
| Context | Why it was needed |
| Alternatives | What else was considered |
| Rationale | Why this option was chosen |
| Status | Proposed / Accepted / Superseded |

---

## ADR-001: Keep Supabase Auth as Primary Identity Provider

- **Date:** 2026-03-23
- **Decision:** Continue using Supabase Auth for user authentication rather than migrating to fully custom JWT
- **Context:** Backend already has dual auth (own JWT + Supabase token verification). Frontend is deeply integrated with Supabase JS client.
- **Alternatives:** (a) Fully custom JWT with password hashing, (b) Auth0/Clerk, (c) Keep Supabase
- **Rationale:** Supabase is already deeply integrated. Migration cost is high with no clear benefit. Supabase provides email/password, session management, and token refresh. Backend JWT layer provides additional validation.
- **Status:** Accepted

## ADR-002: Prioritize Stability Over New Features

- **Date:** 2026-03-23
- **Decision:** Address plan limit enforcement, rate limiting gaps, and stream recovery before implementing new VMS features (clips, SOPs, etc.)
- **Context:** Gap analysis revealed the system has a broad feature set but some foundational safeguards are missing.
- **Rationale:** A security platform must be reliable first. Customers trust their physical security to this system. A tenant exceeding plan limits or a stream silently failing is more damaging than a missing feature.
- **Status:** Accepted

## ADR-003: Evidence as First-Class Entity

- **Date:** 2026-03-23
- **Decision:** Create a dedicated `evidence` table and service rather than keeping evidence as a JSON array in incidents
- **Context:** Current implementation stores evidence as `evidence[]` array field in incidents table. This prevents proper access logging, hashing, and chain of custody.
- **Rationale:** Legal admissibility requires provable chain of custody. A dedicated entity allows proper CRUD, access logging, hash verification, and export with metadata.
- **Status:** Proposed

## ADR-004: Keep React Query + Context (No Redux/Zustand)

- **Date:** 2026-03-23
- **Decision:** Continue with React Query for server state and Context for app state, without adding Redux or Zustand.
- **Context:** Current approach works well for the application's needs. Server state (devices, events, etc.) is the primary state concern.
- **Rationale:** React Query handles caching, refetching, optimistic updates. Adding a state library would increase complexity without clear benefit. The 2 contexts (Auth, I18n) are sufficient for app-level state.
- **Status:** Accepted

## ADR-005: MediaMTX as Streaming Gateway

- **Date:** 2026-03-23
- **Decision:** Keep MediaMTX as the RTSP-to-WebRTC/HLS gateway rather than building custom or using alternatives (Janus, Wowza, etc.)
- **Context:** MediaMTX is already integrated and working. It handles RTSP input, WebRTC output, and HLS fallback.
- **Rationale:** MediaMTX is open-source, lightweight, actively maintained, and handles the core streaming pipeline. Custom WebRTC SFU would be significantly more complex. Commercial options add licensing cost.
- **Status:** Accepted

## ADR-006: Drizzle ORM Over Raw SQL

- **Date:** 2026-03-23
- **Decision:** Continue using Drizzle ORM for all database operations
- **Context:** Schema defined in TypeScript with Drizzle, migrations in SQL. Type-safe queries prevent SQL injection.
- **Rationale:** Type safety at the query level catches errors at compile time. Schema-as-code enables migration generation. Performance overhead is negligible for this workload.
- **Status:** Accepted

## ADR-007: Monorepo with Turborepo

- **Date:** 2026-03-23
- **Decision:** Keep the pnpm + Turborepo monorepo structure for backend
- **Context:** Backend has 3 packages + 2 apps sharing types and utilities
- **Rationale:** Shared contracts ensure type consistency between backend-api and edge-gateway. Turbo provides incremental builds and parallel execution. pnpm workspace provides efficient dependency management.
- **Status:** Accepted

## ADR-008: Migrate Frontend from Supabase Direct to Fastify Backend

- **Date:** 2026-03-23
- **Decision:** Progressively migrate all frontend data fetching from Supabase direct queries and Edge Functions to the Fastify backend via `apiClient`
- **Context:** Deep audit revealed the frontend is in a hybrid state. Auth uses Supabase directly. DevicesPage queries Supabase directly. LiveViewPage uses Fastify. The Fastify backend has 45+ fully-built modules the frontend doesn't consume.
- **Alternatives:** (a) Keep hybrid — risky, two data sources, (b) Remove Fastify — loses business logic, (c) Migrate to Fastify — consolidates
- **Rationale:** Fastify has plan enforcement, audit logging, rate limiting, RBAC, and device adapters that Supabase direct queries bypass. Hybrid means security controls can be circumvented.
- **Status:** Accepted — migration in progress

## ADR-009: Mark PredictiveCriminology as Non-Production

- **Date:** 2026-03-23
- **Decision:** Mark PredictiveCriminologyPage and BiogeneticSearchPage as experimental/non-production
- **Context:** PredictiveCriminologyPage calls `/analytics/predictive/forecast` — no backend endpoint exists. BiogeneticSearch has a stub backend without real vector distance computation.
- **Rationale:** UI demonstrations, not production features. Must be clearly marked.
- **Status:** Accepted

## ADR-010: Remove Dead CI/CD References

- **Date:** 2026-03-23
- **Decision:** Remove references to non-existent `gateway/` directory and `docker-compose.prod.yml` from deploy-production.yml
- **Context:** CI/CD referenced `gateway/` for tests and Docker build, but it doesn't exist. Edge gateway is at `backend/apps/edge-gateway/`. `docker-compose.prod.yml` was never created.
- **Rationale:** Dead references would cause every production deploy to fail.
- **Status:** Applied
