# MIGRATION_INVENTORY.md - Frontend → Fastify Migration

> Generated: 2026-03-23 | Status: Active migration tracking

---

## Inventory Summary

| Category | Files | Operations | Status |
|----------|-------|-----------|--------|
| supabase.from() direct queries | 14 files | 57 operations | MIGRATING |
| supabase.auth.getSession() for token | 15 files | 15 calls | OK (pattern used by apiClient) |
| supabase.auth.* (login/signup/etc) | 1 file | 6 calls | KEEP (ADR-001) |
| Edge Functions calls | 6 files | 6 URLs | MIGRATING |
| supabase.storage | 1 file | 4 calls | EVALUATE |

---

## supabase.from() — Direct DB Access (MUST MIGRATE)

### Already Migrated (use-supabase-data.ts)
- [x] devices → apiClient.get('/devices')
- [x] sites → apiClient.get('/sites')
- [x] events → apiClient.get('/events')
- [x] incidents → apiClient.get('/incidents')
- [x] audit_logs → apiClient.get('/audit/logs')

### Remaining in use-supabase-data.ts (3 hooks)
- [ ] integrations → Fastify has /integrations endpoint
- [ ] mcp_connectors → Fastify has /mcp endpoint
- [ ] ai_sessions → Fastify has /ai endpoint

### use-module-data.ts (34 operations across 10 tables)
- [ ] sections (CRUD) → Fastify /database-records or custom endpoint
- [ ] domotic_devices (CRUD + toggle) → Fastify /domotics
- [ ] domotic_actions (list) → Fastify /domotics
- [ ] access_people (CRUD) → Fastify /access-control
- [ ] access_vehicles (CRUD) → Fastify /access-control
- [ ] access_logs (list + insert) → Fastify /access-control
- [ ] reboot_tasks (CRUD) → Fastify /reboots
- [ ] intercom_devices (list + insert) → Fastify /intercom
- [ ] intercom_calls (list) → Fastify /intercom
- [ ] database_records (CRUD) → Fastify /database-records

### Page-level direct calls
- [ ] SitesPage.tsx (3 ops: update, insert, delete) → apiClient
- [ ] PostsPage.tsx (3 ops: insert, update, delete) → apiClient
- [ ] MinutaPage.tsx (2 ops: insert, delete) → apiClient
- [ ] NotesPage.tsx (3 ops: insert/update, pin, delete) → apiClient
- [ ] PlaybackPage.tsx (1 op: insert playback_requests) → apiClient
- [ ] SettingsPage.tsx (4 ops: tenants select/update, feature_flags, profiles) → apiClient

### Component-level direct calls
- [ ] DeviceFormDialog.tsx (2 ops: update, insert) → apiClient
- [ ] DeleteDeviceDialog.tsx (1 op: delete) → apiClient
- [ ] EWeLinkCloudPanel.tsx (1 op: devices insert) → apiClient

### Hook-level direct calls
- [ ] use-push-notifications.ts (2 ops: upsert, delete) → apiClient /push
- [ ] use-ewelink.ts (2 ops: domotic_actions insert, domotic_devices upsert) → apiClient /ewelink
- [ ] use-realtime-events.ts (1 op: tenants settings select) → apiClient

---

## Edge Functions (MUST MIGRATE)

- [ ] services/api.ts — 15+ API methods via Edge Functions → apiClient direct
- [ ] services/integrations/voip.ts — BACKEND_BASE → apiClient
- [ ] services/integrations/elevenlabs.ts — BACKEND_BASE → apiClient
- [ ] pages/AIAssistantPage.tsx — CHAT_URL → apiClient
- [ ] pages/ReportsPage.tsx — reports-pdf URL → apiClient

---

## supabase.auth.getSession() for Token (KEEP)

These files call supabase.auth.getSession() only to get the Bearer token for API calls.
This is the SAME pattern apiClient uses. These are candidates for migration to apiClient.

- services/reboots-api.ts
- services/alerts-api.ts
- services/analytics-api.ts
- services/shifts-api.ts
- services/patrols-api.ts
- services/compliance-api.ts
- services/keys-api.ts
- services/contracts-api.ts
- services/automation-api.ts
- services/scheduled-reports-api.ts
- services/emergency-api.ts
- services/training-api.ts
- services/sla-api.ts
- services/visitors-api.ts

All of these follow the pattern: get token → call VITE_API_URL. They should use apiClient instead.

---

## supabase.auth.* Core Auth (KEEP per ADR-001)

- AuthContext.tsx — signIn, signUp, signOut, resetPassword, updatePassword, onAuthStateChange
- lib/api-client.ts — getSession (for token injection), refreshSession (for 401 retry)

These are intentionally kept on Supabase per ADR-001.

---

## supabase.storage (EVALUATE)

- DocumentsPage.tsx — upload, remove, download from 'documents' bucket
- Decision: Keep for now, add backend proxy endpoint later if needed
