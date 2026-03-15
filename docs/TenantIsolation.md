# AION Vision Hub — Tenant Isolation Review

## Last Updated: 2026-03-08

---

## Architecture Overview

AION Vision Hub implements **database-level multi-tenant isolation** using PostgreSQL Row Level Security (RLS) policies enforced through Supabase. Every data table includes a `tenant_id` column and RLS policies that restrict access to rows belonging to the authenticated user's tenant.

## Isolation Mechanism

### Core Function: `get_user_tenant_id()`

A **security definer** PostgreSQL function that resolves the tenant ID for a given user:

```sql
CREATE OR REPLACE FUNCTION get_user_tenant_id(_user_id UUID)
RETURNS UUID AS $$
  SELECT tenant_id FROM user_roles WHERE user_id = _user_id LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

- Runs with elevated privileges (SECURITY DEFINER) to avoid RLS recursion
- Used in every RLS policy as the tenant filter
- Called via `auth.uid()` to resolve the current user's tenant

### Core Function: `has_role()`

A **security definer** function for role-based access checks:

```sql
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role);
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

## RLS Policy Pattern

Every table follows a consistent pattern:

```sql
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- Read: all tenant members can see
CREATE POLICY "Tenant sees <table>" ON public.<table_name>
  FOR SELECT USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Write: role-restricted (admin/operator)
CREATE POLICY "Admins manage <table>" ON public.<table_name>
  FOR ALL USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND (
      has_role(auth.uid(), 'tenant_admin')
      OR has_role(auth.uid(), 'super_admin')
      OR has_role(auth.uid(), 'operator')
    )
  );
```

## Tables with RLS

All 25+ tables have RLS enabled and tenant isolation enforced:

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| tenants | Tenant members | super_admin | tenant_admin+ | super_admin |
| profiles | Tenant members | Self | Self | — |
| user_roles | Tenant members | Admin | Admin | super_admin |
| devices | Tenant members | Operator+ | Operator+ | Admin |
| events | Tenant members | System | Operator+ | — |
| incidents | Tenant members | Operator+ | Operator+ | Admin |
| sections | Tenant members | Admin | Admin | Admin |
| sites | Tenant members | Admin | Admin | Admin |
| domotic_devices | Tenant members | Operator+ | Operator+ | Admin |
| domotic_actions | Tenant members | All | — | — |
| access_people | Tenant members | Operator+ | Operator+ | Operator+ |
| access_vehicles | Tenant members | Operator+ | Operator+ | Operator+ |
| access_logs | Tenant members | Operator+ | — | — |
| reboot_tasks | Tenant members | Operator+ | Operator+ | Admin |
| intercom_devices | Tenant members | Admin | Admin | Admin |
| intercom_calls | Tenant members | Operator+ | — | — |
| database_records | Tenant members | Operator+ | Operator+ | Admin |
| mcp_connectors | Tenant members | Admin | Admin | Admin |
| integrations | Tenant members | Operator+ | Operator+ | Admin |
| audit_logs | Tenant members | System | — | — |
| notification_preferences | Self | Self | Self | — |
| ai_sessions | Self | Self | — | — |
| role_module_permissions | Admin | super_admin | super_admin | super_admin |

## Edge Function Isolation

All 11 edge functions create a Supabase client using the **user's JWT token**, which means RLS policies apply automatically:

```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } }
});
```

### Additional Enforcement

- **admin-users**: Verifies tenant ownership before modifying user roles (prevents cross-tenant privilege escalation)
- **devices-api / mcp-api / integrations-api**: Inject `tenant_id` from `get_user_tenant_id()` on create operations (cannot be set by the client)
- **event-alerts**: Uses service role key but scopes queries to the event's tenant

## Frontend Tenant Context

The frontend resolves tenant context from the authenticated user's profile:
- `useAuth()` hook provides the current user's profile including tenant_id
- All Supabase queries from the frontend use the user's session token
- No tenant_id is ever passed from the frontend to bypass RLS

## Cross-Tenant Attack Vectors — Mitigated

| Attack Vector | Mitigation |
|---------------|-----------|
| Direct API with different tenant_id | RLS rejects — query returns 0 rows |
| Spoofed tenant_id in POST body | Edge functions ignore client-provided tenant_id, use `get_user_tenant_id()` |
| JWT from different tenant | RLS policies compare against token's user_id |
| Admin modifying user in other tenant | admin-users validates tenant ownership |
| Service role bypass | Only used in admin-users (invite) and event-alerts (internal POST) |

## Recommendations

1. Add tenant_id assertion in edge functions for defense-in-depth (verify RPC result matches expected tenant)
2. Add periodic audit query: `SELECT * FROM audit_logs WHERE tenant_id NOT IN (SELECT id FROM tenants)` to detect orphaned data
3. Implement tenant-scoped API keys for external integrations
4. Add tenant quota limits (max devices, max users, max storage)
