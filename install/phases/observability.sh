#!/usr/bin/env bash
# install/phases/observability.sh — deploy Prometheus/Grafana/Alertmanager/Blackbox/exporters.
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname "$0")/../lib/common.sh"

V3="$(bundles_dir)/v3-observability"
OBS="$AION_ROOT/observability"

log "Copying observability bundle to $OBS..."
sudo -u "$AION_USER" mkdir -p \
  "$OBS/prometheus" "$OBS/alertmanager" "$OBS/blackbox" \
  "$OBS/exporters"  "$OBS/grafana/dashboards" \
  "$OBS/grafana/provisioning/datasources" "$OBS/grafana/provisioning/dashboards"

install_file "$V3/observability/docker-compose.yml" "$OBS/docker-compose.yml" 0644 "${AION_USER}:${AION_USER}"

# Prometheus
for f in prometheus.yml aion-alerts.yml targets-public.yml targets-authed.yml; do
  install_file "$V3/observability/prometheus/$f" "$OBS/prometheus/$f" 0644 "${AION_USER}:${AION_USER}"
done

# Alertmanager
install_file "$V3/observability/alertmanager/alertmanager.yml" "$OBS/alertmanager/alertmanager.yml" 0644 "${AION_USER}:${AION_USER}"
install_file "$V3/observability/alertmanager/aion.tmpl"        "$OBS/alertmanager/aion.tmpl"        0644 "${AION_USER}:${AION_USER}"

# Blackbox
install_file "$V3/observability/blackbox/blackbox.yml" "$OBS/blackbox/blackbox.yml" 0644 "${AION_USER}:${AION_USER}"

# Exporters
install_file "$V3/observability/exporters/pm2_exporter.js"          "$OBS/exporters/pm2_exporter.js"          0644 "${AION_USER}:${AION_USER}"
install_file "$V3/observability/exporters/aion_custom_exporter.js"  "$OBS/exporters/aion_custom_exporter.js"  0644 "${AION_USER}:${AION_USER}"

# Grafana
install_file "$V3/observability/grafana/dashboards/aion-overview.json"   "$OBS/grafana/dashboards/aion-overview.json"   0644 "${AION_USER}:${AION_USER}"
install_file "$V3/observability/grafana/dashboards/aion-vision-hub.json" "$OBS/grafana/dashboards/aion-vision-hub.json" 0644 "${AION_USER}:${AION_USER}"
install_file "$V3/observability/grafana/provisioning/datasources/prometheus.yml" "$OBS/grafana/provisioning/datasources/prometheus.yml" 0644 "${AION_USER}:${AION_USER}"
install_file "$V3/observability/grafana/provisioning/dashboards/provider.yml"    "$OBS/grafana/provisioning/dashboards/provider.yml"    0644 "${AION_USER}:${AION_USER}"

# .env file
if [[ ! -f "$OBS/.env" ]]; then
  log "Generating $OBS/.env from template (with random passwords)..."
  cp "$V3/observability/.env.example" "$OBS/.env"
  chmod 600 "$OBS/.env"
  chown "${AION_USER}:${AION_USER}" "$OBS/.env"

  # Generate random passwords for placeholders
  GRAFANA_PASS="$(openssl rand -base64 24 | tr -d /+= | head -c 24)"
  PG_RO_PASS="$(openssl rand -base64 24   | tr -d /+= | head -c 24)"
  AM_BEARER="$(openssl rand -hex 32)"

  sed -i "s|GRAFANA_ADMIN_PASS=.*|GRAFANA_ADMIN_PASS=${GRAFANA_PASS}|" "$OBS/.env"
  sed -i "s|PG_GRAFANA_PASS=CHANGEME|PG_GRAFANA_PASS=${PG_RO_PASS}|"   "$OBS/.env"
  sed -i "s|ALERTMANAGER_BEARER=.*|ALERTMANAGER_BEARER=${AM_BEARER}|"  "$OBS/.env"

  ok ".env created — Grafana admin pass: $GRAFANA_PASS"
  warn "Edit $OBS/.env to set: SLACK_WEBHOOK_URL, SENDGRID_API_KEY, QA_BOT_BEARER, AION_DB_URL_RO"
