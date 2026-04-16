#!/usr/bin/env bash
# =============================================================================
# AION — Database migration runner (idempotent, transactional)
# -----------------------------------------------------------------------------
# Usage:
#   ./migrate.sh --env production --apply             # run pending migrations
#   ./migrate.sh --env production --dry-run           # show what would run
#   ./migrate.sh --env production --status            # list applied vs pending
#   ./migrate.sh --env production --rollback 005      # rollback to version 005
#
# Each migration file lives in db/migrations/NNN_name.sql and must have:
#   -- +migrate Up
#   ...sql...
#   -- +migrate Down
#   ...sql...
#
# Every migration runs inside a BEGIN...COMMIT block. A failure rolls it back
# and stops the runner with non-zero exit code.
# =============================================================================
set -Eeuo pipefail

DB_URL="${DATABASE_URL:-postgres://aion@127.0.0.1:5432/aion}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$(dirname "$0")/../../backend/apps/backend-api/src/db/migrations}"
LOG_DIR="${LOG_DIR:-/var/log/aion}"
ACTION=""
ENV="production"
ROLLBACK_TO=""

mkdir -p "$LOG_DIR"
LOG="${LOG_DIR}/migrate-$(date +%Y%m%d-%H%M%S).log"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)       ENV="$2"; shift 2 ;;
    --apply)     ACTION="apply"; shift ;;
    --dry-run)   ACTION="dryrun"; shift ;;
    --status)    ACTION="status"; shift ;;
    --rollback)  ACTION="rollback"; ROLLBACK_TO="$2"; shift 2 ;;
    -h|--help)   sed -n '1,25p' "$0"; exit 0 ;;
    *)           echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$ACTION" ]] || { echo "Missing action (--apply|--dry-run|--status|--rollback)"; exit 2; }

exec > >(tee -a "$LOG") 2>&1
log(){ printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die(){ log "ERROR: $*"; exit 1; }

psql_cmd() { psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q "$@"; }

# ---- Bootstrap migrations table (idempotent) -------------------------------
psql_cmd -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  checksum    TEXT NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_ms INTEGER
);
CREATE INDEX IF NOT EXISTS schema_migrations_executed_at_idx
  ON schema_migrations(executed_at DESC);
" >/dev/null

# ---- Helpers ---------------------------------------------------------------
applied_versions() {
  psql_cmd -Atc "SELECT version FROM schema_migrations ORDER BY version"
}

checksum_of() {
  sha256sum "$1" | awk '{print $1}'
}

extract_section() {
  local file="$1" section="$2"
  # Extracts SQL between "-- +migrate $section" and next "-- +migrate" marker (or EOF)
  awk -v tag="-- +migrate $section" '
    BEGIN { keep=0 }
    $0 == tag          { keep=1; next }
    /^-- \+migrate /   { keep=0 }
    keep               { print }
  ' "$file"
}

# ---- Actions ---------------------------------------------------------------
case "$ACTION" in
  status)
    log "Applied migrations:"
    psql_cmd -c "SELECT version, name, executed_at, duration_ms FROM schema_migrations ORDER BY version"
    log "Pending migrations (on disk but not applied):"
    APPLIED="$(applied_versions)"
    for f in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
      v="$(basename "$f" | cut -d_ -f1)"
      grep -qx "$v" <<<"$APPLIED" || echo "  [PENDING] $(basename "$f")"
    done
    ;;

  dryrun|apply)
    APPLIED="$(applied_versions)"
    APPLIED_COUNT=0; PENDING_COUNT=0
    for f in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
      base="$(basename "$f")"
      v="$(echo "$base" | cut -d_ -f1)"
      name="$(echo "$base" | sed "s/^${v}_//; s/\.sql\$//")"
      chk="$(checksum_of "$f")"

      if grep -qx "$v" <<<"$APPLIED"; then
        # Verify checksum integrity
        db_chk="$(psql_cmd -Atc "SELECT checksum FROM schema_migrations WHERE version='$v'")"
        [[ "$db_chk" == "$chk" ]] \
          || die "Checksum mismatch on $base (disk=$chk db=$db_chk). Someone edited an applied migration."
        ((APPLIED_COUNT++))
        continue
      fi
      ((PENDING_COUNT++))

      log "→ [$v] $name"
      UP_SQL="$(extract_section "$f" Up)"
      [[ -n "$UP_SQL" ]] || die "No '-- +migrate Up' section in $base"

      if [[ "$ACTION" == "dryrun" ]]; then
        echo "---- DRY RUN: would execute ----"
        echo "$UP_SQL" | head -40
        echo "---- (truncated) ----"
        continue
      fi

      # Apply in a single transaction, timing it
      START=$(date +%s%3N)
      psql_cmd <<SQL || die "Migration $base failed — rolled back"
BEGIN;
$UP_SQL
INSERT INTO schema_migrations (version, name, checksum, duration_ms)
VALUES ('$v', '$name', '$chk', $(( $(date +%s%3N) - START )));
COMMIT;
SQL
      log "  applied"
    done
    log "Done. Already-applied: $APPLIED_COUNT. Pending/just-applied: $PENDING_COUNT."
    ;;

  rollback)
    [[ -n "$ROLLBACK_TO" ]] || die "Missing target version for rollback"
    # Roll back migrations with version > $ROLLBACK_TO, newest first
    APPLIED="$(applied_versions | sort -r)"
    for v in $APPLIED; do
      [[ "$v" > "$ROLLBACK_TO" ]] || break
      f="$(ls -1 "$MIGRATIONS_DIR"/${v}_*.sql 2>/dev/null | head -1)"
      [[ -f "$f" ]] || die "File not found for applied version $v"
      DOWN_SQL="$(extract_section "$f" Down)"
      [[ -n "$DOWN_SQL" ]] || die "No '-- +migrate Down' section in $(basename "$f")"

      log "← Rolling back $v"
      psql_cmd <<SQL || die "Rollback of $v failed"
BEGIN;
$DOWN_SQL
DELETE FROM schema_migrations WHERE version='$v';
COMMIT;
SQL
      log "  rolled back"
    done
    ;;
esac
