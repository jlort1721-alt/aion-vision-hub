#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# AION Vision Hub — Unified Migration Runner
# Runs Supabase migrations then backend-specific migrations.
# Idempotent: safe to run multiple times against the same database.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Constants ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend/apps/backend-api"
BACKEND_MIGRATIONS_DIR="$BACKEND_DIR/src/db/migrations"
SUPABASE_DIR="$ROOT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Helpers ─────────────────────────────────────────────────────────
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_info()  { echo -e "        $1"; }

usage() {
  cat <<EOF
Usage: $(basename "$0") <environment> [options]

Environments:
  development   Local dev database (default Docker Compose setup)
  staging       Staging environment (requires STAGING_DATABASE_URL)
  production    Production environment (requires DATABASE_URL)

Options:
  --supabase-only     Run only Supabase migrations
  --backend-only      Run only backend migrations
  --dry-run           Show what would be executed without running anything
  --skip-confirmation Skip the production confirmation prompt
  -h, --help          Show this help message

Examples:
  $(basename "$0") development
  $(basename "$0") production --dry-run
  $(basename "$0") staging --backend-only
EOF
  exit 0
}

# ── Parse Arguments ─────────────────────────────────────────────────
ENVIRONMENT="${1:-}"
SUPABASE_ONLY=false
BACKEND_ONLY=false
DRY_RUN=false
SKIP_CONFIRM=false

if [[ -z "$ENVIRONMENT" || "$ENVIRONMENT" == "-h" || "$ENVIRONMENT" == "--help" ]]; then
  usage
fi

shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --supabase-only)     SUPABASE_ONLY=true ;;
    --backend-only)      BACKEND_ONLY=true ;;
    --dry-run)           DRY_RUN=true ;;
    --skip-confirmation) SKIP_CONFIRM=true ;;
    -h|--help)           usage ;;
    *) log_error "Unknown option: $1"; usage ;;
  esac
  shift
done

if [[ "$SUPABASE_ONLY" == true && "$BACKEND_ONLY" == true ]]; then
  log_error "Cannot use --supabase-only and --backend-only together."
  exit 1
fi

case "$ENVIRONMENT" in
  development|staging|production) ;;
  *) log_error "Invalid environment: $ENVIRONMENT (must be development, staging, or production)"; exit 1 ;;
esac

# ── Resolve DATABASE_URL ────────────────────────────────────────────
resolve_database_url() {
  case "$ENVIRONMENT" in
    development)
      # Use .env file or default Docker Compose URL
      if [[ -f "$ROOT_DIR/backend/.env" ]]; then
        local db_url
        db_url=$(grep -E '^DATABASE_URL=' "$ROOT_DIR/backend/.env" 2>/dev/null | head -1 | cut -d'=' -f2-)
        if [[ -n "$db_url" ]]; then
          echo "$db_url"
          return
        fi
      fi
      echo "postgres://aion:aion_dev_password@localhost:5432/aion_vision_hub"
      ;;
    staging)
      if [[ -n "${STAGING_DATABASE_URL:-}" ]]; then
        echo "$STAGING_DATABASE_URL"
      elif [[ -n "${DATABASE_URL:-}" ]]; then
        echo "$DATABASE_URL"
      else
        log_error "STAGING_DATABASE_URL or DATABASE_URL must be set for staging."
        exit 1
      fi
      ;;
    production)
      if [[ -z "${DATABASE_URL:-}" ]]; then
        log_error "DATABASE_URL must be set for production migrations."
        exit 1
      fi
      echo "$DATABASE_URL"
      ;;
  esac
}

DB_URL="$(resolve_database_url)"

# ── Production Safety Gate ──────────────────────────────────────────
if [[ "$ENVIRONMENT" == "production" && "$DRY_RUN" == false && "$SKIP_CONFIRM" == false ]]; then
  echo ""
  log_warn "You are about to run migrations against PRODUCTION."
  log_warn "Database: ${DB_URL%%@*}@****"
  echo ""
  read -r -p "Type 'yes' to continue: " confirm
  if [[ "$confirm" != "yes" ]]; then
    log_info "Aborted."
    exit 0
  fi
fi

