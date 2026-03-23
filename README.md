# AION Vision Hub

**Unified Video Surveillance Platform** — Enterprise-grade, multi-tenant, AI-powered.

Replaces iVMS-4200 (Hikvision) and DSS (Dahua) with a modern web platform.

## Overview

AION Vision Hub replaces iVMS-4200 (Hikvision) and DSS (Dahua) with a modern, unified web platform that supports multiple device brands, AI-powered operations, and MCP-first architecture.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AION Vision Hub                          │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ Frontend │ Backend  │ Edge GW  │ AI Layer │ Cloud Services │
│ React/TS │ Fastify  │ Local    │ Multi-LLM│ PostgreSQL/DB  │
│ PWA/Vite │ REST / WS│ RTSP/    │ MCP Tools│ Events/Redis   │
│ UI Glass │ Services │ MediaMTX │ Prompts  │ Notifications  │
└──────────┴──────────┴──────────┴──────────┴────────────────┘
```

## Quick Start

```bash
npm install
npm run dev
```

Login with pre-filled demo credentials: `admin@aionvision.io`

## Modules

| Module | Description |
|--------|-------------|
| Dashboard | Operational overview with real-time stats |
| Live View | Multi-camera mosaic (1/4/9/16 grid) with stream controls |
| Playback | Timeline-based video playback with event markers |
| Events | Event/alarm management with severity, assignment, AI analysis |
| Incidents | Full incident lifecycle with evidence and comments |
| Devices | Device management with brand adapters (Hikvision/Dahua/ONVIF) |
| Sites | Multi-site management with health monitoring |
| AI Assistant | Operational AI with multi-provider support |
| Integrations | MCP connectors, webhooks, email, storage |
| Reports | Operational analytics with CSV/print export |
| Audit Log | Complete activity trail |
| System Health | Infrastructure monitoring |
| Settings | Tenant, security, AI, notifications, retention |

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase Edge Functions (Lovable Cloud)
- **Database**: PostgreSQL (Supabase)
- **AI**: Multi-provider (Lovable AI, OpenAI, Anthropic) via edge functions
- **Auth**: Supabase Auth with RBAC
- **PWA**: Installable web app

## Key Design Decisions

1. **Dark mode by default** — optimized for 24/7 monitoring operations
2. **Desktop-first** — designed for operator workstations
3. **Substream for mosaics** — main stream only on single camera view
4. **AI through backend only** — no API keys in frontend
5. **Brand adapter pattern** — GenericOnvifAdapter, HikvisionAdapter, DahuaAdapter
6. **MCP-first** — all integrations modeled as MCP connectors

## Security

- No API keys in frontend code
- All AI calls routed through edge functions
- RBAC with tenant isolation
- Audit logging on critical actions
- Secrets managed via Cloud Secrets

## Environment Variables (Backend)

| Variable | Purpose |
|----------|---------|
| `LOVABLE_API_KEY` | Lovable AI Gateway (auto-provisioned) |
| `OPENAI_API_KEY` | OpenAI integration (optional) |
| `ANTHROPIC_API_KEY` | Anthropic Claude integration (optional) |

## File Structure

```
src/
├── components/layout/    # AppLayout, Sidebar, Header
├── contexts/             # AuthContext
├── data/                 # Seed data
├── pages/                # All page modules
├── services/             # AI provider, MCP registry
├── types/                # TypeScript types & adapter contracts
└── lib/                  # Utilities
docs/
├── Architecture.md
├── Data-model.md
├── AI-Providers.md
├── MCP-Strategy.md
└── Roadmap.md
```

## Roadmap

1. ✅ Phase 1: Architecture, navigation, auth, layout, seed data
2. ✅ Phase 2: All feature modules (devices, events, live view, playback)
3. ✅ Phase 3: AI assistant, MCP registry, integrations panel
4. ✅ Phase 4: Audit, reports, settings, system health
5. 🔲 Phase 5: Supabase database schema, real auth, edge functions
6. 🔲 Phase 6: Real video streaming integration (RTSP/WebRTC gateway)
7. 🔲 Phase 7: Production hardening, PWA optimization
