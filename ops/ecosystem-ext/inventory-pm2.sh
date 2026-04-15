#!/usr/bin/env bash
# =============================================================================
# inventory-pm2.sh — Classifies your running PM2 apps by deployment strategy.
# -----------------------------------------------------------------------------
# Reads pm2 jlist on the VPS and produces:
#   1. A markdown report classifying each app
#   2. A JSON file you can pipe into ecosystem.extra.config.js generator
#   3. Recommendations per app (blue-green vs singleton vs leave-alone)
#
# Usage on the VPS:
#   sudo -u aion ./inventory-pm2.sh > /tmp/pm2-inventory.md
#   sudo -u aion ./inventory-pm2.sh --json > /tmp/pm2-inventory.json
# =============================================================================
set -Eeuo pipefail

OUTPUT_FORMAT="markdown"
[[ "${1:-}" == "--json" ]] && OUTPUT_FORMAT="json"

# Apps that the v1 ecosystem.config.js already manages (blue-green pairs)
KNOWN_BG=(
  "aion-api"
  "aion-frontend"
  "aion-agent"
  "aion-model-router"
  "aion-vision-hub"
  "aion-comms"
)

# Apps that are stateful (they have in-memory state that would be lost on stop)
# → MUST use blue-green or graceful-shutdown patterns
STATEFUL_PATTERNS=(
  "n8n"              # workflow executions in flight
  "asterisk"         # active SIP calls
  "hcnet"            # HCNetSDK long-lived camera connections
  "go2rtc"           # ffmpeg/webrtc state
  "snapshot"         # in-progress snapshot captures
  "agent"            # streaming SSE responses
  "vision"           # active video sessions
  "twilio"           # in-flight webhook handlers
)

# Apps that are stateless workers (queue consumers, schedulers)
# → singleton OK, restart with normal SIGTERM grace period
STATELESS_PATTERNS=(
  "worker"
  "scheduler"
  "cron"
  "job"
  "batch"
  "indexer"
)

# Apps that are bridges to external systems (likely stateful, need careful handling)
BRIDGE_PATTERNS=(
  "bridge"
  "ingest"
  "webhook"
  "listener"
)

classify() {
  local name="$1"
  local lower
  lower="$(echo "$name" | tr '[:upper:]' '[:lower:]')"

  # Already managed by v1 ecosystem?
  for known in "${KNOWN_BG[@]}"; do
    if [[ "$lower" == "${known}-blue" ]] || [[ "$lower" == "${known}-green" ]] || [[ "$lower" == "$known" ]]; then
      echo "ALREADY_BG"
      return
    fi
  done

  # Stateful → recommend blue-green
  for p in "${STATEFUL_PATTERNS[@]}"; do
    if [[ "$lower" == *"$p"* ]]; then
      echo "STATEFUL_NEEDS_BG"
      return
    fi
  done

  # Bridge → recommend graceful-shutdown singleton with health probe
  for p in "${BRIDGE_PATTERNS[@]}"; do
    if [[ "$lower" == *"$p"* ]]; then
      echo "BRIDGE_SINGLETON"
      return
    fi
  done

  # Stateless worker → singleton OK
  for p in "${STATELESS_PATTERNS[@]}"; do
    if [[ "$lower" == *"$p"* ]]; then
      echo "STATELESS_SINGLETON"
      return
    fi
  done

  echo "UNKNOWN_REVIEW_MANUALLY"
}

# Pull pm2 inventory
PM2_DATA="$(pm2 jlist 2>/dev/null || echo '[]')"

if [[ "$OUTPUT_FORMAT" == "json" ]]; then
  echo "$PM2_DATA" | jq -c --arg ts "$(date -Is)" '
    [.[] | {
      name: .name,
      pid: .pid,
      status: .pm2_env.status,
      restart_time: .pm2_env.restart_time,
      uptime_ms: (now * 1000 - .pm2_env.pm_uptime),
      memory: .monit.memory,
      cpu: .monit.cpu,
      script: .pm2_env.pm_exec_path,
      cwd: .pm2_env.pm_cwd,
      env_NODE_ENV: .pm2_env.NODE_ENV,
      exec_mode: .pm2_env.exec_mode,
      instances: (.pm2_env.instances // 1)
    }] | { generated_at: $ts, apps: . }
  '
  exit 0
fi

# Markdown output
cat <<HEAD
# AION VPS — PM2 App Inventory

Generated: $(date -Is)
Total apps: $(echo "$PM2_DATA" | jq 'length')

## Classification

| Recommendation | Meaning |
|---|---|
| ALREADY_BG | Already in v1 ecosystem (skip) |
| STATEFUL_NEEDS_BG | Has in-memory state — needs blue-green pair |
| BRIDGE_SINGLETON | External system bridge — singleton with graceful shutdown |
| STATELESS_SINGLETON | Stateless worker — singleton with SIGTERM grace |
| UNKNOWN_REVIEW_MANUALLY | Couldn't auto-classify — you decide |

## Inventory

| App | Status | Mode | Mem (MB) | Restarts | Uptime | Recommendation |
|-----|--------|------|---------:|---------:|--------|----------------|
HEAD

echo "$PM2_DATA" | jq -r '.[] | [
  .name,
  .pm2_env.status,
  .pm2_env.exec_mode,
  ((.monit.memory // 0) / 1048576 | floor),
  (.pm2_env.restart_time // 0),
  ((now * 1000 - .pm2_env.pm_uptime) / 1000 / 3600 | floor)
] | @tsv' | while IFS=$'\t' read -r name status mode mem restarts uptime_h; do
  rec="$(classify "$name")"
  printf "| %s | %s | %s | %s | %s | %sh | %s |\n" \
    "$name" "$status" "$mode" "$mem" "$restarts" "$uptime_h" "$rec"
done

cat <<TAIL

## Next steps

1. Review each \`UNKNOWN_REVIEW_MANUALLY\` row and decide its category.
2. Move each app's classification to \`apps-classified.json\` (template provided).
3. Run \`generate-ecosystem-extra.sh\` to produce \`ecosystem.extra.config.js\`.
4. Test in dev: \`pm2 start ecosystem.extra.config.js --env staging\`
5. Rotate to prod with: \`pm2 reload ecosystem.extra.config.js --env production\`

## Notes on classifications

- **STATEFUL_NEEDS_BG**: drainage required. Examples: n8n (active workflow runs),
  asterisk (live SIP calls), agent SSE streams, snapshot processors mid-write,
  go2rtc with ffmpeg children. Restarting these without a blue-green swap loses data.

- **BRIDGE_SINGLETON**: external system holds connection state on the OTHER side,
  so a duplicate (blue+green simultaneously) would create double-handlers.
  Examples: webhook ingestors, MQTT bridges. These need fast restart but NOT
  duplicate instances. Use \`kill_timeout\` + \`wait_ready\` for graceful drain.

- **STATELESS_SINGLETON**: queue consumers (BullMQ, Redis Streams, etc.) where
  multiple instances would just compete for jobs. Restart is safe because in-flight
  jobs get re-queued on SIGTERM.
TAIL
