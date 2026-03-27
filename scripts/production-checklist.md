# AION Vision Hub — Production Deployment Checklist

## Pre-Deployment

### Credentials Required (provide to Claude when ready)

**Infrastructure:**
- [ ] VPS IP address and SSH access (user + SSH key)
- [ ] Domain name (e.g., `app.claveseguridad.com`)
- [ ] Cloudflare account (if using) or DNS provider

**Supabase:**
- [ ] Supabase project URL: `https://xxxx.supabase.co`
- [ ] Supabase Anon Key (public)
- [ ] Supabase Service Role Key (for admin operations)

**GitHub:**
- [ ] GitHub repository URL
- [ ] GitHub token with packages:write permission (for GHCR)

**Email Provider (pick one):**
- [ ] Resend API Key, OR
- [ ] SendGrid API Key, OR
- [ ] SMTP credentials (host, port, user, password)
- [ ] From email address

**WhatsApp (optional):**
- [ ] Meta Business Account ID
- [ ] Phone Number ID
- [ ] Access Token
- [ ] App Secret (for webhook verification)

**AI Providers (optional):**
- [ ] OpenAI API Key
- [ ] Anthropic API Key
- [ ] ElevenLabs API Key

**IoT / Smart Home (optional):**
- [ ] eWeLink App ID + Secret
- [ ] SIP/VoIP server details (Asterisk ARI)

---

## Deployment Steps

### 1. VPS Setup
```bash
# On fresh Ubuntu 22.04+ VPS:
bash scripts/vps-setup.sh
```

### 2. Configure Environment
```bash
nano /opt/aion/app/backend/.env.docker
# Fill in all credentials
```

### 3. Copy Deployment Files
```bash
# From your local machine:
scp backend/docker-compose.prod.yml user@vps:/opt/aion/app/backend/
scp -r backend/caddy/ user@vps:/opt/aion/app/backend/
scp -r backend/pgbouncer/ user@vps:/opt/aion/app/backend/
```

### 4. Configure DNS
- A record: `app.yourdomain.com` → VPS IP
- A record: `api.yourdomain.com` → VPS IP (optional)
- A record: `gw.yourdomain.com` → VPS IP (optional)

### 5. Start Services
```bash
cd /opt/aion/app/backend
docker compose -f docker-compose.prod.yml --env-file .env.docker up -d
```

### 6. Verify Health
```bash
curl https://app.yourdomain.com/health
curl https://app.yourdomain.com/api/health
```

### 7. Run Database Migrations
Apply Supabase migrations to the production Supabase project.

### 8. Configure GitHub Secrets
In GitHub repo Settings → Secrets and variables:

**Secrets:**
- `PRODUCTION_SSH_KEY` — SSH private key for VPS
- `PRODUCTION_SSH_HOST` — VPS IP or hostname
- `PRODUCTION_SSH_USER` — SSH username
- `PRODUCTION_SUPABASE_URL` — Supabase project URL
- `PRODUCTION_SUPABASE_ANON_KEY` — Supabase public key

**Variables:**
- `PRODUCTION_URL` — `https://app.yourdomain.com`
- `PRODUCTION_API_URL` — `https://app.yourdomain.com/api`
- `PRODUCTION_GATEWAY_URL` — `https://app.yourdomain.com/gateway`

---

## Post-Deployment Verification

- [ ] Frontend loads at `https://app.yourdomain.com`
- [ ] Login works with Supabase Auth
- [ ] Dashboard shows device data
- [ ] Live View streams working
- [ ] Events received in real-time
- [ ] WhatsApp notifications sent (if configured)
- [ ] Email notifications sent (if configured)
- [ ] Automated backups running (check cron)
- [ ] SSL certificate valid (check with browser)
- [ ] Health checks passing
- [ ] Audit logs recording actions
