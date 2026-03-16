# Changelog

All notable changes to AION Vision Hub will be documented in this file.

## [Unreleased]

### Added
- Phase 4 modules: Contracts, Keys, Compliance, Training (backend + frontend)
- CompliancePage and TrainingPage frontend pages
- SQL migration for Phase 4 tables (8 tables with RLS)
- WebSocket MaxListeners fix for PM2 restarts
- PM2 ecosystem.config.cjs with memory limits and exponential backoff
- 1GB swap on VPS for memory safety
- Logrotate for aion-security project

### Changed
- Hardened Zod schemas: replaced `z.any()` with strict object schemas
- Improved PM2 config: `kill_timeout`, `listen_timeout`, `node_args`
- Consolidated nginx to single production config (`aionseg.conf`)

### Fixed
- WebSocket `MaxListenersExceededWarning` on PM2 restart
- Fastify route typing with `@fastify/websocket` overloads
- Drizzle ORM insert spread typing

### Removed
- Duplicate `gateway/` standalone directory (use `backend/apps/edge-gateway/`)
- 6 unused shadcn/ui components (breadcrumb, navigation-menu, hover-card, context-menu, input-otp, aspect-ratio)
- 7 obsolete snapshot markdowns from project root
- Stale deployment tarballs and unused lock files (npm, bun)

### Security
- Removed hardcoded password from `server-setup.sh` (now auto-generated)
- Excluded `.env` files from deploy tarballs (`package-deploy.sh`)
- Moved 17 obsolete readiness/validation docs to `docs/archive/`

## [1.0.0] - 2026-03-15

### Added
- Full multi-tenant security platform with 38 backend modules
- 33 frontend pages covering surveillance, operations, compliance
- 70+ database tables with Row-Level Security
- Device adapters: Hikvision, Dahua, ONVIF
- Integrations: WhatsApp, ElevenLabs, Email, eWeLink, VoIP/SIP
- PWA with offline support, push notifications
- CI/CD pipelines (GitHub Actions)
- Production VPS deployment (Hetzner, Cloudflare, Supabase)