# ── Pre-flight Checks ──────────────────────────────────────────────
log_step "Pre-flight checks for '$ENVIRONMENT' environment"

# Check psql availability (needed for backend migrations)
if ! command -v psql &>/dev/null; then
  log_warn "psql not found. Backend SQL migrations will use the node postgres driver via drizzle-kit instead."
  PSQL_AVAILABLE=false
else
  PSQL_AVAILABLE=true
fi

# Check database connectivity
if [[ "$DRY_RUN" == false ]]; then
  if [[ "$PSQL_AVAILABLE" == true ]]; then
    if psql "$DB_URL" -c "SELECT 1" &>/dev/null; then
      log_ok "Database is reachable"
    else
      log_error "Cannot connect to database. Check DATABASE_URL and that the server is running."
      exit 1
    fi
  else
    log_warn "Skipping connectivity check (psql not available)"
  fi
fi

# ── Track Results ───────────────────────────────────────────────────
SUPABASE_STATUS="skipped"
BACKEND_STATUS="skipped"
FAILED_MIGRATIONS=()

# ── Phase 1: Supabase Migrations ───────────────────────────────────
run_supabase_migrations() {
  log_step "Phase 1: Supabase migrations"

  if ! command -v supabase &>/dev/null; then
    log_warn "Supabase CLI not found. Install it with: brew install supabase/tap/supabase"
    log_warn "Skipping Supabase migrations. Run them manually with: supabase db push"
    SUPABASE_STATUS="skipped (CLI not found)"
    return 0
  fi

  local migration_count
  migration_count=$(find "$SUPABASE_DIR/supabase/migrations" -name '*.sql' 2>/dev/null | wc -l | tr -d ' ')

  if [[ "$migration_count" -eq 0 ]]; then
    log_info "No Supabase migration files found."
    SUPABASE_STATUS="skipped (no files)"
    return 0
  fi

  log_info "Found $migration_count Supabase migration(s)"

  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would run: supabase db push (from $SUPABASE_DIR)"
    find "$SUPABASE_DIR/supabase/migrations" -name '*.sql' -exec basename {} \; | sort
    SUPABASE_STATUS="dry-run"
    return 0
  fi

  cd "$SUPABASE_DIR"

  case "$ENVIRONMENT" in
    development)
      # Local dev: push to local Supabase instance
      if supabase db push --local 2>&1; then
        log_ok "Supabase migrations applied (local)"
        SUPABASE_STATUS="success"
      else
        log_warn "supabase db push --local failed. Trying supabase migration up..."
        if supabase migration up --local 2>&1; then
          log_ok "Supabase migrations applied via migration up (local)"
          SUPABASE_STATUS="success"
        else
          log_error "Supabase migrations failed."
          SUPABASE_STATUS="failed"
          return 1
        fi
      fi
      ;;
    staging|production)
      # Remote: push to linked project
      if supabase db push 2>&1; then
        log_ok "Supabase migrations applied (remote)"
        SUPABASE_STATUS="success"
      else
        log_error "Supabase migrations failed. Check supabase link status."
        SUPABASE_STATUS="failed"
        return 1
      fi
      ;;
  esac
}

