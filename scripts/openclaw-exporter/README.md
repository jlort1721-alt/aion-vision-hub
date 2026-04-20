# OpenClaw Prometheus Exporter

Reads the JSON reports OpenClaw writes to `/home/openclaw/devops/reports/` and
exposes them as Prometheus metrics on `:9109/metrics`.

**Replaces** the fake random-data exporter introduced in dc9b3ba (reverted via PR #66 on origin/main).

## Metrics

| Name | Type | Source |
|---|---|---|
| `openclaw_iteration_last_completed_at` | Gauge | `timestamp` field → Unix seconds |
| `openclaw_iteration_count` | Gauge | `iteration` field |
| `openclaw_health_errors` | Gauge | `health.errors` |
| `openclaw_proactive_alerts` | Gauge | `len(proactive_alerts)` |
| `openclaw_recent_errors_count` | Gauge | `recent_errors_count` |
| `openclaw_pm2_restarts_seen` | Gauge | `len(pm2_restarts)` |
| `openclaw_reports_dir_files` | Gauge | total JSON files in reports dir |
| `openclaw_exporter_scrape_errors_total` | Counter | read/parse errors |
| `openclaw_exporter_up` | Gauge | 1 when last scrape succeeded |

## Alert rules consuming these

From `deploy/observability/prometheus/aion-specific-alerts.yml`:

- `OpenClawIterationsStalled`: `(time() - openclaw_iteration_last_completed_at) > 5400`

Other alerts in that file (`DVRLockoutDetected`, `ImouHlsUrlsExpiringSoon`, `SnapshotDirectoryEmpty`, `OpenClawGatewayDown`) depend on metrics emitted by OTHER exporters (hik-sdk-worker, backend-api `/metrics`, textfile collector, blackbox). This exporter only owns the `openclaw_*` namespace.

## Deploy

```bash
# From the repo root, as a local dev pushing to the VPS
scp scripts/openclaw-exporter/exporter.py \
    aion-vps:/tmp/exporter.py

ssh aion-vps '
  sudo mkdir -p /opt/aion/openclaw-exporter
  sudo mv /tmp/exporter.py /opt/aion/openclaw-exporter/exporter.py
  sudo chown root:root /opt/aion/openclaw-exporter/exporter.py
  sudo chmod 755 /opt/aion/openclaw-exporter/exporter.py

  # Install prometheus_client if missing
  sudo -u openclaw python3 -c "import prometheus_client" 2>/dev/null \
    || sudo apt-get install -y python3-prometheus-client

  # Unit
  sudo systemctl unmask openclaw-exporter 2>/dev/null || true
'

scp scripts/openclaw-exporter/openclaw-exporter.service aion-vps:/tmp/unit
ssh aion-vps '
  sudo mv /tmp/unit /etc/systemd/system/openclaw-exporter.service
  sudo chown root:root /etc/systemd/system/openclaw-exporter.service
  sudo chmod 644 /etc/systemd/system/openclaw-exporter.service
  sudo systemctl daemon-reload
  sudo systemctl enable --now openclaw-exporter
  systemctl is-active openclaw-exporter
'
```

## Verify

```bash
ssh aion-vps 'curl -sS http://127.0.0.1:9109/metrics | grep ^openclaw_'
# Expected output (non-zero, non-random):
# openclaw_iteration_last_completed_at  1.7766xxxxe+09
# openclaw_iteration_count              {some int like 145}
# openclaw_health_errors                99.0
# openclaw_exporter_up                  1.0
```

## Prometheus scrape config

Add to `/opt/aion/observability/prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: openclaw
    static_configs:
      - targets: ['127.0.0.1:9109']
    scrape_interval: 30s
```

Reload Prometheus: `curl -X POST http://127.0.0.1:9090/-/reload` (or `docker restart prometheus`).

## Rollback

```bash
sudo systemctl stop openclaw-exporter
sudo systemctl disable openclaw-exporter
sudo mv /etc/systemd/system/openclaw-exporter.service \
        /root/trash-2026-04-20/
sudo rm -rf /opt/aion/openclaw-exporter
sudo systemctl daemon-reload
```

The alerts consuming `openclaw_*` become stale but don't break Prometheus.

## Security

- Unit runs as `User=openclaw` (no privileges).
- `ReadOnlyPaths=/home/openclaw/devops/reports` — exporter can read reports but not write.
- `ProtectSystem=strict`, `NoNewPrivileges=true`, `PrivateTmp=true`.
- Memory cap: 128 MB. CPU: 25%.
