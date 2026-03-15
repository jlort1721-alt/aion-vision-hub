# AION Vision Hub — Secrets & Environment Variables

## Last Updated: 2026-03-08

---

## Frontend Variables (Vite — `VITE_` prefix)

These are **public** values embedded in the JavaScript bundle. Never put secrets here.

| Variable | Purpose | Sensitive |
|----------|---------|-----------|
| `VITE_SUPABASE_URL` | Supabase project URL | No (public endpoint) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key | No (by design — RLS enforces security) |

### Usage in Code

- `src/integrations/supabase/client.ts` — creates Supabase client
- `src/services/api.ts` — constructs edge function base URL and API key header
- `src/pages/AIAssistantPage.tsx` — constructs AI chat edge function URL
- `src/pages/ReportsPage.tsx` — constructs reports-pdf edge function URL

### Security Notes

- The publishable key only grants access subject to RLS policies
- All sensitive operations go through edge functions which use server-side keys
- No AI API keys, service role keys, or passwords in frontend code

---

## Edge Function Variables (Deno — `Deno.env.get()`)

These are **server-side secrets** configured in Supabase Dashboard → Edge Functions → Secrets.

| Variable | Purpose | Used By | Classification |
|----------|---------|---------|---------------|
| `SUPABASE_URL` | Supabase project URL | All 11 functions | Internal |
| `SUPABASE_ANON_KEY` | Publishable key for RLS-scoped queries | All 11 functions | Internal |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key — bypasses RLS | admin-users, event-alerts | **SECRET** |
| `LOVABLE_API_KEY` | Lovable AI gateway key | ai-chat, events-api, incidents-api, health-api | **SECRET** |
| `OPENAI_API_KEY` | OpenAI API key | ai-chat | **SECRET** |
| `ANTHROPIC_API_KEY` | Anthropic API key | ai-chat | **SECRET** |

### Service Role Key Usage — Justified

The `SUPABASE_SERVICE_ROLE_KEY` is used in only 2 functions:

1. **admin-users**: Required to create new auth users via `supabase.auth.admin.createUser()`. This is the only way to programmatically invite users.
2. **event-alerts**: Internal POST handler that processes device events without a user session. The GET handler uses the user's JWT.

All other functions use the anon key + user JWT, meaning RLS applies.

---

## Gateway Variables (Node.js — `.env`)

See `gateway/.env.example` for the complete template.

| Variable | Purpose | Classification |
|----------|---------|---------------|
| `PORT` | Gateway HTTP port | Config |
| `SUPABASE_URL` | For syncing device state | Internal |
| `SUPABASE_SERVICE_KEY` | Service role key for DB sync | **SECRET** |
| `JWT_SECRET` | Must match Supabase JWT secret | **SECRET** |
| `CORS_ORIGINS` | Allowed frontend origins | Config |
| `MEDIAMTX_API_URL` | MediaMTX stream proxy URL | Internal |
| `DEVICE_CONNECT_TIMEOUT_MS` | Device connection timeout | Config |
| `DISCOVERY_NETWORK_RANGE` | Network range for device discovery | Config |

---

## Environment Configuration

### Local Development

```bash
# Frontend (root .env or .env.local)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...anon-key...

# Gateway (gateway/.env)
# See gateway/.env.example
```

### Production

- **Frontend**: Variables set in Lovable dashboard or CI/CD pipeline
- **Edge Functions**: Variables set in Supabase Dashboard → Project Settings → Edge Functions → Secrets
- **Gateway**: Variables set in Docker/Kubernetes secrets or `.env` file

---

## Security Checklist

- [x] No API keys in frontend code (only publishable/anon key)
- [x] AI provider keys only in edge functions (server-side)
- [x] Service role key limited to 2 justified functions
- [x] No hardcoded credentials anywhere in codebase
- [x] `.env` files excluded from version control (`.gitignore`)
- [x] Edge function secrets configured in Supabase Dashboard
- [ ] API key rotation schedule (recommended: quarterly)
- [ ] Separate secrets per environment (dev/staging/prod)
- [ ] Secret scanning in CI pipeline (e.g., GitGuardian, trufflehog)

---

## .env.example (Frontend)

```bash
# AION Vision Hub — Frontend Environment Variables
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...your-anon-key...
```
