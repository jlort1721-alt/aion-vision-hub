#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — SSL Setup Script (Let's Encrypt)
# Domain: aionseg.co + api.aionseg.co + gw.aionseg.co
# ═══════════════════════════════════════════════════════════
set -euo pipefail

DOMAIN="aionseg.co"
EMAIL="admin@aionseg.co"
NGINX_CONF="/etc/nginx/sites-available/aion"
NGINX_ENABLED="/etc/nginx/sites-enabled/aion"
CERTBOT_WEBROOT="/var/www/certbot"

echo "═══════════════════════════════════════════════════════"
echo "  AION Vision Hub — SSL Setup"
echo "═══════════════════════════════════════════════════════"

# Step 1: Install certbot if not present
if ! command -v certbot &> /dev/null; then
    echo "[1/5] Installing certbot..."
    apt-get update -qq
    apt-get install -y certbot python3-certbot-nginx
else
    echo "[1/5] Certbot already installed"
fi

# Step 2: Create webroot directory
echo "[2/5] Creating certbot webroot..."
mkdir -p "$CERTBOT_WEBROOT"

# Step 3: Ensure HTTP server allows ACME challenge
cat > /tmp/nginx-acme-temp.conf << 'ACMEEOF'
server {
    listen 80;
    server_name aionseg.co www.aionseg.co api.aionseg.co gw.aionseg.co;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'ACME setup in progress';
        add_header Content-Type text/plain;
    }
}
ACMEEOF

# Backup current nginx config
cp "$NGINX_CONF" "${NGINX_CONF}.backup" 2>/dev/null || true
cp /tmp/nginx-acme-temp.conf "$NGINX_CONF"

# Remove default site if exists
rm -f /etc/nginx/sites-enabled/default

# Ensure symlink exists
ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

nginx -t && systemctl reload nginx

# Step 4: Obtain certificate
echo "[3/5] Obtaining Let's Encrypt certificate..."
certbot certonly --webroot \
    -w "$CERTBOT_WEBROOT" \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    -d "api.$DOMAIN" \
    -d "gw.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

# Step 5: Install full nginx config with SSL
echo "[4/5] Installing production Nginx config..."
cp /opt/aion/app/scripts/nginx-aionseg.conf "$NGINX_CONF"
nginx -t && systemctl reload nginx

# Step 6: Auto-renewal cron
echo "[5/5] Setting up auto-renewal..."
if ! crontab -l 2>/dev/null | grep -q certbot; then
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
    echo "  Auto-renewal cron added (daily at 3 AM)"
else
    echo "  Auto-renewal cron already exists"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  SSL SETUP COMPLETE"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Frontend:  https://aionseg.co"
echo "  API:       https://api.aionseg.co"
echo "  Gateway:   https://gw.aionseg.co"
echo ""
echo "  Certificate auto-renews every 90 days"
echo "═══════════════════════════════════════════════════════"
