#!/usr/bin/env bash
# install/phases/system.sh — install OS deps, create aion user, basic dirs.
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname "$0")/../lib/common.sh"

log "Installing OS packages (apt)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
  ca-certificates curl wget gnupg lsb-release \
  jq tar gzip openssl unzip git build-essential \
  postgresql-client \
  nginx \
  certbot python3-certbot-nginx \
  ufw fail2ban \
  cron \
  python3 python3-pip python3-yaml
ok "Base packages installed"

# Node.js 20 + pnpm
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 20 ]]; then
  log "Installing Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
ok "Node.js: $(node -v)"

if ! command -v pnpm >/dev/null 2>&1; then
  log "Installing pnpm..."
  npm install -g pnpm@9
fi
ok "pnpm: $(pnpm -v)"

if ! command -v pm2 >/dev/null 2>&1; then
  log "Installing PM2..."
  npm install -g pm2@latest
fi
ok "PM2: $(pm2 -v)"

# Docker
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi
ok "Docker: $(docker --version | awk '{print $3}' | tr -d ,)"

# Create aion user if missing
if ! id "$AION_USER" &>/dev/null; then
  log "Creating user '$AION_USER'..."
  useradd -r -m -d /home/"$AION_USER" -s /bin/bash "$AION_USER"
  usermod -aG docker "$AION_USER"
fi
ok "User: $AION_USER"

# Create AION directory tree
log "Creating directory tree under $AION_ROOT..."
ensure_dir "$AION_ROOT"
ensure_dir "$AION_ROOT/scripts"
ensure_dir "$AION_ROOT/snapshots"
ensure_dir "$AION_ROOT/db/migrations"
ensure_dir "$AION_ROOT/db/scripts"
ensure_dir "$AION_ROOT/db/seeds"
ensure_dir "$AION_ROOT/qa"
ensure_dir "$AION_ROOT/qa/tests/e2e"
ensure_dir "$AION_ROOT/observability"
ensure_dir "$AION_ROOT/runbooks"
ensure_dir "$AION_ROOT/validation"
ensure_dir "$LOG_DIR"
ensure_dir "/var/run/aion"
ensure_dir "/etc/nginx/aion-upstreams"
ensure_dir "/etc/nginx/snippets"

chown -R "${AION_USER}:${AION_USER}" "$AION_ROOT" "$LOG_DIR" "/var/run/aion"
ok "Directories created"

# Firewall (idempotent)
if ! ufw status | grep -q "Status: active"; then
  log "Configuring UFW firewall..."
  ufw --force allow OpenSSH
  ufw --force allow 80/tcp
  ufw --force allow 443/tcp
  ufw --force enable
fi
ok "Firewall: $(ufw status | head -1)"

# fail2ban for nginx + ssh
if ! service_up fail2ban; then
  log "Enabling fail2ban..."
  systemctl enable --now fail2ban
fi
ok "fail2ban: $(systemctl is-active fail2ban)"

# PM2 systemd integration (so pm2 survives reboot)
if ! systemctl is-enabled pm2-"$AION_USER".service &>/dev/null; then
  log "Enabling PM2 systemd integration..."
  sudo -u "$AION_USER" pm2 startup systemd -u "$AION_USER" --hp "/home/$AION_USER" \
    | grep -E '^sudo' | bash || true
fi
ok "PM2 systemd integration"

# Logrotate for AION logs
cat > /etc/logrotate.d/aion <<'EOF'
/var/log/aion/*.log {
  daily
  rotate 14
  compress
  delaycompress
  missingok
  notifempty
  copytruncate
  su aion aion
}
EOF
ok "Logrotate configured"

ok "System phase complete."
