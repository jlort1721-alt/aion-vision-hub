#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# AION Vision Hub — Pre-Production Environment Checker
# Validates that the production environment is properly configured
# before deployment. Run this BEFORE going live.
# ═══════════════════════════════════════════════════════════════════
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Colors ──────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass()  { PASS=$((PASS + 1)); echo -e "  ${GREEN}PASS${NC}  $1"; }
fail()  { FAIL=$((FAIL + 1)); echo -e "  ${RED}FAIL${NC}  $1"; }
warn()  { WARN=$((WARN + 1)); echo -e "  ${YELLOW}WARN${NC}  $1"; }
info()  { echo -e "  ${BLUE}INFO${NC}  $1"; }
header(){ echo ""; echo -e "${BOLD}── $1 ──${NC}"; }

# ── Load .env if present ───────────────────────────────────────────
ENV_FILE="${ENV_FILE:-$ROOT_DIR/backend/.env}"
if [[ -f "$ENV_FILE" ]]; then
  info "Loading env from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# ════════════════════════════════════════════════════════════════════
# Section 1: Required Environment Variables
# ════════════════════════════════════════════════════════════════════
header "Required Environment Variables"

check_env_set() {
  local var_name="$1"
  local description="${2:-}"
  if [[ -z "${!var_name:-}" ]]; then
    fail "$var_name is not set${description:+ ($description)}"
  else
    pass "$var_name is set"
  fi
}

