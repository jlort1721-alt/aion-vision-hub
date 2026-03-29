#!/usr/bin/env bash
###############################################################################
# 02-rotate-credentials.sh
#
# Generates new credentials for all AION platform services and prints them
# for the operator to manually apply. Does NOT modify any running service.
#
# Prerequisites:
#   - openssl installed
#   - Node.js installed (for scrypt hash generation)
#
# Usage:
#   chmod +x 02-rotate-credentials.sh
#   ./02-rotate-credentials.sh
###############################################################################
set -euo pipefail

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
log()   { printf '\n\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
warn()  { printf '\n\033[1;33m[WARN]\033[0m  %s\n' "$*"; }
err()   { printf '\n\033[1;31m[ERROR]\033[0m %s\n' "$*"; }
ok()    { printf '\n\033[1;32m[OK]\033[0m    %s\n' "$*"; }
sep()   { printf '\n%s\n' "------------------------------------------------------------"; }

# ---------------------------------------------------------------------------
# Pre-flight
# ---------------------------------------------------------------------------
log "=== Credential Rotation Script ==="
log "This script GENERATES new credentials and DISPLAYS them."
log "The operator must manually update each service."
echo ""

if ! command -v openssl &>/dev/null; then
  err "openssl is required but not found."
  exit 1
fi

if ! command -v node &>/dev/null; then
  err "Node.js is required but not found (needed for scrypt hash)."
  exit 1
fi

# ---------------------------------------------------------------------------
# Step 1: Generate new random credentials
# ---------------------------------------------------------------------------
log "Generating new credentials..."

NEW_PG_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)
NEW_REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)
NEW_JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)
NEW_SESSION_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)
NEW_ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 20)
NEW_COOKIE_SECRET=$(openssl rand -base64 32 | tr -d '/+=' | head -c 40)

ok "All credentials generated."

# ---------------------------------------------------------------------------
# Step 2: Generate admin password hash using Node.js scrypt
# ---------------------------------------------------------------------------
log "Generating scrypt hash for new admin password..."

