#!/usr/bin/env bash
# install/phases/deploy.sh — install PM2 ecosystem, nginx config, deploy/rollback.
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname "$0")/../lib/common.sh"

V1="$(bundles_dir)/v1-deploy"

log "Installing PM2 ecosystem..."
install_file "$V1/pm2/ecosystem.config.js" "$AION_ROOT/ecosystem.config.js" 0644 "${AION_USER}:${AION_USER}"

log "Installing deploy/rollback scripts..."
install_file "$V1/scripts/deploy.sh"   "$AION_ROOT/scripts/deploy.sh"   0755 "${AION_USER}:${AION_USER}"
install_file "$V1/scripts/rollback.sh" "$AION_ROOT/scripts/rollback.sh" 0755 "${AION_USER}:${AION_USER}"

log "Installing nginx blue/green upstreams..."
install_file "$V1/nginx/blue.conf"        "/etc/nginx/aion-upstreams/blue.conf"  0644
install_file "$V1/nginx/green.conf"       "/etc/nginx/aion-upstreams/green.conf" 0644
install_file "$V1/nginx/aion-proxy.conf"  "/etc/nginx/snippets/aion-proxy.conf"  0644
install_file "$V1/nginx/aionseg.co.conf"  "/etc/nginx/sites-available/aionseg.co" 0644

# Activate site
if [[ ! -L /etc/nginx/sites-enabled/aionseg.co ]]; then
  ln -sfn /etc/nginx/sites-available/aionseg.co /etc/nginx/sites-enabled/aionseg.co
  ok "nginx site enabled"
fi

# Set initial color = blue if no symlink yet
if [[ ! -L /etc/nginx/conf.d/aion-upstream.conf ]]; then
  ln -sfn /etc/nginx/aion-upstreams/blue.conf /etc/nginx/conf.d/aion-upstream.conf
  ok "Initial color: blue"
fi

# Disable default nginx site (it grabs port 80 too)
if [[ -L /etc/nginx/sites-enabled/default ]]; then
  rm /etc/nginx/sites-enabled/default
  log "Disabled default nginx site"
fi

log "Validating nginx config..."
if nginx -t 2>&1 | tee /tmp/nginx-test.log | grep -q "test is successful"; then
  ok "nginx -t: passed"
  systemctl reload nginx || systemctl restart nginx
else
  warn "nginx -t failed — see /tmp/nginx-test.log"
  cat /tmp/nginx-test.log
  warn "Continuing — fix nginx config manually before tying real traffic"
fi

log "Installing smoke validation script..."
install_file "$V1/validation/smoke.py" "$AION_ROOT/validation/smoke.py" 0755 "${AION_USER}:${AION_USER}"

# Install Python deps for smoke.py
sudo -u "$AION_USER" pip install --quiet --break-system-packages --user httpx[http2] 2>&1 | tail -2 || true

# TLS — only if not already provisioned
if [[ ! -d /etc/letsencrypt/live/aionseg.co ]]; then
  log "Provisioning TLS via certbot (will use webroot)..."
  warn "Skipping certbot — must be done manually with: sudo certbot --nginx -d aionseg.co -d www.aionseg.co"
  warn "Then re-run this phase or 'sudo systemctl reload nginx'"
else
  ok "TLS already provisioned"
fi

# Note: PM2 apps not started here — they require the actual codebase deployed
# at /opt/aion/{api,frontend,agent,...}. The ecosystem.config.js is installed
# so that when the codebase arrives (via separate git clone or CI deploy),
# PM2 will work.
log ""
log "Note: PM2 apps NOT started — the AION codebase must be at:"
log "  $AION_ROOT/{api,frontend,agent,model-router,vision-hub,comms,worker,scheduler}"
log ""
log "After your code is deployed, run:"
log "  sudo -u $AION_USER pm2 start $AION_ROOT/ecosystem.config.js --env production"
log "  sudo -u $AION_USER pm2 save"

ok "Deploy phase complete."
