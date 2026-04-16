#!/usr/bin/env bash
# ops/backups/pre-reverse-deploy.sh
#
# Takes a full safety snapshot BEFORE any reverse-gateway change on the VPS.
# Run from the repo root or from /opt/aion/services/reverse-gateway.
#
# Produces:
#   /backup/pre-reverse-YYYYmmdd-HHMM/
#     ├── aion.dump                 pg_dump -Fc of the AION database
#     ├── aion-schemas.sql          schema-only for easy diffing
#     ├── redis-dump.rdb            redis BGSAVE copy (all DBs)
#     ├── aion-config.tar.gz        tarball of /etc/aion and /opt/aion (excl. node_modules)
#     ├── pm2-dump.json             current pm2 state
#     ├── go2rtc.yaml               existing go2rtc config
#     ├── ebs-snapshot.txt          AWS EBS snapshot id
#     └── MANIFEST.txt              SHA-256 of every file above
#
# Requires:  pg_dump, redis-cli, aws, pm2, tar, sha256sum
# Env:       AION_PG_DSN, AION_REDIS_ADDR (defaults localhost:6379),
#            AION_EBS_VOLUME_ID, AION_AWS_REGION

set -euo pipefail

: "${AION_PG_DSN:?set AION_PG_DSN}"
: "${AION_EBS_VOLUME_ID:?set AION_EBS_VOLUME_ID}"
: "${AION_AWS_REGION:?set AION_AWS_REGION}"
AION_REDIS_ADDR="${AION_REDIS_ADDR:-127.0.0.1:6379}"

STAMP="$(date -u +%Y%m%d-%H%M)"
OUT="/backup/pre-reverse-${STAMP}"
mkdir -p "$OUT"
cd "$OUT"

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }

log "1/6 pg_dump full"
pg_dump --format=custom --no-owner --no-acl --file=aion.dump "$AION_PG_DSN"
pg_dump --schema-only --no-owner --no-acl --file=aion-schemas.sql "$AION_PG_DSN"

log "2/6 redis BGSAVE"
host="${AION_REDIS_ADDR%:*}"; port="${AION_REDIS_ADDR##*:}"
redis-cli -h "$host" -p "$port" BGSAVE >/dev/null
# Wait for completion
for i in {1..30}; do
  if redis-cli -h "$host" -p "$port" INFO persistence | grep -q 'rdb_bgsave_in_progress:0'; then
    break
  fi
  sleep 1
done
# The RDB file is under /var/lib/redis by default
if [[ -r /var/lib/redis/dump.rdb ]]; then
  cp /var/lib/redis/dump.rdb ./redis-dump.rdb
else
  log "redis-dump.rdb not readable; skipping file copy (BGSAVE still took effect)"
fi

log "3/6 config tarball"
tar --exclude='node_modules' --exclude='*.log' \
    -czf aion-config.tar.gz \
    /etc/aion /opt/aion/ecosystem.config.js 2>/dev/null || true

log "4/6 pm2 dump"
pm2 jlist > pm2-dump.json

log "5/6 go2rtc config"
cp /etc/go2rtc/go2rtc.yaml ./go2rtc.yaml 2>/dev/null \
  || cp /opt/go2rtc/go2rtc.yaml ./go2rtc.yaml 2>/dev/null \
  || log "go2rtc.yaml not at expected paths; skipping"

log "6/6 EBS snapshot"
SNAP=$(aws ec2 create-snapshot \
  --region "$AION_AWS_REGION" \
  --volume-id "$AION_EBS_VOLUME_ID" \
  --description "pre-reverse-deploy ${STAMP}" \
  --query 'SnapshotId' --output text)
echo "$SNAP" > ebs-snapshot.txt
log "EBS snapshot: $SNAP"

log "writing MANIFEST"
sha256sum * > MANIFEST.txt
chmod -R a-w "$OUT"

log "BACKUP COMPLETE at $OUT"
echo
echo "Rollback primitives:"
echo "  psql \"$AION_PG_DSN\" -c 'DROP SCHEMA IF EXISTS reverse CASCADE'"
echo "  pg_restore --clean --if-exists -d \"\$AION_PG_DSN\" $OUT/aion.dump   # nuclear"
echo "  aws ec2 create-volume --snapshot-id $SNAP --availability-zone ... # roll back EBS"
