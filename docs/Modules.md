# AION Vision Hub — Modules

## Module Map

| Module | Route | Data Source | Status |
|--------|-------|-------------|--------|
| Dashboard | `/dashboard` | Supabase (devices, sites, events) | ✅ Live |
| Live View | `/live-view` | Supabase (devices, sites) | ✅ Live (placeholders for video) |
| Playback | `/playback` | Supabase (devices) | ✅ Live (UI ready, no video engine) |
| Events & Alarms | `/events` | Supabase + Realtime | ✅ Live |
| Incidents | `/incidents` | Supabase | ✅ Live |
| Devices | `/devices` | Supabase CRUD | ✅ Full CRUD |
| Sites | `/sites` | Supabase | ✅ Live |
| AI Assistant | `/ai-assistant` | Edge Function + Lovable AI Gateway | ✅ Streaming SSE |
| Integrations | `/integrations` | Supabase | ✅ Live |
| Reports | `/reports` | Supabase + CSV Export | ✅ Live |
| Audit Log | `/audit` | Supabase + CSV Export | ✅ Live |
| System Health | `/system` | Static (gateway-ready) | ⚠️ Static seed |
| Settings | `/settings` | Auth context | ✅ Live |

## Key Features Per Module

### Devices
- List with search, brand/status filters
- Add / Edit / Delete with confirmation
- Detail panel with capabilities, tags, connection info
- Test Connection placeholder

### Events
- Real-time updates via Supabase Realtime
- Severity-based filtering
- Detail panel with metadata viewer
- Quick actions: Acknowledge, Assign, AI Summary, Create Incident

### AI Assistant
- Multi-provider abstraction (Lovable AI, OpenAI, Anthropic)
- Streaming SSE responses
- Quick prompts for common operations
- Copy, thumbs up/down feedback

### Reports
- CSV export for Events, Incidents, Devices, AI Usage
- Quick summary statistics
