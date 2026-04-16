#!/usr/bin/env bash
# install/phases/migrate-rls.sh — install RLS migrations 025-029.
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname "$0")/../lib/common.sh"

V2="$(bundles_dir)/v2-rls-tests"
DB_URL="${DATABASE_URL:?DATABASE_URL must be set in install.env}"

log "Installing migration runner..."
install_file "$V2/db/scripts/migrate.sh" "$AION_ROOT/db/scripts/migrate.sh" 0755 "${AION_USER}:${AION_USER}"

log "Installing migrations 025-029 (renumbered for project compatibility)..."
for f in "$V2"/db/migrations/0[12][0-9]_*.sql; do
  name="$(basename "$f")"
  install_file "$f" "$AION_ROOT/db/migrations/$name" 0644 "${AION_USER}:${AION_USER}"
done

log "Installing seeds..."
install_file "$V2/db/seeds/seed-qa-tenant.sql"          "$AION_ROOT/db/seeds/seed-qa-tenant.sql"          0644 "${AION_USER}:${AION_USER}"
install_file "$V2/db/seeds/seed-qa-tenant-cleanup.sql"  "$AION_ROOT/db/seeds/seed-qa-tenant-cleanup.sql"  0644 "${AION_USER}:${AION_USER}"
install_file "$V2/db/scripts/seed-qa.sh"                "$AION_ROOT/db/scripts/seed-qa.sh"                0755 "${AION_USER}:${AION_USER}"

log "Pre-migration backup..."
SNAP="$AION_ROOT/snapshots/pre-rls-${RUN_ID}.dump"
if pg_dump "$DB_URL" -Fc -f "$SNAP" 2>/dev/null; then
  ok "DB backup: $SNAP"
else
  warn "Could not dump DB. The migration is transactional, so an inability to backup is non-fatal, but you should investigate."
  if [[ "${MODE:-interactive}" != "auto" ]]; then
    confirm "Continue without backup?" || die "Aborted by user"
  fi
fi

log "Running migrations (dry-run first)..."
sudo -u "$AION_USER" \
  DATABASE_URL="$DB_URL" \
  MIGRATIONS_DIR="$AION_ROOT/db/migrations" \
  LOG_DIR="$LOG_DIR" \
  "$AION_ROOT/db/scripts/migrate.sh" --env production --dry-run

log "Applying migrations..."
sudo -u "$AION_USER" \
  DATABASE_URL="$DB_URL" \
  MIGRATIONS_DIR="$AION_ROOT/db/migrations" \
  LOG_DIR="$LOG_DIR" \
  "$AION_ROOT/db/scripts/migrate.sh" --env production --apply

log "Verifying RLS coverage..."
RLS_GAPS="$(psql "$DB_URL" -Atc "
  SELECT count(*) FROM pg_tables
  WHERE schemaname='public' AND rowsecurity=false
    AND tablename<>'schema_migrations';
")"

if [[ "$RLS_GAPS" -eq 0 ]]; then
  ok "All public tables have RLS enabled (0 gaps)"
else
  warn "$RLS_GAPS tables WITHOUT RLS — review:"
  psql "$DB_URL" -c "
    SELECT tablename FROM pg_tables
    WHERE schemaname='public' AND rowsecurity=false
      AND tablename<>'schema_migrations';
  "
fi

log "Verifying audit_log table exists..."
if psql "$DB_URL" -Atc "SELECT 1 FROM pg_tables WHERE tablename='audit_log'" | grep -q 1; then
  ok "audit_log table present"
else
  warn "audit_log not created — check migration 029"
fi

ok "Migrate-RLS phase complete."
