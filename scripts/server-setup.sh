#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — VPS Server Setup (Hetzner/Ubuntu 22.04+)
# Run as root: bash server-setup.sh
# ═══════════════════════════════════════════════════════════

set -euo pipefail

echo "═══════════════════════════════════════════"
echo " AION Vision Hub — Server Setup"
echo "═══════════════════════════════════════════"

# ── 1. System Update ─────────────────────────────────────
echo "[1/10] Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Install Essential Packages ────────────────────────
echo "[2/10] Installing packages..."
apt-get install -y -qq \
  curl wget git unzip htop iotop net-tools \
  ufw fail2ban logrotate \
  nginx certbot python3-certbot-nginx \
  ca-certificates gnupg lsb-release \
  jq tree

# ── 3. Install Docker ───────────────────────────────────
echo "[3/10] Installing Docker..."
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  systemctl start docker
  echo "  Docker installed: $(docker --version)"
else
  echo "  Docker already installed: $(docker --version)"
fi

# ── 4. Install Node.js 20 + pnpm ────────────────────────
echo "[4/10] Installing Node.js 20 + pnpm..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  echo "  Node.js installed: $(node -v)"
else
  echo "  Node.js already installed: $(node -v)"
fi

npm install -g pnpm@9 --quiet 2>/dev/null || true
echo "  pnpm: $(pnpm -v 2>/dev/null || echo 'installed')"

# ── 5. Create 'aion' user ───────────────────────────────
echo "[5/10] Creating 'aion' user..."
if ! id aion &>/dev/null; then
  useradd -m -s /bin/bash -G docker,sudo aion
  AION_PASSWORD=$(openssl rand -base64 24)
  echo "aion:${AION_PASSWORD}" | chpasswd
  echo "  User 'aion' created (password: ${AION_PASSWORD})"
  echo "  ⚠️  SAVE THIS PASSWORD — it will not be shown again."
else
  usermod -aG docker aion 2>/dev/null || true
  echo "  User 'aion' already exists"
fi

# ── 6. Configure Firewall (UFW) ─────────────────────────
echo "[6/10] Configuring firewall..."
ufw --force reset >/dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 8554/tcp comment 'RTSP'
ufw allow 8889/tcp comment 'WebRTC-HTTP'
ufw allow 8889/udp comment 'WebRTC-UDP'
ufw --force enable
echo "  Firewall configured:"
ufw status numbered 2>/dev/null | head -20

# ── 7. Configure fail2ban ────────────────────────────────
echo "[7/10] Configuring fail2ban..."
cat > /etc/fail2ban/jail.local <<'JAIL'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
maxretry = 5
bantime = 3600

[nginx-http-auth]
enabled = true
port = http,https
maxretry = 10
bantime = 600

[nginx-limit-req]
enabled = true
port = http,https
maxretry = 20
findtime = 60
bantime = 600
logpath = /var/log/nginx/error.log
JAIL

systemctl enable fail2ban
systemctl restart fail2ban
echo "  fail2ban configured and active"

# ── 8. System Tuning ────────────────────────────────────
echo "[8/10] Tuning system parameters..."
cat > /etc/sysctl.d/99-aion.conf <<'SYSCTL'
# AION Vision Hub — System Tuning
fs.file-max = 1000000
fs.inotify.max_user_watches = 524288
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65536
net.ipv4.tcp_max_syn_backlog = 65536
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 5
vm.swappiness = 10
vm.overcommit_memory = 1
SYSCTL
sysctl -p /etc/sysctl.d/99-aion.conf >/dev/null 2>&1

# Increase file limits
cat > /etc/security/limits.d/99-aion.conf <<'LIMITS'
*  soft  nofile  1000000
*  hard  nofile  1000000
aion  soft  nofile  1000000
aion  hard  nofile  1000000
LIMITS
echo "  System tuning applied"

# ── 9. Create Directory Structure ────────────────────────
echo "[9/10] Creating directory structure..."
mkdir -p /opt/aion/{app,backups,logs,ssl,media}
mkdir -p /opt/aion/app/{dist,backend,scripts}
chown -R aion:aion /opt/aion
chmod 750 /opt/aion
echo "  /opt/aion/ structure created:"
tree -L 2 /opt/aion/ 2>/dev/null || ls -la /opt/aion/

# ── 10. Configure Logrotate ──────────────────────────────
echo "[10/10] Configuring logrotate..."
cat > /etc/logrotate.d/aion <<'LOGROTATE'
/opt/aion/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 640 aion aion
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid) 2>/dev/null || true
    endscript
}
LOGROTATE
echo "  Logrotate configured"

# ── Summary ──────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo " Server Setup COMPLETE"
echo "═══════════════════════════════════════════"
echo ""
echo "  OS:        $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2)"
echo "  Docker:    $(docker --version 2>/dev/null | cut -d' ' -f3)"
echo "  Node.js:   $(node -v 2>/dev/null)"
echo "  pnpm:      $(pnpm -v 2>/dev/null)"
echo "  Nginx:     $(nginx -v 2>&1 | cut -d/ -f2)"
echo "  Firewall:  $(ufw status | head -1)"
echo "  fail2ban:  $(systemctl is-active fail2ban)"
echo "  User:      aion (docker group)"
echo "  App dir:   /opt/aion/"
echo ""
echo "Next: Copy app files and configure Nginx"
