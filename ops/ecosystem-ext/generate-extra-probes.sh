#!/usr/bin/env bash
# =============================================================================
# generate-extra-probes.sh
# -----------------------------------------------------------------------------
# Generates Prometheus scrape configs + Blackbox HTTP probes for the extra
# apps defined in apps-classified.json. Output is meant to be appended to
# /opt/aion/observability/prometheus/prometheus.yml under the existing
# scrape_configs section.
#
# Usage:
#   ./generate-extra-probes.sh apps-classified.json > /tmp/prometheus-extra.yml
#   # Then merge into prometheus.yml manually (or use yq):
#   yq eval-all 'select(fileIndex==0) *+ select(fileIndex==1)' \
#     /opt/aion/observability/prometheus/prometheus.yml /tmp/prometheus-extra.yml
# =============================================================================
set -Eeuo pipefail

INPUT="${1:?Usage: $0 <apps-classified.json>}"

cat <<'HEADER'
# ---- AION extra apps — generated probes -------------------------------------
# Append to /opt/aion/observability/prometheus/prometheus.yml under scrape_configs:
HEADER

# Blue/green pairs: scrape both colors on alternate ports
echo ""
echo "  # === Stateful blue/green apps ==========================================="
jq -c '.stateful_blue_green.apps[] | select(.name | startswith("REPLACE") | not)' "$INPUT" \
  | while IFS= read -r app; do
      name="$(echo "$app" | jq -r .name)"
      base_port="$(echo "$app" | jq -r .base_port)"
      health="$(echo "$app" | jq -r '.health_endpoint // "/metrics"')"
      cat <<JOB

  - job_name: ${name}
    metrics_path: ${health}
    static_configs:
      - targets: ['127.0.0.1:${base_port}', '127.0.0.1:$((base_port + 1))']
        labels:
          service: ${name}
          tier: stateful
JOB
    done

# Bridge singletons
echo ""
echo "  # === Bridge singletons ================================================="
jq -c '.bridge_singleton.apps[] | select(.name | startswith("REPLACE") | not)' "$INPUT" \
  | while IFS= read -r app; do
      name="$(echo "$app" | jq -r .name)"
      port="$(echo "$app" | jq -r .port)"
      health="$(echo "$app" | jq -r '.health_endpoint // "/metrics"')"
      cat <<JOB

  - job_name: ${name}
    metrics_path: ${health}
    static_configs:
      - targets: ['127.0.0.1:${port}']
        labels:
          service: ${name}
          tier: bridge
JOB
    done

# Stateless workers (usually no HTTP — only PM2 metrics via pm2_exporter)
echo ""
echo "  # === Stateless workers (covered by pm2_exporter; no direct probes) ====="
jq -r '.stateless_singleton.apps[] | select(.name | startswith("REPLACE") | not) | "  # - " + .name + " (PM2 metrics only)"' "$INPUT"

# Alert rules specific to extra apps
cat <<'ALERTS'

# ---- Append to /opt/aion/observability/prometheus/aion-alerts.yml ----------

  - name: aion.extra-apps
    interval: 30s
    rules:
      - alert: ExtraAppDown
        expr: up{tier=~"stateful|bridge"} == 0
        for: 2m
        labels:
          severity: high
        annotations:
          summary: "Extra app {{ $labels.service }} (tier={{ $labels.tier }}) down"
          runbook: https://github.com/aionseg/runbooks/blob/main/RUNBOOK_INCIDENTS.md#extra-apps

      - alert: BridgeAppFlapping
        expr: changes(up{tier="bridge"}[10m]) > 4
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Bridge {{ $labels.service }} flapping (>4 state changes in 10m)"

      - alert: StatefulAppBothColorsDown
        expr: |
          count by (service) (up{tier="stateful"} == 0)
          ==
          count by (service) (up{tier="stateful"})
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "BOTH colors down for stateful app {{ $labels.service }}"
          description: "Blue-green failed safety net — both instances are down."
ALERTS