# ── Phase 2: Backend SQL Migrations ────────────────────────────────
run_backend_migrations() {
  log_step "Phase 2: Backend SQL migrations"

  if [[ ! -d "$BACKEND_MIGRATIONS_DIR" ]]; then
    log_info "No backend migrations directory found."
    BACKEND_STATUS="skipped (no directory)"
    return 0
  fi

  local migration_files
  migration_files=$(find "$BACKEND_MIGRATIONS_DIR" -name '*.sql' | sort)
  local migration_count
  migration_count=$(echo "$migration_files" | grep -c '.' || true)

  if [[ "$migration_count" -eq 0 ]]; then
    log_info "No backend SQL migration files found."
    BACKEND_STATUS="skipped (no files)"
    return 0
  fi

  log_info "Found $migration_count backend migration(s)"

  # Create tracking table if it doesn't exist (idempotent)
  local tracking_sql="
    CREATE TABLE IF NOT EXISTS public._migrations_applied (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum TEXT
    );
  "

  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would apply the following backend migrations:"
    echo "$migration_files" | while read -r f; do basename "$f"; done
    BACKEND_STATUS="dry-run"
    return 0
  fi

  if [[ "$PSQL_AVAILABLE" == false ]]; then
    log_warn "psql not available. Falling back to drizzle-kit migrate."
    cd "$BACKEND_DIR"
    if pnpm drizzle-kit migrate 2>&1; then
      log_ok "Backend migrations applied via drizzle-kit"
      BACKEND_STATUS="success (drizzle-kit)"
    else
      log_error "drizzle-kit migrate failed."
      BACKEND_STATUS="failed"
      return 1
    fi
    return 0
  fi

  # Create tracking table
  psql "$DB_URL" -c "$tracking_sql" &>/dev/null

  local applied=0
  local skipped=0
  local failed=0

  echo "$migration_files" | while read -r migration_file; do
    local filename
    filename=$(basename "$migration_file")
    local checksum
    checksum=$(shasum -a 256 "$migration_file" | awk '{print $1}')

    # Check if already applied
    local already_applied
    already_applied=$(psql "$DB_URL" -t -A -c \
      "SELECT COUNT(*) FROM public._migrations_applied WHERE filename = '$filename'" 2>/dev/null || echo "0")

    if [[ "$already_applied" -gt 0 ]]; then
      log_info "  [SKIP] $filename (already applied)"
      skipped=$((skipped + 1))
      continue
    fi

    log_info "  [APPLY] $filename ..."

    if psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$migration_file" 2>&1; then
      # Record successful migration
      psql "$DB_URL" -c \
        "INSERT INTO public._migrations_applied (filename, checksum) VALUES ('$filename', '$checksum') ON CONFLICT (filename) DO NOTHING;" \
        &>/dev/null
      log_ok "  $filename applied successfully"
      applied=$((applied + 1))
    else
      log_error "  $filename FAILED"
      FAILED_MIGRATIONS+=("$filename")
      failed=$((failed + 1))
      # Stop on first failure to avoid cascading errors
      log_error "Stopping backend migrations due to failure."
      log_info "To retry, fix the issue and re-run this script. Already-applied migrations will be skipped."
      BACKEND_STATUS="failed ($applied applied, $failed failed, remaining skipped)"
      return 1
    fi
  done

  log_ok "Backend migrations complete: $applied applied, $skipped already up-to-date"
  BACKEND_STATUS="success"
}

# ── Execute ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  AION Vision Hub — Migration Runner"
echo "  Environment: $ENVIRONMENT"
echo "  Dry Run:     $DRY_RUN"
echo "  Timestamp:   $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "═══════════════════════════════════════════════════════════"
echo ""

EXIT_CODE=0

if [[ "$BACKEND_ONLY" == false ]]; then
  if ! run_supabase_migrations; then
    EXIT_CODE=1
  fi
  echo ""
fi

if [[ "$SUPABASE_ONLY" == false ]]; then
  if ! run_backend_migrations; then
    EXIT_CODE=1
  fi
  echo ""
fi

# ── Summary ─────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
echo "  Migration Summary"
echo "═══════════════════════════════════════════════════════════"
echo "  Supabase:  $SUPABASE_STATUS"
echo "  Backend:   $BACKEND_STATUS"
echo ""

if [[ "$EXIT_CODE" -ne 0 ]]; then
  log_error "One or more migration phases failed."
  echo ""
  echo "  Rollback Notes:"
  echo "  ─────────────────────────────────────────────────────"
  echo "  - Supabase migrations: Use 'supabase migration repair' to mark"
  echo "    a migration as reverted, then fix and re-apply."
  echo "  - Backend migrations: All backend SQL files are idempotent."
  echo "    Fix the failing migration file and re-run this script."
  echo "    The tracking table (_migrations_applied) ensures already-"
  echo "    applied migrations are not re-executed."
  echo "  - For manual rollback, connect with psql and run your"
  echo "    compensating SQL, then delete the row from"
  echo "    _migrations_applied for that file."
  echo ""
fi

if [[ "$EXIT_CODE" -eq 0 ]]; then
  log_ok "All migrations completed successfully."
fi

exit $EXIT_CODE
