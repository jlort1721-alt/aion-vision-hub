# Credentials Checklist — AION Vision Hub

> **Updated:** 2026-03-08 (CI/CD pipeline + eWeLink security hardening)
> Complete this checklist before any deployment.

---

## CI/CD Secrets (GitHub Actions)

Configure in **GitHub → Settings → Secrets and variables → Actions**.

### Auto-Provided

| Secret | Notes |
|--------|-------|
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions — enables GHCR push, release creation |

### Staging Deploy

| Secret | Required | How to Obtain |
|--------|----------|---------------|
| `STAGING_SUPABASE_URL` | Yes | Supabase dashboard → Settings → API |
| `STAGING_SUPABASE_ANON_KEY` | Yes | Supabase dashboard → Settings → API |
| `STAGING_SSH_HOST` | If VPS deploy | Your staging server IP/hostname |
| `STAGING_SSH_USER` | If VPS deploy | SSH user on staging server |
| `STAGING_SSH_KEY` | If VPS deploy | `ssh-keygen -t ed25519` → add public key to server |

### Production Deploy

| Secret | Required | How to Obtain |
|--------|----------|---------------|
| `PRODUCTION_SUPABASE_URL` | Yes | Supabase dashboard → Settings → API |
| `PRODUCTION_SUPABASE_ANON_KEY` | Yes | Supabase dashboard → Settings → API |

### Optional (depends on hosting provider)

| Secret | When Needed |
|--------|-------------|
| `VERCEL_TOKEN` | If using Vercel for frontend |
| `VERCEL_ORG_ID` | If using Vercel for frontend |
| `VERCEL_PROJECT_ID` | If using Vercel for frontend |

### GitHub Environment Variables

Configure in **Settings → Environments → [staging/production] → Variables**:

| Variable | Environment | Description |
|----------|-------------|-------------|
| `STAGING_URL` | staging | Staging frontend URL |
| `STAGING_API_URL` | staging | Staging backend API URL (for smoke tests) |
| `STAGING_GATEWAY_URL` | staging | Staging gateway URL (for smoke tests) |
| `PRODUCTION_URL` | production | Production frontend URL |
| `PRODUCTION_API_URL` | production | Production backend API URL |
| `PRODUCTION_GATEWAY_URL` | production | Production gateway URL |

---

## Backend Credentials (backend/.env)

| Credential | Required | How to Obtain | Rotation |
|---|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string | Rotate password periodically |
| `JWT_SECRET` | Yes | `openssl rand -hex 32` | Rotate with coordinated service restart |
| `CREDENTIAL_ENCRYPTION_KEY` | Yes (prod) | `openssl rand -hex 16` (32 chars) | Requires re-encryption of stored tokens |
| `EWELINK_APP_ID` | Yes (if eWeLink used) | [dev.ewelink.cc](https://dev.ewelink.cc) -> Create Application | Regenerate in eWeLink portal |
| `EWELINK_APP_SECRET` | Yes (if eWeLink used) | Same portal -> Application Credentials | Regenerate in eWeLink portal |
| `EWELINK_REGION` | No (default: us) | Match your eWeLink account region | N/A |
| `OPENAI_API_KEY` | Optional | [platform.openai.com](https://platform.openai.com) | Rotate in OpenAI dashboard |
| `ANTHROPIC_API_KEY` | Optional | [console.anthropic.com](https://console.anthropic.com) | Rotate in Anthropic console |
| `ELEVENLABS_API_KEY` | Optional | [elevenlabs.io](https://elevenlabs.io/settings/api-keys) | Rotate in ElevenLabs dashboard |
| `RESEND_API_KEY` | Optional | [resend.com](https://resend.com) | Rotate in Resend dashboard |
| `SENDGRID_API_KEY` | Optional | [sendgrid.com](https://sendgrid.com) | Rotate in SendGrid dashboard |
| `WHATSAPP_ACCESS_TOKEN` | Optional | Meta Business Suite | 60-day system user tokens |
| `WHATSAPP_APP_SECRET` | Yes (prod, if WA used) | Meta App Dashboard | Rotate in Meta portal |
| `SIP_ARI_PASSWORD` | Optional | Asterisk ARI config | Rotate in Asterisk config |
| `FANVIL_ADMIN_PASSWORD` | Optional | Fanvil device admin | Change on device |

## Frontend Variables (frontend .env)

| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Public endpoint (safe for frontend) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Anon key (scoped by RLS policies) |
| `VITE_API_URL` | Yes | Backend API URL (e.g., http://localhost:3000) |

## REMOVED Variables (no longer exist)

| Variable | Status | Reason |
|---|---|---|
| `VITE_EWELINK_APP_ID` | **REMOVED** | Moved to backend; never needed in frontend |
| `VITE_EWELINK_APP_SECRET` | **REMOVED** | Moved to backend; never needed in frontend |
| `VITE_EWELINK_REGION` | **REMOVED** | Moved to backend; never needed in frontend |

## DEPRECATED Variables (should not be set)

| Variable | Status | Reason |
|---|---|---|
| `VITE_WHATSAPP_PHONE_NUMBER_ID` | DEPRECATED | Configure via UI or backend DB |
| `VITE_WHATSAPP_ACCESS_TOKEN` | DEPRECATED | Configure via UI or backend DB |
| `VITE_WHATSAPP_BUSINESS_ID` | DEPRECATED | Configure via UI or backend DB |
| `VITE_ELEVENLABS_API_KEY` | DEPRECATED | Fallback only; primary in backend |

---

## Pre-Deployment Checklist

- [ ] `JWT_SECRET` is unique and >= 32 characters
- [ ] `CREDENTIAL_ENCRYPTION_KEY` is set (required in production)
- [ ] `EWELINK_APP_SECRET` is NOT in any frontend env file
- [ ] No `VITE_EWELINK_*` variables exist in any `.env` or `.env.local`
- [ ] `WHATSAPP_APP_SECRET` is set if WhatsApp is used in production
- [ ] `.env` files are in `.gitignore`
- [ ] No real credentials in `.env.example` files
