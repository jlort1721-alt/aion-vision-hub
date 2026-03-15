# AION Vision Hub — Database Configuration Report

**Date:** 2026-03-15
**PROMPT:** 2 of 10 — Supabase & Database Configuration
**Status:** COMPLETADO

---

## 1. SUPABASE PROJECT

| Item | Value |
|------|-------|
| Project Name | clave-demo |
| Project Ref | `oeplpbfikcrcvccimjki` |
| Region | West US (Oregon) |
| URL | `https://oeplpbfikcrcvccimjki.supabase.co` |
| REST API | OK (verified) |
| CLI Linked | OK |

## 2. MIGRATIONS

All 9 migrations applied successfully:

| Migration | Status | Description |
|-----------|--------|-------------|
| 20260307233550 | [OK] | Complete database schema (tenants, profiles, devices, events, etc.) |
| 20260307234625 | [OK] | Schema patch |
| 20260308001901 | [OK] | Schema update |
| 20260308002128 | [OK] | Schema update |
| 20260308005018 | [OK] | Role module permissions table |
| 20260308023052 | [OK] | Domotic, access control, intercom tables |
| 20260308040000 | [OK] | WhatsApp tables (wa_conversations, wa_messages, wa_templates) |
| 20260309010000 | [OK] | WhatsApp security hardening |
| 20260314000000 | [OK] | Production indexes (35+) + auto-vacuum tuning |

### Migration Fix Applied
- `CREATE INDEX CONCURRENTLY` changed to `CREATE INDEX` (can't run inside Supabase transaction)
- Column `last_seen_at` fixed to `last_seen` (actual column name in devices table)
- Removed indexes for non-existent tables: `call_sessions`, `reports`

## 3. DATABASE TABLES (31 total)

| Table | RLS | Description |
|-------|-----|-------------|
| tenants | ON | Multi-tenant organizations |
| profiles | ON | User profiles linked to auth.users |
| user_roles | ON | RBAC roles (super_admin, tenant_admin, operator, viewer, auditor) |
| sites | ON | Physical locations |
| device_groups | ON | Logical groupings of devices |
| devices | ON | IP cameras and surveillance devices |
| streams | ON | RTSP/WebRTC video streams per device |
| events | ON | Security events and alerts |
| incidents | ON | Incident tracking |
| audit_logs | ON | Mutation audit trail |
| integrations | ON | Third-party integrations |
| mcp_connectors | ON | MCP (Model Context Protocol) connectors |
| ai_sessions | ON | AI assistant conversation sessions |
| feature_flags | ON | System-wide feature toggles |
| playback_requests | ON | Video playback requests |
| live_view_layouts | ON | Custom camera grid layouts |
| push_subscriptions | ON | Web push notification subscriptions |
| sections | ON | Access control zones |
| access_people | ON | Access-controlled persons |
| access_vehicles | ON | Registered vehicles |
| access_logs | ON | Entry/exit logs |
| domotic_devices | ON | Smart home devices (eWeLink/Sonoff) |
| domotic_actions | ON | Domotic action history |
| reboot_tasks | ON | Device reboot scheduling |
| intercom_devices | ON | SIP/VoIP intercom devices |
| intercom_calls | ON | Intercom call history |
| database_records | ON | Generic database records |
| role_module_permissions | ON | Role-to-module access mapping |
| wa_conversations | ON | WhatsApp conversations |
| wa_messages | ON | WhatsApp messages |
| wa_templates | ON | WhatsApp message templates |

## 4. ROW LEVEL SECURITY (RLS)

All 31 tables have RLS enabled. Key policies:
- **Tenant isolation**: All queries scoped via `get_user_tenant_id(auth.uid())`
- **Role-based access**: Admin operations require `has_role()` check
- **Auto-provisioning**: `handle_new_user()` trigger creates profile + default role on signup

## 5. SEED DATA

| Entity | Count | Details |
|--------|-------|---------|
| Tenants | 1 | "AION Main" (slug: default, timezone: America/Bogota) |
| Sites | 2 | Sede Principal, Sede Norte |
| Sections | 3 | Entrada Principal, Parqueadero, Area Restringida |
| Device Groups | 2 | Camaras Exteriores, Camaras Interiores |
| Feature Flags | 10 | All modules enabled (AI, voice, WhatsApp, domotic, etc.) |
| Role Permissions | 37 | All 5 roles configured across all modules |

## 6. ENVIRONMENT FILES CONFIGURED

| File | Status | Key Variables |
|------|--------|---------------|
| `.env` (frontend) | [OK] | VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY |
| `backend/.env` | [OK] | DATABASE_URL (pooler), JWT_SECRET, CREDENTIAL_ENCRYPTION_KEY |
| `gateway/.env` | [OK] | SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET |

### Generated Secrets

- **JWT_SECRET**: 64-char hex (shared across backend + gateway)
- **CREDENTIAL_ENCRYPTION_KEY**: 64-char hex (AES-256-GCM)

## 7. DB CONNECTION VERIFIED

- **Connection**: Supabase Transaction Pooler (aws-0-us-west-2)
- **Tables**: 31 confirmed
- **RLS**: 31/31 tables enabled
- **Indexes**: 91 total (includes 35+ production indexes)
- **Seed data**: All verified (1 tenant, 2 sites, 3 sections, 10 flags, 37 permissions)

## 8. NEXT STEPS (PROMPT 3)

1. Proceed to PROMPT 3: VPS Infrastructure Setup
   - Choose VPS provider (Hetzner/DigitalOcean/Contabo)
   - Install Docker + Docker Compose
   - Configure Nginx reverse proxy with SSL
   - Deploy backend + gateway + MediaMTX containers
