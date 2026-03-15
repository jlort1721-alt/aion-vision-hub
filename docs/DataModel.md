# AION Vision Hub — Data Model

## Entity Relationship Overview

```
tenants 1──N sites 1──N devices 1──N streams
   │              │         │
   │              │         └──N events
   │              │               │
   │              └───────────N incidents
   │
   ├──N profiles (users)
   ├──N user_roles
   ├──N integrations
   ├──N mcp_connectors
   ├──N audit_logs
   ├──N ai_sessions
   └──N feature_flags (global)
```

## Tables

### Core
| Table | Purpose | RLS |
|-------|---------|-----|
| `tenants` | Organizations / companies | Users see own tenant |
| `profiles` | User profile data | Tenant-scoped SELECT, own UPDATE |
| `user_roles` | RBAC assignments (enum: super_admin, tenant_admin, operator, viewer, auditor) | Tenant-scoped SELECT |

### Infrastructure
| Table | Purpose | RLS |
|-------|---------|-----|
| `sites` | Physical locations | Tenant-scoped; admins manage |
| `device_groups` | Logical device groupings | Tenant-scoped; admins manage |
| `devices` | Cameras, NVRs, encoders | Tenant-scoped; admins manage |
| `streams` | RTSP/ONVIF stream configs | Via device tenant check |

### Operations
| Table | Purpose | RLS |
|-------|---------|-----|
| `events` | Alerts, alarms, smart events | Tenant-scoped full access |
| `incidents` | Investigation cases | Tenant-scoped full access |
| `playback_requests` | Video export jobs | Tenant-scoped; user creates own |

### Platform
| Table | Purpose | RLS |
|-------|---------|-----|
| `integrations` | External service configs | Tenant-scoped; admins manage |
| `mcp_connectors` | MCP protocol connectors | Tenant-scoped; admins manage |
| `ai_sessions` | AI chat history | User sees own |
| `audit_logs` | Activity trail | Admins/auditors only |
| `feature_flags` | Feature toggles | Public read |

## Security Functions

- `has_role(user_id, role)` — SECURITY DEFINER, checks user_roles
- `get_user_tenant_id(user_id)` — SECURITY DEFINER, returns tenant_id from profiles
- `handle_new_user()` — Trigger on auth.users INSERT, creates profile + default role

## Multi-Tenant Isolation

Every data table includes `tenant_id`. RLS policies use `get_user_tenant_id(auth.uid())` to enforce isolation. No cross-tenant data access is possible.
