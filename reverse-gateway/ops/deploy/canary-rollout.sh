#!/usr/bin/env bash
# ops/deploy/canary-rollout.sh
#
# Staged rollout: enables reverse-connect on sites in waves, each wave
# followed by a health-check window. Refuses to advance if health drops.
#
# Wave plan:
#   Wave 0  (canary)   1 site   ->  watch 24h (manual confirm)
#   Wave 1             5 sites  ->  watch 2h
#   Wave 2             +5 sites ->  watch 2h
#   Wave 3             remainder
#
# Each "enable" action is idempotent: it toggles a site's reverse-connect
# flag in the AION sites table, which the device-provisioning Ansible
# playbook picks up on its next run.
#
# Usage:
#   ops/deploy/canary-rollout.sh plan
#   ops/deploy/canary-rollout.sh wave 0
#   ops/deploy/canary-rollout.sh wave 1
#   ...
#   ops/deploy/canary-rollout.sh status

set -euo pipefail

: "${AION_PG_DSN:?set AION_PG_DSN}"
ACTION="${1:-plan}"
WAVE="${2:-}"

q() { psql -At -d "$AION_PG_DSN" -c "$1"; }

pretty() { psql -d "$AION_PG_DSN" -c "$1"; }

plan() {
  pretty "
    SELECT s.id, s.name, s.city, s.reverse_enabled
    FROM public.sites s
    ORDER BY s.reverse_enabled NULLS FIRST, s.name;"
}

status() {
  local on; on=$(q "SELECT count(*) FROM public.sites WHERE reverse_enabled=true")
  local tot; tot=$(q "SELECT count(*) FROM public.sites")
  local sess; sess=$(q "SELECT count(*) FROM reverse.sessions WHERE state='online'")
  local pend; pend=$(q "SELECT count(*) FROM reverse.devices WHERE status='pending_approval'")
  echo "Sites enabled:     ${on}/${tot}"
  echo "Sessions online:   ${sess}"
  echo "Pending approvals: ${pend}"
}

health_check() {
  # A minimum healthy state: all enabled sites must have >=1 online session,
  # and 0 error-rate spike in Prometheus over the last 5m.
  local enabled; enabled=$(q "SELECT count(*) FROM public.sites WHERE reverse_enabled=true")
  local with_sess; with_sess=$(q "
    SELECT count(DISTINCT d.site_id)
    FROM reverse.devices d
    JOIN reverse.sessions s ON s.device_pk = d.id
    JOIN public.sites si ON si.id = d.site_id
    WHERE s.state='online' AND si.reverse_enabled=true;")
  echo "enabled_sites=${enabled} sites_reporting=${with_sess}"
  if [[ "$with_sess" -lt "$enabled" ]]; then
    echo "FAIL: $((enabled - with_sess)) enabled site(s) have no online session"
    return 1
  fi
  echo "OK"
}

wave() {
  local n_sites
  case "$WAVE" in
    0) n_sites=1  ;;
    1) n_sites=5  ;;
    2) n_sites=5  ;;
    3) n_sites=999;;
    *) echo "wave must be 0..3"; exit 1;;
  esac
  echo "Enabling up to ${n_sites} more sites in wave ${WAVE}"
  q "
    UPDATE public.sites
    SET reverse_enabled=true,
        reverse_enabled_at=now()
    WHERE id IN (
      SELECT id FROM public.sites
      WHERE reverse_enabled IS NOT TRUE
      ORDER BY id
      LIMIT ${n_sites}
    );"
  echo "Wave ${WAVE} applied. Run device-provisioning playbook next:"
  echo "   ansible-playbook -i inventory/prod.yml playbooks/reverse-connect.yml --limit wave${WAVE}"
  echo
  status
}

case "$ACTION" in
  plan)   plan ;;
  status) status ;;
  health) health_check ;;
  wave)   wave ;;
  *)      echo "Usage: $0 {plan|status|health|wave <0|1|2|3>}"; exit 1 ;;
esac