else
  ok ".env exists — keeping as-is"
fi

# Create read-only DB role for exporters/Grafana
log "Creating PostgreSQL read-only role aion_grafana_ro..."
PG_RO_PASS="$(grep '^PG_GRAFANA_PASS=' "$OBS/.env" | cut -d= -f2-)"
psql "${DATABASE_URL:?}" -v ON_ERROR_STOP=1 <<SQL || warn "Could not create role (may already exist)"
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='aion_grafana_ro') THEN
    CREATE ROLE aion_grafana_ro LOGIN PASSWORD '${PG_RO_PASS}';
  ELSE
    ALTER ROLE aion_grafana_ro WITH PASSWORD '${PG_RO_PASS}';
  END IF;
END\$\$;
GRANT pg_read_all_stats, pg_monitor TO aion_grafana_ro;
GRANT CONNECT ON DATABASE aion TO aion_grafana_ro;
GRANT USAGE ON SCHEMA public TO aion_grafana_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO aion_grafana_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO aion_grafana_ro;
SQL
ok "DB role aion_grafana_ro configured"

# Set AION_DB_URL_RO if not set
if grep -q '^AION_DB_URL_RO=postgres://aion_grafana_ro:CHANGEME' "$OBS/.env"; then
  sed -i "s|AION_DB_URL_RO=postgres://aion_grafana_ro:CHANGEME|AION_DB_URL_RO=postgres://aion_grafana_ro:${PG_RO_PASS}|" "$OBS/.env"
fi

# Add nginx stub_status block (idempotent)
if ! grep -q "location /stub_status" /etc/nginx/sites-available/default 2>/dev/null; then
  log "Adding stub_status to nginx default site..."
  cat > /etc/nginx/conf.d/stub_status.conf <<'EOF'
server {
    listen 127.0.0.1:8088;
    server_name localhost;
    location /stub_status {
        stub_status;
        allow 127.0.0.1;
        allow 172.16.0.0/12;
        deny all;
    }
}
EOF
  nginx -t && systemctl reload nginx
fi

# Validate compose file
log "Validating docker-compose.yml..."
cd "$OBS"
if sudo -u "$AION_USER" docker compose config --quiet 2>&1; then
  ok "docker-compose.yml is valid"
else
  warn "docker-compose validation reported issues — review .env"
fi

log "Bringing up observability stack..."
sudo -u "$AION_USER" docker compose up -d
ok "Stack started"

log "Waiting for services to be ready..."
sleep 5

# Health checks
declare -A SERVICES=(
  [Prometheus]="http://127.0.0.1:9090/-/ready"
  [Alertmanager]="http://127.0.0.1:9093/-/ready"
  [Blackbox]="http://127.0.0.1:9115/-/healthy"
  [Node-exporter]="http://127.0.0.1:9100/metrics"
  [PM2-exporter]="http://127.0.0.1:9209/metrics"
  [AION-exporter]="http://127.0.0.1:9210/metrics"
  [Grafana]="http://127.0.0.1:3009/api/health"
)

for name in "${!SERVICES[@]}"; do
  if wait_http_ok "${SERVICES[$name]}" 30 2; then
    ok "$name: UP"
  else
    warn "$name: not responding (${SERVICES[$name]})"
  fi
done

log ""
log "Observability stack ready. Access locally:"
log "  Prometheus:   http://127.0.0.1:9090"
log "  Alertmanager: http://127.0.0.1:9093"
log "  Grafana:      http://127.0.0.1:3009  (admin / see $OBS/.env)"
log ""
log "To expose externally, add nginx server blocks for:"
log "  metrics.aionseg.co -> 127.0.0.1:3009"
log "  alerts.aionseg.co  -> 127.0.0.1:9093"

ok "Observability phase complete."
