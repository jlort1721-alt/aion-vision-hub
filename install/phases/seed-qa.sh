#!/usr/bin/env bash
# install/phases/seed-qa.sh — create QA tenant with fixed UUIDs.
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname "$0")/../lib/common.sh"

DB_URL="${DATABASE_URL:?DATABASE_URL must be set in install.env}"

log "Ensuring pgcrypto extension..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" >/dev/null

log "Pre-seed verification (which tables exist)..."
psql "$DB_URL" -Atc "
  SELECT tablename FROM pg_tables
  WHERE schemaname='public'
    AND tablename IN ('tenants','sites','users','residents','guards',
                       'access_control_devices','patrol_routes','checkpoints',
                       'shifts','units','user_site_access','consent_records')
  ORDER BY tablename;
" | sed 's/^/  /'

log "Running seed (idempotent)..."
sudo -u "$AION_USER" \
  DATABASE_URL="$DB_URL" \
  "$AION_ROOT/db/scripts/seed-qa.sh" --force

log "Verifying seed status..."
psql "$DB_URL" -c "SELECT * FROM public.v_qa_seed_status;" 2>/dev/null \
  || warn "v_qa_seed_status not present — seed may have skipped some tables"

log "Generating .env.qa from template..."
ENV_QA="$AION_ROOT/.env.qa"
if [[ ! -f "$ENV_QA" ]]; then
  cp "$(bundles_dir)/v2-rls-tests/.env.qa.example" "$ENV_QA"
  chown "${AION_USER}:${AION_USER}" "$ENV_QA"
  chmod 600 "$ENV_QA"

  # Populate DATABASE_URL into .env.qa so subsequent phases can use it
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$DB_URL|" "$ENV_QA"
  ok ".env.qa created at $ENV_QA (mode 600)"
  warn "Edit $ENV_QA if you need to change AION_QA_PASS — default is 'QA-bot-2026!'"
else
  ok ".env.qa already exists (kept as-is)"
fi

ok "Seed-QA phase complete."
