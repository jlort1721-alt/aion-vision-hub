# AION Vision Hub — Tenant Configuration Report

**Date:** 2026-03-15
**PROMPT:** 5 of 10 — Initial Tenant & Admin Configuration
**Status:** COMPLETADO

---

## 1. DEFAULT TENANT (Pre-seeded)

| Item | Value |
|------|-------|
| Tenant Name | AION Main |
| Tenant ID | `a0000000-0000-0000-0000-000000000001` |
| Slug | `default` |
| Timezone | America/Bogota |
| Language | es |
| Theme | dark |
| Max Devices | 500 |

## 2. SITES (Pre-seeded)

| Site | Address | Status |
|------|---------|--------|
| Sede Principal | Bogota, Colombia | active |
| Sede Norte | Bogota Norte, Colombia | active |

## 3. SECTIONS (Pre-seeded)

| Section | Type | Description |
|---------|------|-------------|
| Entrada Principal | entry | Punto de acceso principal del edificio |
| Parqueadero | parking | Area de estacionamiento |
| Area Restringida | restricted | Zona de acceso controlado |

## 4. FEATURE FLAGS (Pre-seeded)

| Feature | Status |
|---------|--------|
| AI Assistant | Enabled |
| Voice Intercom | Enabled |
| WhatsApp Notifications | Enabled |
| Domotic Control | Enabled |
| Access Control | Enabled |
| Email Notifications | Enabled |
| Video Playback | Enabled |
| MCP Connectors | Enabled |
| Live View | Enabled |
| Reports | Enabled |

## 5. ROLE PERMISSIONS (Pre-seeded — 37 entries)

| Role | Modules |
|------|---------|
| super_admin | ALL (10 modules) |
| tenant_admin | ALL (10 modules) |
| operator | dashboard, devices, events, access, domotics, intercom, whatsapp, reports |
| viewer | dashboard, devices, events, access, reports |
| auditor | dashboard, audit, events, reports |

## 6. SUPABASE AUTH

| Setting | Value |
|---------|-------|
| Email/Password | Enabled |
| Signup | Enabled |
| Email auto-confirm | Disabled (requires email verification) |
| External providers | None (email only) |

## 7. ADMIN SETUP INSTRUCTIONS

### Step 1: Register Admin User
1. Open `http://204.168.153.166/` in your browser
2. Click "Create account" / "Sign up"
3. Enter email and password
4. Check email for confirmation link and confirm

### Step 2: Promote to Super Admin
1. Go to Supabase Dashboard → Authentication → Users
2. Find the registered user and copy their UUID
3. Go to SQL Editor and run the script below (replacing `USER_UUID_HERE`):

```sql
-- File: /scripts/promote-admin.sql
-- Replace USER_UUID_HERE with the actual user UUID from Supabase Auth
DO $$
DECLARE
  v_user_id uuid := 'USER_UUID_HERE';
  v_tenant_id uuid := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  -- Link profile to tenant
  UPDATE public.profiles SET tenant_id = v_tenant_id WHERE id = v_user_id;
  -- Assign super_admin role
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (v_user_id, v_tenant_id, 'super_admin');
  RAISE NOTICE 'User % promoted to super_admin', v_user_id;
END $$;
```

### Step 3: Login and Verify
1. Login at `http://204.168.153.166/`
2. Dashboard should show tenant data
3. Navigate all modules to verify access

## 8. ADDITIONAL USERS

| Role | How to Create |
|------|---------------|
| tenant_admin | Register → promote via SQL (role = 'tenant_admin') |
| operator | Register → promote via SQL (role = 'operator') |
| viewer | Register → promote via SQL (role = 'viewer') |
| auditor | Register → promote via SQL (role = 'auditor') |

## 9. SYSTEM ACCESS URLS

| Service | URL |
|---------|-----|
| Frontend App | `http://204.168.153.166/` |
| Backend API | `http://204.168.153.166/api/health` |
| Edge Gateway | `http://204.168.153.166/gw/health` |
| Supabase Dashboard | `https://supabase.com/dashboard/project/oeplpbfikcrcvccimjki` |

## 10. NEXT STEPS (PROMPT 6)

1. Register admin user and promote to super_admin
2. Provide camera IPs and credentials for device registration
3. Configure network connectivity (VPN if cameras are on separate network)
4. Register devices via Edge Gateway API
5. Validate live video streaming
