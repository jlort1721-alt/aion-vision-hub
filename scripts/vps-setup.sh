#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — VPS Initial Setup Script
# Run this ONCE on a fresh Ubuntu 22.04+ VPS
# Usage: curl -sSL https://raw.githubusercontent.com/.../vps-setup.sh | bash
# ═══════════════════════════════════════════════════════════

set -euo pipefail

echo "═══════════════════════════════════════════════════════"
echo " AION Vision Hub — VPS Setup"
echo "═══════════════════════════════════════════════════════"

# ── 1. System Updates ────────────────────────────────────
echo "[1/8] Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git unzip jq htop net-tools ufw fail2ban

# ── 2. Docker Installation ───────────────────────────────
echo "[2/8] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    # Add current user to docker group
    usermod -aG docker "${SUDO_USER:-$USER}" 2>/dev/null || true
fi
echo "  Docker version: $(docker --version)"

# ── 3. Docker Compose (v2) ───────────────────────────────
echo "[3/8] Verifying Docker Compose..."
docker compose version || {
    echo "  Installing Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
}

# ── 4. Firewall Setup ────────────────────────────────────
echo "[4/8] Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # HTTP (Caddy redirect)
ufw allow 443/tcp   # HTTPS
ufw allow 443/udp   # QUIC/HTTP3
ufw allow 8554/tcp  # RTSP (only if devices connect from WAN)
ufw allow 8889/tcp  # WebRTC
ufw --force enable
echo "  Firewall configured."

# ── 5. Fail2ban ──────────────────────────────────────────
echo "[5/8] Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# ── 6. Create Application Directory ─────────────────────
echo "[6/8] Creating application directory..."
APP_DIR="/opt/aion/app"
mkdir -p "$APP_DIR"/{backend,frontend/dist,backups,logs}
mkdir -p "$APP_DIR/backend/caddy"

# ── 7. Generate Secrets ──────────────────────────────────
echo "[7/8] Generating production secrets..."
ENV_FILE="$APP_DIR/backend/.env.docker"
if [ ! -f "$ENV_FILE" ]; then
    JWT_SECRET=$(openssl rand -base64 48)
    POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '=/+')
    REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '=/+')
    CREDENTIAL_KEY=$(openssl rand -base64 48)
    WA_VERIFY=$(openssl rand -hex 16)

    cat > "$ENV_FILE" <<ENVEOF
# Generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# AION Vision Hub — Production Environment

# Domain (CHANGE THIS)
DOMAIN=app.yourdomain.com
ACME_EMAIL=admin@yourdomain.com

# Database
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Redis
REDIS_PASSWORD=${REDIS_PASSWORD}

# Auth
JWT_SECRET=${JWT_SECRET}
JWT_ISSUER=aion-vision-hub
JWT_EXPIRATION=24h

# Supabase (CHANGE THIS)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# CORS (CHANGE THIS)
CORS_ORIGINS=https://app.yourdomain.com

# Security
CREDENTIAL_ENCRYPTION_KEY=${CREDENTIAL_KEY}
RATE_LIMIT_MAX=200
LOG_LEVEL=info

# Gateway
GATEWAY_ID=gw-prod-01
DISCOVERY_NETWORK_RANGE=192.168.1.0/24

# WhatsApp (optional)
WHATSAPP_VERIFY_TOKEN=${WA_VERIFY}

# Email (optional)
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=AION Vision Hub
ENVEOF

    chmod 600 "$ENV_FILE"
    echo "  Environment file created: $ENV_FILE"
    echo "  IMPORTANT: Edit this file with your actual values!"
else
    echo "  Environment file already exists, skipping."
fi

# ── 8. System Optimizations ──────────────────────────────
echo "[8/8] Applying system optimizations..."

# Increase file descriptors (needed for many device connections)
cat >> /etc/security/limits.conf <<'EOF'
* soft nofile 65536
* hard nofile 65536
EOF

# Kernel tuning for network-heavy workloads
cat > /etc/sysctl.d/99-aion.conf <<'EOF'
# AION Vision Hub — Kernel Tuning
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15
vm.overcommit_memory = 1
vm.swappiness = 10
EOF
sysctl -p /etc/sysctl.d/99-aion.conf 2>/dev/null || true

# ── Setup cron for automated backups ─────────────────────
(crontab -l 2>/dev/null; echo "0 3 * * * cd /opt/aion/app/backend && docker compose exec -T postgres pg_dump -U aion aion_vision_hub | gzip > /opt/aion/app/backups/db-\$(date +\%Y\%m\%d-\%H\%M).sql.gz") | sort -u | crontab -
# Clean backups older than 30 days
(crontab -l 2>/dev/null; echo "0 4 * * 0 find /opt/aion/app/backups -name '*.sql.gz' -mtime +30 -delete") | sort -u | crontab -

echo ""
echo "═══════════════════════════════════════════════════════"
echo " SETUP COMPLETE"
echo "═══════════════════════════════════════════════════════"
echo ""
echo " Next steps:"
echo ""
echo " 1. Edit environment file:"
echo "    nano $ENV_FILE"
echo ""
echo " 2. Copy docker-compose.prod.yml and Caddyfile to:"
echo "    $APP_DIR/backend/"
echo ""
echo " 3. Start services:"
echo "    cd $APP_DIR/backend"
echo "    docker compose -f docker-compose.prod.yml --env-file .env.docker up -d"
echo ""
echo " 4. Configure your domain DNS:"
echo "    A record → your VPS IP"
echo "    AAAA record → your VPS IPv6 (if available)"
echo ""
echo " 5. If using Cloudflare:"
echo "    - Set SSL/TLS mode to 'Full (strict)'"
echo "    - Enable 'Always Use HTTPS'"
echo "    - Enable 'Automatic HTTPS Rewrites'"
echo ""
echo "═══════════════════════════════════════════════════════"
