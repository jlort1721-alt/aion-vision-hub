# AION Vision Hub — Security

## Authentication

- Supabase Auth with email/password and Google OAuth
- Password reset flow via email
- Session management with automatic token refresh
- Protected routes via `ProtectedRoute` component

## Authorization (RBAC)

### Roles
| Role | Scope |
|------|-------|
| `super_admin` | Full platform access |
| `tenant_admin` | Full tenant management |
| `operator` | Device ops, events, incidents |
| `viewer` | Read-only access |
| `auditor` | Read + audit log access |

### Implementation
- Roles stored in `user_roles` table (not in profiles — prevents privilege escalation)
- `has_role()` SECURITY DEFINER function bypasses RLS safely
- `get_user_tenant_id()` SECURITY DEFINER for tenant isolation
- RLS policies on every table enforce tenant boundaries

## Row-Level Security

All tables have RLS enabled. Policies use security definer functions to avoid recursive checks.

### Policy Pattern
```sql
-- Read: tenant-scoped
USING (tenant_id = get_user_tenant_id(auth.uid()))

-- Write: tenant-scoped + role check
USING (
  tenant_id = get_user_tenant_id(auth.uid()) 
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
)
```

## Secrets Management

- API keys stored as Supabase secrets (never in frontend code)
- Edge functions access secrets via `Deno.env.get()`
- Publishable keys (anon key) are the only keys in client code
- Device credentials are referenced by ID, never stored in frontend

## Frontend Security

- No `dangerouslySetInnerHTML` usage
- Input validation with length limits
- CORS headers on all edge functions
- JWT verification in edge functions
- No raw SQL execution — all queries through typed Supabase client

## Multi-Tenant Isolation

- Every data row includes `tenant_id`
- RLS ensures no cross-tenant data access
- New user trigger auto-assigns to default tenant
- Tenant switch requires re-authentication
