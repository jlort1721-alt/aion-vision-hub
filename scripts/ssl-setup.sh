#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — SSL Setup with Let's Encrypt
# Usage: bash ssl-setup.sh DOMAIN EMAIL
# Example: bash ssl-setup.sh aion.mycompany.com admin@mycompany.com
# ═══════════════════════════════════════════════════════════

set -euo pipefail

DOMAIN="${1:?Usage: ssl-setup.sh DOMAIN EMAIL}"
EMAIL="${2:?Usage: ssl-setup.sh DOMAIN EMAIL}"

echo "═══════════════════════════════════════════"
echo " SSL Setup for $DOMAIN"
echo "═══════════════════════════════════════════"

# Request certificates for all 3 subdomains
echo "[1/3] Requesting SSL certificates..."
certbot --nginx --non-interactive --agree-tos \
  --email "$EMAIL" \
  -d "$DOMAIN" \
  -d "api.$DOMAIN" \
  -d "gw.$DOMAIN" \
  --redirect

echo "[2/3] Verifying certificates..."
for sub in "" "api." "gw."; do
  echo -n "  ${sub}${DOMAIN}: "
  if certbot certificates 2>/dev/null | grep -q "${sub}${DOMAIN}"; then
    echo "OK"
  else
    echo "WARNING - check manually"
  fi
done

# Ensure auto-renewal timer is active
echo "[3/3] Configuring auto-renewal..."
systemctl enable certbot.timer 2>/dev/null || true
systemctl start certbot.timer 2>/dev/null || true

# Test renewal
certbot renew --dry-run 2>/dev/null && echo "  Auto-renewal: OK" || echo "  Auto-renewal: check manually"

echo ""
echo "SSL Setup COMPLETE"
echo "  Certificates: /etc/letsencrypt/live/$DOMAIN/"
echo "  Auto-renewal: certbot.timer (systemd)"