check_env_min_length() {
  local var_name="$1"
  local min_len="$2"
  local description="${3:-}"
  local value="${!var_name:-}"
  if [[ -z "$value" ]]; then
    fail "$var_name is not set${description:+ ($description)}"
  elif [[ ${#value} -lt $min_len ]]; then
    fail "$var_name is too short (${#value} chars, minimum $min_len)${description:+ — $description}"
  else
    pass "$var_name is set and meets minimum length ($min_len chars)"
  fi
}

# Core required vars
check_env_set "DATABASE_URL" "PostgreSQL connection string"
check_env_min_length "JWT_SECRET" 32 "generate with: openssl rand -hex 32"

# Check JWT_SECRET is not a placeholder
if [[ "${JWT_SECRET:-}" == *"REPLACE"* || "${JWT_SECRET:-}" == *"your-"* || "${JWT_SECRET:-}" == *"changeme"* ]]; then
  fail "JWT_SECRET appears to be a placeholder value. Generate a real secret."
fi

# Production-required vars
if [[ "${NODE_ENV:-}" == "production" ]]; then
  check_env_min_length "CREDENTIAL_ENCRYPTION_KEY" 32 "generate with: openssl rand -hex 16"
else
  if [[ -z "${CREDENTIAL_ENCRYPTION_KEY:-}" ]]; then
    warn "CREDENTIAL_ENCRYPTION_KEY not set (required in production)"
  else
    pass "CREDENTIAL_ENCRYPTION_KEY is set"
  fi
fi

# Check NODE_ENV
if [[ "${NODE_ENV:-}" == "production" ]]; then
  pass "NODE_ENV is set to 'production'"
elif [[ -n "${NODE_ENV:-}" ]]; then
  warn "NODE_ENV is '${NODE_ENV}' (expected 'production' for production deployment)"
else
  fail "NODE_ENV is not set"
fi

# ════════════════════════════════════════════════════════════════════
# Section 2: Optional but Recommended Variables
# ════════════════════════════════════════════════════════════════════
header "Optional / Recommended Variables"

# CORS should be explicitly set in production
if [[ -z "${CORS_ORIGINS:-}" ]]; then
  warn "CORS_ORIGINS not set (will default to http://localhost:5173)"
elif [[ "${CORS_ORIGINS:-}" == *"localhost"* && "${NODE_ENV:-}" == "production" ]]; then
  warn "CORS_ORIGINS contains 'localhost' in production: ${CORS_ORIGINS}"
else
  pass "CORS_ORIGINS is set: ${CORS_ORIGINS}"
fi

# Redis
if [[ -n "${REDIS_URL:-}" ]]; then
  pass "REDIS_URL is configured"
else
  warn "REDIS_URL not set (will use in-memory cache — not suitable for multi-instance)"
fi

# Email provider
if [[ -n "${RESEND_API_KEY:-}" || -n "${SENDGRID_API_KEY:-}" || -n "${SMTP_HOST:-}" ]]; then
  pass "Email provider is configured"
else
  warn "No email provider configured (RESEND_API_KEY, SENDGRID_API_KEY, or SMTP_HOST)"
fi

# Log level
if [[ "${LOG_LEVEL:-info}" == "debug" || "${LOG_LEVEL:-info}" == "trace" ]]; then
  warn "LOG_LEVEL is '${LOG_LEVEL}' — verbose logging in production may impact performance"
else
  pass "LOG_LEVEL is '${LOG_LEVEL:-info}'"
fi

# ════════════════════════════════════════════════════════════════════
# Section 3: Database Connectivity
# ════════════════════════════════════════════════════════════════════
header "Database Connectivity"

if [[ -z "${DATABASE_URL:-}" ]]; then
  fail "Cannot test database — DATABASE_URL not set"
else
  if command -v psql &>/dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1" &>/dev/null 2>&1; then
      pass "PostgreSQL is reachable"

      # Check for required tables
      tables_check=$(psql "$DATABASE_URL" -t -A -c "
        SELECT string_agg(t, ', ')
        FROM (
          SELECT unnest(ARRAY['users','tenants','devices','sites','events']) AS t
          EXCEPT
          SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        ) missing;" 2>/dev/null || echo "ERROR")

      if [[ "$tables_check" == "ERROR" ]]; then
        warn "Could not check for required tables"
      elif [[ -z "$tables_check" || "$tables_check" == " " ]]; then
        pass "Core tables exist (users, tenants, devices, sites, events)"
      else
        fail "Missing tables: $tables_check"
      fi

      # Check migration tracking
      migration_count=$(psql "$DATABASE_URL" -t -A -c \
        "SELECT COUNT(*) FROM public._migrations_applied" 2>/dev/null || echo "NONE")
      if [[ "$migration_count" == "NONE" ]]; then
        info "Migration tracking table not found (run migrate-all.sh first)"
      else
        info "$migration_count backend migrations recorded"
      fi
    else
      fail "PostgreSQL is NOT reachable at ${DATABASE_URL%%@*}@****"
    fi
  else
    warn "psql not installed — cannot verify database connectivity"
  fi
fi

# ════════════════════════════════════════════════════════════════════
# Section 4: Redis Connectivity
# ════════════════════════════════════════════════════════════════════
header "Redis Connectivity"

if [[ -z "${REDIS_URL:-}" ]]; then
  warn "REDIS_URL not set — skipping Redis check"
else
  if command -v redis-cli &>/dev/null; then
    # Parse host and port from URL: redis://host:port
    REDIS_HOST=$(echo "$REDIS_URL" | sed -E 's|redis://([^:]+).*|\1|')
    REDIS_PORT=$(echo "$REDIS_URL" | sed -E 's|redis://[^:]+:([0-9]+).*|\1|')
    REDIS_PORT="${REDIS_PORT:-6379}"

    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"; then
      pass "Redis is reachable at $REDIS_HOST:$REDIS_PORT"

      # Check memory usage
      used_mem=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" info memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '[:space:]')
      if [[ -n "$used_mem" ]]; then
        info "Redis memory usage: $used_mem"
      fi
    else
      fail "Redis is NOT reachable at $REDIS_HOST:$REDIS_PORT"
    fi
  else
    warn "redis-cli not installed — cannot verify Redis connectivity"
  fi
fi

# ════════════════════════════════════════════════════════════════════
# Section 5: Docker Services
# ════════════════════════════════════════════════════════════════════
header "Docker Services"

if command -v docker &>/dev/null; then
  if docker info &>/dev/null 2>&1; then
    pass "Docker daemon is running"

    # Check if compose file exists
    COMPOSE_FILE="$ROOT_DIR/backend/docker-compose.yml"
    if [[ -f "$COMPOSE_FILE" ]]; then
      # Check service health
      services=$(docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null || true)
      if [[ -n "$services" ]]; then
        unhealthy=$(echo "$services" | python3 -c "
import sys, json
lines = sys.stdin.read().strip().split('\n')
for line in lines:
    try:
        svc = json.loads(line)
        name = svc.get('Service', svc.get('Name', '?'))
        state = svc.get('State', '?')
        health = svc.get('Health', 'N/A')
        if state == 'running' and health in ('healthy', 'N/A', ''):
            print(f'OK|{name}|{state}|{health}')
        else:
            print(f'BAD|{name}|{state}|{health}')
    except: pass
" 2>/dev/null || echo "PARSE_ERROR")

        if [[ "$unhealthy" == "PARSE_ERROR" ]]; then
          # Fallback: just check if containers are running
          running=$(docker compose -f "$COMPOSE_FILE" ps --status running -q 2>/dev/null | wc -l | tr -d ' ')
          total=$(docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null | wc -l | tr -d ' ')
          if [[ "$running" -eq "$total" && "$total" -gt 0 ]]; then
            pass "All $total Docker Compose services are running"
          elif [[ "$total" -eq 0 ]]; then
            warn "No Docker Compose services are running"
          else
            fail "$running of $total Docker Compose services are running"
          fi
        else
          echo "$unhealthy" | while IFS='|' read -r status name state health; do
            if [[ "$status" == "OK" ]]; then
              pass "Docker service '$name': $state ($health)"
            else
              fail "Docker service '$name': $state ($health)"
            fi
          done
        fi
      else
        warn "No Docker Compose services detected"
      fi
    else
      info "docker-compose.yml not found at expected path"
    fi
  else
    warn "Docker daemon is not running"
  fi
else
  warn "Docker not installed — skipping container checks"
fi

# ════════════════════════════════════════════════════════════════════
# Section 6: SSL Certificate
# ════════════════════════════════════════════════════════════════════
header "SSL Certificate"

# Try to detect the domain from CORS_ORIGINS or a custom var
SSL_DOMAIN="${SSL_CHECK_DOMAIN:-}"
if [[ -z "$SSL_DOMAIN" ]]; then
  # Extract first non-localhost domain from CORS_ORIGINS
  if [[ -n "${CORS_ORIGINS:-}" ]]; then
    SSL_DOMAIN=$(echo "$CORS_ORIGINS" | tr ',' '\n' | grep -v localhost | head -1 | sed -E 's|https?://||' | cut -d: -f1)
  fi
fi

if [[ -z "$SSL_DOMAIN" ]]; then
  info "No external domain detected (set SSL_CHECK_DOMAIN to check a specific domain)"
else
  if command -v openssl &>/dev/null; then
    cert_info=$(echo | openssl s_client -connect "$SSL_DOMAIN:443" -servername "$SSL_DOMAIN" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    if [[ -n "$cert_info" ]]; then
      expiry_str=$(echo "$cert_info" | grep "notAfter" | cut -d= -f2)
      if [[ -n "$expiry_str" ]]; then
        # Convert to epoch for comparison
        if date -j -f "%b %d %T %Y %Z" "$expiry_str" "+%s" &>/dev/null 2>&1; then
          # macOS date
          expiry_epoch=$(date -j -f "%b %d %T %Y %Z" "$expiry_str" "+%s")
        else
          # GNU date
          expiry_epoch=$(date -d "$expiry_str" "+%s" 2>/dev/null || echo "0")
        fi
        now_epoch=$(date "+%s")
        days_left=$(( (expiry_epoch - now_epoch) / 86400 ))

        if [[ $days_left -lt 0 ]]; then
          fail "SSL certificate for $SSL_DOMAIN has EXPIRED ($expiry_str)"
        elif [[ $days_left -lt 14 ]]; then
          fail "SSL certificate for $SSL_DOMAIN expires in $days_left days ($expiry_str)"
        elif [[ $days_left -lt 30 ]]; then
          warn "SSL certificate for $SSL_DOMAIN expires in $days_left days ($expiry_str)"
        else
          pass "SSL certificate for $SSL_DOMAIN valid for $days_left days (expires $expiry_str)"
        fi
      else
        warn "Could not parse SSL certificate expiry for $SSL_DOMAIN"
      fi
    else
      fail "Could not retrieve SSL certificate for $SSL_DOMAIN:443"
    fi
  else
    warn "openssl not installed — cannot check SSL certificate"
  fi
fi

# ════════════════════════════════════════════════════════════════════
# Section 7: Disk Space
# ════════════════════════════════════════════════════════════════════
header "Disk Space"

# Check disk usage on the partition containing the project
disk_usage=$(df -h "$ROOT_DIR" 2>/dev/null | tail -1)
if [[ -n "$disk_usage" ]]; then
  usage_pct=$(echo "$disk_usage" | awk '{print $5}' | tr -d '%')
  avail=$(echo "$disk_usage" | awk '{print $4}')
  mount=$(echo "$disk_usage" | awk '{print $NF}')

  if [[ "$usage_pct" -gt 95 ]]; then
    fail "Disk usage is ${usage_pct}% on $mount ($avail available) — CRITICAL"
  elif [[ "$usage_pct" -gt 85 ]]; then
    warn "Disk usage is ${usage_pct}% on $mount ($avail available)"
  else
    pass "Disk usage is ${usage_pct}% on $mount ($avail available)"
  fi
else
  warn "Could not determine disk usage"
fi

# Check Docker disk usage if available
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  docker_usage=$(docker system df 2>/dev/null | grep "Images" | awk '{print $4}')
  if [[ -n "$docker_usage" ]]; then
    info "Docker images disk usage: $docker_usage"
  fi
fi

# ════════════════════════════════════════════════════════════════════
# Section 8: Security Checks
# ════════════════════════════════════════════════════════════════════
header "Security Checks"

# Check that .env files are not committed
if [[ -d "$ROOT_DIR/.git" ]]; then
  tracked_envs=$(git -C "$ROOT_DIR" ls-files '*.env' '.env.*' 2>/dev/null | grep -v '.env.example' || true)
  if [[ -n "$tracked_envs" ]]; then
    fail ".env files are tracked by git: $tracked_envs"
  else
    pass "No .env files tracked by git"
  fi
fi

# Check .gitignore has .env entries
if [[ -f "$ROOT_DIR/.gitignore" ]]; then
  if grep -q '\.env' "$ROOT_DIR/.gitignore" 2>/dev/null; then
    pass ".gitignore includes .env patterns"
  else
    warn ".gitignore may not exclude .env files"
  fi
fi

# Check if debug/dev ports are exposed in production
if [[ "${NODE_ENV:-}" == "production" ]]; then
  if [[ "${PORT:-3000}" == "3000" ]]; then
    info "API running on port ${PORT:-3000}"
  fi
fi

# ════════════════════════════════════════════════════════════════════
# Summary
# ════════════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "${BOLD}  Pre-Production Check Summary${NC}"
echo "═══════════════════════════════════════════════════════════"
echo -e "  ${GREEN}PASS:${NC}  $PASS"
echo -e "  ${YELLOW}WARN:${NC}  $WARN"
echo -e "  ${RED}FAIL:${NC}  $FAIL"
echo "═══════════════════════════════════════════════════════════"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo -e "  ${RED}${BOLD}RESULT: NOT READY FOR PRODUCTION${NC}"
  echo "  Fix all FAIL items before deploying."
  echo ""
  exit 1
elif [[ $WARN -gt 0 ]]; then
  echo -e "  ${YELLOW}${BOLD}RESULT: READY WITH WARNINGS${NC}"
  echo "  Review WARN items — they may indicate configuration gaps."
  echo ""
  exit 0
else
  echo -e "  ${GREEN}${BOLD}RESULT: READY FOR PRODUCTION${NC}"
  echo ""
  exit 0
fi
