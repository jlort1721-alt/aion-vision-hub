#!/usr/bin/env bash
# install/lib/state.sh — track which phases have been installed.
# State stored as JSON: /var/lib/aion-install/state.json

# Initialize state file if missing
init_state() {
  if [[ ! -f "$STATE_FILE" ]]; then
    mkdir -p "$(dirname "$STATE_FILE")"
    cat > "$STATE_FILE" <<EOF
{
  "version": "${INSTALL_VERSION}",
  "first_install": "$(date -Is)",
  "phases": {}
}
EOF
  fi
}

mark_phase_complete() {
  local phase="$1"
  init_state
  local tmp="${STATE_FILE}.tmp"
  jq --arg p "$phase" --arg ts "$(date -Is)" --arg run "$RUN_ID" '
    .phases[$p] = { status: "complete", completed_at: $ts, run_id: $run }
  ' "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

mark_phase_failed() {
  local phase="$1"
  init_state
  local tmp="${STATE_FILE}.tmp"
  jq --arg p "$phase" --arg ts "$(date -Is)" --arg run "$RUN_ID" '
    .phases[$p] = { status: "failed", failed_at: $ts, run_id: $run }
  ' "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

is_phase_complete() {
  local phase="$1"
  [[ -f "$STATE_FILE" ]] || return 1
  [[ "$(jq -r --arg p "$phase" '.phases[$p].status // ""' "$STATE_FILE")" == "complete" ]]
}

all_phases_complete() {
  for p in "${PHASES[@]}"; do
    is_phase_complete "$p" || return 1
  done
  return 0
}

# Snapshot what we're about to change for a phase (so uninstall/rollback knows)
snapshot_phase() {
  local phase="$1"
  local snap_dir="/opt/aion/snapshots/install-${RUN_ID}/${phase}"
  mkdir -p "$snap_dir"

  case "$phase" in
    deploy)
      [[ -d /etc/nginx ]] && tar -czf "$snap_dir/nginx.tar.gz" /etc/nginx/ 2>/dev/null || true
      pm2 save 2>/dev/null && cp ~/.pm2/dump.pm2 "$snap_dir/pm2-dump.json" 2>/dev/null || true
      ;;
    migrate-rls)
      pg_dump -U aion -d aion -Fc -f "$snap_dir/db-pre-rls.dump" 2>/dev/null || \
        warn "Could not dump DB (continuing — migration is transactional)"
      ;;
    observability)
      [[ -d /opt/aion/observability ]] && tar -czf "$snap_dir/observability.tar.gz" /opt/aion/observability/ 2>/dev/null || true
      ;;
  esac
}

show_status() {
  init_state
  log "═════════════════════════════════════════════════"
  log "AION Platform Installation Status"
  log "═════════════════════════════════════════════════"
  log "First install: $(jq -r '.first_install' "$STATE_FILE")"
  log ""
  log "Phases:"
  for p in "${PHASES[@]}"; do
    local status completed_at run_id
    status="$(jq -r --arg p "$p" '.phases[$p].status // "pending"' "$STATE_FILE")"
    completed_at="$(jq -r --arg p "$p" '.phases[$p].completed_at // .phases[$p].failed_at // "—"' "$STATE_FILE")"
    run_id="$(jq -r --arg p "$p" '.phases[$p].run_id // "—"' "$STATE_FILE")"
    case "$status" in
      complete) printf "  %s✓%s %-18s  %s  run=%s\n" "$GREEN" "$RESET" "$p" "$completed_at" "$run_id" ;;
      failed)   printf "  %s✗%s %-18s  %s  run=%s\n" "$RED"   "$RESET" "$p" "$completed_at" "$run_id" ;;
      *)        printf "  %s○%s %-18s  pending\n"           "$YELLOW" "$RESET" "$p" ;;
    esac
  done
  log "═════════════════════════════════════════════════"
}
