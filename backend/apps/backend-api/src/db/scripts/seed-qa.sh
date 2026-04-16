#!/usr/bin/env bash
# =============================================================================
# seed-qa.sh — wrapper para correr el seed QA con seguridad
# -----------------------------------------------------------------------------
# Verifica:
#   1. Que NO estes apuntando a la DB de produccion real (a menos que --force)
#   2. Que pgcrypto este disponible (necesario para crypt() en auth.users)
#   3. Hace dump de seguridad antes de tocar nada
#   4. Imprime el .env.qa generado para copy-paste
#
# Uso:
#   ./seed-qa.sh              # seed
#   ./seed-qa.sh --clean      # limpiar tenant QA
#   ./seed-qa.sh --reset      # clean + seed
#   ./seed-qa.sh --print-env  # solo imprimir .env.qa
#   ./seed-qa.sh --verify     # solo verificar estado (lee v_qa_seed_status)
# =============================================================================
set -Eeuo pipefail

DB_URL="${DATABASE_URL:-postgres://aion@127.0.0.1:5432/aion}"
SEED_SQL="$(dirname "$0")/../seeds/seed-qa-tenant.sql"
CLEAN_SQL="$(dirname "$0")/../seeds/seed-qa-tenant-cleanup.sql"
SNAPSHOT_DIR="${SNAPSHOT_DIR:-/opt/aion/snapshots}"

ACTION="seed"
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --clean)     ACTION="clean";  shift ;;
    --reset)     ACTION="reset";  shift ;;
    --print-env) ACTION="print";  shift ;;
    --verify)    ACTION="verify"; shift ;;
    --force)     FORCE=1;         shift ;;
    -h|--help)   sed -n '1,20p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

log(){ printf '[seed-qa] %s\n' "$*"; }
die(){ log "ERROR: $*"; exit 1; }

# ---- Safety: refuse if DB looks like production unless --force --------------
guard_production() {
  if [[ "$DB_URL" == *aionseg* ]] && [[ "$FORCE" -eq 0 ]]; then
    log "DB_URL parece produccion ($DB_URL)."
    log "Si REALMENTE quieres seedear el tenant QA en produccion, usa --force."
    log "(Es seguro: usa UUIDs fijos del rango QA, no toca datos reales.)"
    die "abortado por seguridad"
  fi
}

print_env() {
  cat <<EOF
# Pega esto en /opt/aion/.env.qa (modo 600, owner aion)
AION_BASE_URL=https://aionseg.co
AION_QA_EMAIL=qa-bot@aionseg.co
AION_QA_PASS=QA-bot-2026!

AION_QA_SITE_ID=22222222-2222-2222-2222-222222222222
AION_QA_RESIDENT_ID=77777777-7777-7777-7777-777777777777
AION_QA_GUARD_ID=88888888-8888-8888-8888-888888888888
AION_QA_CONTROLLER_ID=99999999-9999-9999-9999-999999999999
AION_QA_ROUTE_ID=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
AION_QA_CHECKPOINT_1=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
AION_QA_CHECKPOINT_2=cccccccc-cccc-cccc-cccc-cccccccccccc
AION_QA_CHECKPOINT_3=dddddddd-dddd-dddd-dddd-dddddddddddd
EOF
}

ensure_pgcrypto() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q -c \
    "CREATE EXTENSION IF NOT EXISTS pgcrypto;" >/dev/null
}

snapshot() {
  mkdir -p "$SNAPSHOT_DIR"
  local f="$SNAPSHOT_DIR/pre-seed-qa-$(date +%Y%m%d-%H%M%S).dump"
  log "Backup → $f"
  pg_dump "$DB_URL" -Fc -f "$f" 2>/dev/null \
    || log "  (backup fallo — continuando)"
}

verify() {
  log "Verificacion del seed QA:"
  psql "$DB_URL" -c "SELECT * FROM public.v_qa_seed_status;" 2>/dev/null \
    || log "  (vista v_qa_seed_status no existe — corre el seed primero)"
}

case "$ACTION" in
  print)
    print_env
    ;;

  verify)
    verify
    ;;

  seed)
    guard_production
    ensure_pgcrypto
    snapshot
    log "Aplicando seed…"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SEED_SQL"
    verify
    log ""
    log "Variables para .env.qa:"
    print_env
    ;;

  clean)
    guard_production
    snapshot
    log "Limpiando tenant QA…"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$CLEAN_SQL"
    log "done"
    ;;

  reset)
    guard_production
    ensure_pgcrypto
    snapshot
    log "Reset = clean + seed"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$CLEAN_SQL"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$SEED_SQL"
    verify
    print_env
    ;;
esac