NEW_ADMIN_HASH=$(node -e "
const crypto = require('crypto');
const password = '${NEW_ADMIN_PASSWORD}';
const salt = crypto.randomBytes(16).toString('hex');
crypto.scrypt(password, salt, 64, (err, derivedKey) => {
  if (err) { process.exit(1); }
  console.log(salt + ':' + derivedKey.toString('hex'));
});
")

if [[ -z "${NEW_ADMIN_HASH}" ]]; then
  err "Failed to generate admin password hash."
  exit 1
fi

ok "Admin password hash generated."

# ---------------------------------------------------------------------------
# Step 3: Display all new credentials
# ---------------------------------------------------------------------------
sep
echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║              NEW CREDENTIALS — SAVE SECURELY               ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  PostgreSQL Password:   ${NEW_PG_PASSWORD}"
echo "  Redis Password:        ${NEW_REDIS_PASSWORD}"
echo "  JWT Secret:            ${NEW_JWT_SECRET}"
echo "  Session Secret:        ${NEW_SESSION_SECRET}"
echo "  Cookie Secret:         ${NEW_COOKIE_SECRET}"
echo "  Admin Password:        ${NEW_ADMIN_PASSWORD}"
echo "  Admin Hash (scrypt):   ${NEW_ADMIN_HASH}"
echo ""
sep

# ---------------------------------------------------------------------------
# Step 4: Print SQL commands for PostgreSQL
# ---------------------------------------------------------------------------
log "=== PostgreSQL Commands ==="
echo ""
echo "  Connect to PostgreSQL and run:"
echo ""
echo "    -- Rotate the aion database user password"
echo "    ALTER ROLE aion WITH PASSWORD '${NEW_PG_PASSWORD}';"
echo ""
echo "    -- Update admin user password hash in the users table"
echo "    UPDATE users"
echo "      SET password_hash = '${NEW_ADMIN_HASH}',"
echo "          updated_at    = NOW()"
echo "      WHERE username = 'admin';"
echo ""
echo "    -- Verify the update"
echo "    SELECT id, username, LEFT(password_hash, 30) || '...' AS hash_preview,"
echo "           updated_at"
echo "      FROM users"
echo "      WHERE username = 'admin';"
echo ""
sep

# ---------------------------------------------------------------------------
# Step 5: Print Redis commands
# ---------------------------------------------------------------------------
log "=== Redis Commands ==="
echo ""
echo "  Connect to Redis (redis-cli) and run:"
echo ""
echo "    AUTH <current_password>"
echo "    CONFIG SET requirepass \"${NEW_REDIS_PASSWORD}\""
echo "    CONFIG REWRITE"
echo "    AUTH ${NEW_REDIS_PASSWORD}"
echo "    PING"
echo ""
echo "  Alternatively, edit /etc/redis/redis.conf:"
echo "    requirepass ${NEW_REDIS_PASSWORD}"
echo "  Then restart: sudo systemctl restart redis"
echo ""
sep

# ---------------------------------------------------------------------------
# Step 6: Generate .env template
# ---------------------------------------------------------------------------
log "=== .env.production Template ==="
echo ""
echo "  Copy the following into your .env.production file on the VPS:"
echo ""
echo "  ─── BEGIN .env.production ───"
echo ""
cat <<ENVTEMPLATE
# Database
DATABASE_URL=postgresql://aion:${NEW_PG_PASSWORD}@localhost:5432/aion
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=aion
PG_USER=aion
PG_PASSWORD=${NEW_PG_PASSWORD}

# Redis
REDIS_URL=redis://:${NEW_REDIS_PASSWORD}@localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${NEW_REDIS_PASSWORD}

# Auth
JWT_SECRET=${NEW_JWT_SECRET}
SESSION_SECRET=${NEW_SESSION_SECRET}
COOKIE_SECRET=${NEW_COOKIE_SECRET}

# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# go2rtc
GO2RTC_API=http://localhost:1984
ENVTEMPLATE
echo ""
echo "  ─── END .env.production ───"
echo ""
sep

# ---------------------------------------------------------------------------
# Step 7: Node.js verification snippet
# ---------------------------------------------------------------------------
log "=== Verify Admin Password (Node.js snippet) ==="
echo ""
echo "  Run this on the VPS to verify the new admin password works:"
echo ""
cat <<'NODESNIPPET'
  node -e "
  const crypto = require('crypto');
NODESNIPPET
echo "  const hash = '${NEW_ADMIN_HASH}';"
cat <<'NODESNIPPET'
  const [salt, key] = hash.split(':');
NODESNIPPET
echo "  const password = '${NEW_ADMIN_PASSWORD}';"
cat <<'NODESNIPPET'
  crypto.scrypt(password, salt, 64, (err, derivedKey) => {
    if (err) throw err;
    const match = derivedKey.toString('hex') === key;
    console.log('Password verification:', match ? 'PASS' : 'FAIL');
  });
  "
NODESNIPPET
echo ""
sep

# ---------------------------------------------------------------------------
# Step 8: Checklist
# ---------------------------------------------------------------------------
echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║              CREDENTIAL ROTATION CHECKLIST                  ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  [ ] 1. PostgreSQL password rotated (ALTER ROLE aion)"
echo "  [ ] 2. Admin user hash updated in users table"
echo "  [ ] 3. Redis password rotated (CONFIG SET requirepass)"
echo "  [ ] 4. .env.production updated on the VPS with new values"
echo "  [ ] 5. Backend restarted (pm2 restart aion-backend)"
echo "  [ ] 6. Verified API login works with new admin password"
echo "  [ ] 7. Verified Redis connection (redis-cli -a <new_pass> PING)"
echo "  [ ] 8. Verified PostgreSQL connection (psql -U aion -d aion)"
echo "  [ ] 9. Old credentials removed from any local notes/docs"
echo "  [ ] 10. .env.production is NOT committed to git"
echo "  [ ] 11. GitHub secrets updated (if using CI/CD)"
echo "  [ ] 12. Monitoring/alerting tested post-rotation"
echo ""
sep
ok "Credential rotation script completed."
log "REMINDER: Save these credentials securely. They will not be shown again."
