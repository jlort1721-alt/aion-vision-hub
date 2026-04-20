# Apply AION-specific alert rules

**Target:** VPS `aion-vps`, Prometheus config at `/opt/aion/observability/prometheus/aion-alerts.yml`.

**Source:** `deploy/observability/prometheus/aion-specific-alerts.yml`.

---

## 1. Context

Alertmanager + Prometheus + Grafana ya corren (docker-compose `aion-*` stack).
Este runbook aplica 5 alertas adicionales detectadas en la auditoría 2026-04-19:

| Alert | Qué detecta |
|---|---|
| `DVRLockoutDetected` | Workers Hik reciben `NET_DVR_USER_LOCKED` — pausa inmediata |
| `OpenClawGatewayDown` | /health no responde 200 |
| `OpenClawIterationsStalled` | El loop cada 30 min dejó de avanzar |
| `ImouHlsUrlsExpiringSoon` | URL firmada caduca en <30 min |
| `SnapshotDirectoryEmpty` | El watcher no ve JPGs en 10 min |

Las alertas enganchan directamente al routing existente (`severity: high|critical`
→ Slack `#aion-alerts` + email; `critical` además WhatsApp oncall).

---

## 2. Precondiciones de métricas

| Alerta | Métrica requerida | Dónde se produce |
|---|---|---|
| DVRLockoutDetected | `aion_hik_login_errors_total{error="..."}` | hik-sdk-worker (ya implementado — verificar exposición en `:9100`) |
| OpenClawGatewayDown | `probe_success{job="blackbox-openclaw"}` | Añadir target a blackbox-exporter (ver §3.1) |
| OpenClawIterationsStalled | `openclaw_iteration_last_completed_at` | Custom exporter P2.3 (pendiente — ver audit MD) |
| ImouHlsUrlsExpiringSoon | `aion_device_hls_expires_at` | Exporter en backend-api que lea `devices.hls_expires_at` |
| SnapshotDirectoryEmpty | `aion_snapshots_file_count` | Node exporter textfile collector (ver §3.2) |

Las alertas que dependen de métricas aún no expuestas quedan inertes (no disparan) hasta que los exporters estén en su sitio. Seguir el orden:

1. Añadir targets blackbox (§3.1) — habilita `OpenClawGatewayDown`.
2. Desplegar textfile collector snapshots (§3.2) — habilita `SnapshotDirectoryEmpty`.
3. Desplegar OpenClaw exporter Python (P2.3 separado) — habilita `OpenClawIterationsStalled`.
4. Backend endpoint `/metrics` con HLS expires — habilita `ImouHlsUrlsExpiringSoon`.

---

## 3. Aplicar rules sin exporters aún

```bash
ssh aion-vps
# 1. Subir archivo
scp deploy/observability/prometheus/aion-specific-alerts.yml \
  aion-vps:/tmp/aion-specific-alerts.yml
sudo mv /tmp/aion-specific-alerts.yml /opt/aion/observability/prometheus/aion-specific-alerts.yml
sudo chown ubuntu:ubuntu /opt/aion/observability/prometheus/aion-specific-alerts.yml

# 2. Referenciar desde prometheus.yml (una sola vez)
sudo bash -c '
  if ! grep -q aion-specific-alerts.yml /opt/aion/observability/prometheus/prometheus.yml; then
    sed -i "/^rule_files:/a\\  - /etc/prometheus/aion-specific-alerts.yml" /opt/aion/observability/prometheus/prometheus.yml
  fi
'

# 3. Reload Prometheus sin restart
curl -sS -X POST http://127.0.0.1:9090/-/reload

# 4. Validar que las rules cargaron
curl -sS http://127.0.0.1:9090/api/v1/rules | \
  jq '.data.groups[] | select(.name=="aion-specific") | .rules[].name'
# Debe listar: DVRLockoutDetected OpenClawGatewayDown OpenClawIterationsStalled ...
```

### 3.1 Blackbox target para OpenClaw

En `/opt/aion/observability/prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: blackbox-openclaw
    metrics_path: /probe
    params: {module: [http_2xx]}
    static_configs:
      - targets: ['http://127.0.0.1:18789/health']
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox:9115
```

### 3.2 Textfile collector para snapshots

```bash
ssh aion-vps
sudo tee /etc/cron.d/aion-snapshot-count <<'CRON'
* * * * * nobody set -e; \
  c=$(find /var/www/aionseg/frontend/snapshots -maxdepth 2 -name "*.jpg" -mmin -5 2>/dev/null | wc -l); \
  echo "# HELP aion_snapshots_file_count Snapshots modified within last 5 min" > /var/lib/node_exporter/textfile/aion_snapshots.prom.tmp; \
  echo "# TYPE aion_snapshots_file_count gauge" >> /var/lib/node_exporter/textfile/aion_snapshots.prom.tmp; \
  echo "aion_snapshots_file_count{path=\"/var/www/aionseg/frontend/snapshots\"} $c" >> /var/lib/node_exporter/textfile/aion_snapshots.prom.tmp; \
  mv /var/lib/node_exporter/textfile/aion_snapshots.prom.tmp /var/lib/node_exporter/textfile/aion_snapshots.prom
CRON
sudo install -d -o nobody -g nogroup /var/lib/node_exporter/textfile
```

Requiere que `node-exporter` container esté iniciado con
`--collector.textfile.directory=/host/textfile` montando ese path.

---

## 4. Verificar en Alertmanager UI

1. `https://grafana.aionseg.co/alertmanager` (o túnel `ssh -L 9093:127.0.0.1:9093 aion-vps`).
2. Tab **Status** → confirma receivers `#aion-alerts`, `#aion-incidents`.
3. Tab **Silences** → crear silence temporal durante mantenimiento si hace falta.
4. Simular un disparo:

```bash
# Falso positivo controlado: cambia blackbox target a 127.0.0.1:1 por 4 min
```

## 5. Rollback

Si alguna regla mete ruido (flapping):

```bash
ssh aion-vps
sudo sed -i '/- \/etc\/prometheus\/aion-specific-alerts.yml/d' /opt/aion/observability/prometheus/prometheus.yml
sudo rm /opt/aion/observability/prometheus/aion-specific-alerts.yml
curl -sS -X POST http://127.0.0.1:9090/-/reload
```

---

## 6. Slack webhook

El webhook a `#aion-alerts` ya está configurado en alertmanager.yml y **no se muestra aquí** por política de secrets. Para rotarlo:

1. Slack Admin → `api.slack.com/apps` → la app "AION Alerts" → Incoming Webhooks → Regenerate.
2. `sudoedit /opt/aion/observability/alertmanager/alertmanager.yml` — actualizar los `api_url:`.
3. `docker restart alertmanager` (toma 5 s, no pierde alertas pendientes).

> **Observación de auditoría (2026-04-20):** el Bearer credential para el webhook
> `aion-comms:3300/api/alerts/whatsapp-oncall` aparece en la unit actual. Recomendado
> rotar y pasar a `EnvironmentFile` tipo vault similar a P0.1 OpenClaw.
