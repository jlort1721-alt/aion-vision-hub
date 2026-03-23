#!/usr/bin/env bash
# ==========================================================
# Clave Seguridad — Production Secrets Generator
# ==========================================================
# Usage: bash scripts/generate-production-secrets.sh
#
# Generates all required secrets for production deployment
# and validates the .env.docker file is complete.
#
# Output: .env.docker (production-ready, gitignored)
# ==========================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

info()  { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[FAIL]${NC}  $1"; }
header() { echo -e "\n${CYAN}${BOLD}═══ $1 ═══${NC}"; }

ENV_FILE=".env.docker"
FAILED=0

# ── Step 1: Generate cryptographic secrets ──────────────────

header "Generating Production Secrets"

JWT_SECRET=$(openssl rand -base64 48 2>/dev/null || head -c 48 /dev/urandom | base64)
ENCRYPTION_KEY=$(openssl rand -hex 24 2>/dev/null || head -c 24 /dev/urandom | xxd -p)
DB_PASSWORD=$(openssl rand -base64 32 2>/dev/null | tr -d '/+=' | head -c 32 || head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 32)

info "JWT_SECRET generated (${#JWT_SECRET} chars)"
info "CREDENTIAL_ENCRYPTION_KEY generated (${#ENCRYPTION_KEY} chars)"
info "DB_PASSWORD generated (${#DB_PASSWORD} chars)"

# ── Step 2: Create .env.docker ──────────────────────────────

header "Creating $ENV_FILE"

if [ -f "$ENV_FILE" ]; then
  BACKUP="${ENV_FILE}.bak.$(date +%s)"
  cp "$ENV_FILE" "$BACKUP"
  warn "Existing $ENV_FILE backed up to $BACKUP"
fi

cat > "$ENV_FILE" << EOF
# ==========================================================
# Clave Seguridad — Production Environment
# Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# ==========================================================
# IMPORTANT: This file contains secrets. Do NOT commit to git.

# ── Database ──────────────────────────────────────────────
DB_USER=clave
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=clave_db
DB_PORT=5432

# ── Authentication ────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}

# ── Encryption ────────────────────────────────────────────
CREDENTIAL_ENCRYPTION_KEY=${ENCRYPTION_KEY}

# ── Network ───────────────────────────────────────────────
FRONTEND_PORT=8080
BACKEND_PORT=3000

# ── CORS (REQUIRED: replace with your production domain) ──
CORS_ORIGINS=https://YOUR_DOMAIN_HERE

# ── Optional: Email Provider (uncomment one) ──────────────
# RESEND_API_KEY=re_xxxxxxxxxxxx
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=

# ── Optional: WhatsApp Cloud API ──────────────────────────
# WHATSAPP_PHONE_NUMBER_ID=
# WHATSAPP_ACCESS_TOKEN=

# ── Optional: AI Providers ────────────────────────────────
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
EOF

info "$ENV_FILE created"

# ── Step 3: Validate secrets meet minimum requirements ──────

header "Validating Secrets"

# JWT_SECRET: minimum 32 characters
if [ ${#JWT_SECRET} -ge 32 ]; then
  info "JWT_SECRET length: ${#JWT_SECRET} chars (min 32)"
else
  error "JWT_SECRET too short: ${#JWT_SECRET} chars (need 32+)"
  FAILED=$((FAILED + 1))
fi

# CREDENTIAL_ENCRYPTION_KEY: minimum 32 characters
if [ ${#ENCRYPTION_KEY} -ge 32 ]; then
  info "CREDENTIAL_ENCRYPTION_KEY length: ${#ENCRYPTION_KEY} chars (min 32)"
else
  error "CREDENTIAL_ENCRYPTION_KEY too short: ${#ENCRYPTION_KEY} chars (need 32+)"
  FAILED=$((FAILED + 1))
fi

# DB_PASSWORD: minimum 16 characters
if [ ${#DB_PASSWORD} -ge 16 ]; then
  info "DB_PASSWORD length: ${#DB_PASSWORD} chars (min 16)"
else
  error "DB_PASSWORD too short: ${#DB_PASSWORD} chars (need 16+)"
  FAILED=$((FAILED + 1))
fi

# ── Step 4: Check for placeholder values ────────────────────

header "Pre-deploy Checklist"

if grep -q "YOUR_DOMAIN_HERE" "$ENV_FILE"; then
  warn "CORS_ORIGINS still has placeholder — update before deploy"
else
  info "CORS_ORIGINS configured"
fi

# Check .gitignore includes .env.docker
if [ -f ".gitignore" ] && grep -q "\.env\.docker" ".gitignore"; then
  info ".env.docker is in .gitignore"
else
  warn ".env.docker is NOT in .gitignore — add it before committing!"
fi

# Check TLS certs directory
if [ -d "/etc/nginx/ssl" ] || [ -d "./ssl" ]; then
  info "TLS certificate directory found"
else
  warn "No TLS cert directory found — create /etc/nginx/ssl/ and add fullchain.pem + privkey.pem"
fi

# Check Docker
if command -v docker &> /dev/null; then
  info "Docker installed: $(docker --version | head -c 40)"
else
  error "Docker not found — required for deployment"
  FAILED=$((FAILED + 1))
fi

# Check Docker Compose
if docker compose version &> /dev/null 2>&1; then
  info "Docker Compose available"
elif command -v docker-compose &> /dev/null; then
  info "docker-compose (legacy) available"
else
  error "Docker Compose not found"
  FAILED=$((FAILED + 1))
fi

# ── Summary ─────────────────────────────────────────────────

header "Summary"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}${BOLD}All checks passed.${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Edit $ENV_FILE — set CORS_ORIGINS to your production domain"
  echo "  2. Set up TLS certs (see nginx.conf for Let's Encrypt instructions)"
  echo "  3. Uncomment the TLS server block in nginx.conf"
  echo "  4. Uncomment the HTTP→HTTPS redirect in nginx.conf"
  echo "  5. Run: docker compose --env-file .env.docker up -d --build"
  echo "  6. Verify: curl -f http://localhost:3000/health"
  echo ""
  echo -e "${YELLOW}REMINDER: Never commit $ENV_FILE to git.${NC}"
else
  echo -e "${RED}${BOLD}$FAILED check(s) failed. Fix issues above before deploying.${NC}"
  exit 1
fi
