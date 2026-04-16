#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# AION — Deploy Dahua REGISTRO (Active Registration)
# Run on VPS: bash deploy-dahua-registro.sh
# ═══════════════════════════════════════════════════════════
set -euo pipefail

echo "══════════════════════════════════════════"
echo "  AION — Dahua REGISTRO Deploy"
echo "══════════════════════════════════════════"

GO2RTC_CONFIG="/etc/go2rtc/go2rtc.yaml"
GO2RTC_BACKUP="/etc/go2rtc/go2rtc.yaml.bak.$(date +%Y%m%d_%H%M%S)"

# ── Step 1: Backup go2rtc config ──────────────────────────
echo ""
echo "[1/6] Backing up go2rtc config..."
if [ -f "$GO2RTC_CONFIG" ]; then
  sudo cp "$GO2RTC_CONFIG" "$GO2RTC_BACKUP"
  echo "  Backup: $GO2RTC_BACKUP"
else
  echo "  WARNING: go2rtc config not found at $GO2RTC_CONFIG"
  echo "  Trying alternative locations..."
  for alt in /opt/aion/go2rtc/go2rtc.yaml /home/ubuntu/go2rtc.yaml /etc/go2rtc.yaml; do
    if [ -f "$alt" ]; then
      GO2RTC_CONFIG="$alt"
      GO2RTC_BACKUP="${alt}.bak.$(date +%Y%m%d_%H%M%S)"
      sudo cp "$GO2RTC_CONFIG" "$GO2RTC_BACKUP"
      echo "  Found at: $GO2RTC_CONFIG"
      break
    fi
  done
fi

# ── Step 2: Add dvrip listener to go2rtc ──────────────────
echo ""
echo "[2/6] Adding dvrip listener to go2rtc config..."
if grep -q "dvrip:" "$GO2RTC_CONFIG" 2>/dev/null; then
  echo "  dvrip section already exists — skipping"
else
  # Add dvrip section before the streams: section
  sudo sed -i '/^streams:/i \
# Dahua REGISTRO (Active Registration) — DVRs connect outbound to this port\
dvrip:\
  listen: ":5000"\
' "$GO2RTC_CONFIG"
  echo "  Added dvrip: listen: ':5000'"
fi

# Verify
echo "  Verifying config..."
if grep -q 'listen.*5000' "$GO2RTC_CONFIG"; then
  echo "  ✓ dvrip listener configured on port 5000"
else
  echo "  ✗ FAILED to add dvrip listener — check $GO2RTC_CONFIG manually"
  exit 1
fi

# ── Step 3: Open firewall port 5000 ──────────────────────
echo ""
echo "[3/6] Opening firewall port 5000/tcp..."
if sudo ufw status | grep -q "5000/tcp"; then
  echo "  Port 5000 already open"
else
  sudo ufw allow 5000/tcp comment "Dahua REGISTRO (dvrip)"
  echo "  ✓ Port 5000/tcp opened"
fi

echo ""
echo "  ⚠ REMINDER: Also open port 5000/tcp in AWS Security Group!"
echo "    Console: https://console.aws.amazon.com/ec2/"
echo "    Security Group → Inbound → Add Rule → Custom TCP 5000 from 0.0.0.0/0"

# ── Step 4: Restart go2rtc ────────────────────────────────
echo ""
echo "[4/6] Restarting go2rtc..."
if systemctl is-active --quiet go2rtc; then
  sudo systemctl restart go2rtc
  sleep 3
  if systemctl is-active --quiet go2rtc; then
    echo "  ✓ go2rtc restarted successfully"
  else
    echo "  ✗ go2rtc failed to start — check: sudo journalctl -u go2rtc -n 30"
    exit 1
  fi
elif pm2 list 2>/dev/null | grep -q "go2rtc"; then
  pm2 restart go2rtc
  sleep 3
  echo "  ✓ go2rtc restarted via PM2"
else
  echo "  ⚠ go2rtc not found as systemd service or PM2 process"
  echo "  Please restart go2rtc manually"
fi

# ── Step 5: Verify dvrip listener is active ───────────────
echo ""
echo "[5/6] Verifying dvrip listener..."
sleep 2
if curl -s http://localhost:1984/api/config 2>/dev/null | grep -q "5000"; then
  echo "  ✓ dvrip listener active on port 5000"
elif ss -tlnp | grep -q ":5000"; then
  echo "  ✓ Port 5000 is listening"
else
  echo "  ⚠ Port 5000 not detected — go2rtc may not support dvrip in this version"
  echo "  Current version:"
  go2rtc --version 2>/dev/null || echo "  (version not available)"
  echo ""
  echo "  If dvrip is not supported, upgrade go2rtc:"
  echo "    sudo wget -O /usr/local/bin/go2rtc https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_linux_amd64"
  echo "    sudo chmod +x /usr/local/bin/go2rtc"
  echo "    sudo systemctl restart go2rtc"
fi

# ── Step 6: Seed Dahua cameras in database ────────────────
echo ""
echo "[6/6] Seeding Dahua cameras in database..."
APP_DIR="/opt/aion/app"
if [ -d "$APP_DIR/backend" ]; then
  cd "$APP_DIR/backend"
  npx tsx ../scripts/seed-dahua-cameras.ts 2>&1 || echo "  ⚠ Seed script failed — run manually"
elif [ -d "/var/www/aion/backend" ]; then
  cd /var/www/aion/backend
  npx tsx ../scripts/seed-dahua-cameras.ts 2>&1 || echo "  ⚠ Seed script failed — run manually"
else
  echo "  ⚠ App directory not found — run seed script manually:"
  echo "    cd backend && npx tsx ../scripts/seed-dahua-cameras.ts"
fi

# ── Summary ───────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "  Deploy complete!"
echo "══════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "  1. Open port 5000 in AWS Security Group (if not done)"
echo "  2. Create DNS: registro.aionseg.co → 18.230.40.6"
echo "  3. Restart backend-api to load new Dahua routes:"
echo "     pm2 restart backend-api"
echo "  4. Configure each Dahua XVR (see guia-tecnico-registro-dahua.md):"
echo "     Red → Registro en Plataforma → Server: registro.aionseg.co → Puerto: 5000"
echo "  5. Verify at: curl http://localhost:3001/dahua/status"
echo "  6. Check cameras: curl http://localhost:3001/cameras/by-site"
echo ""
echo "  Verification commands:"
echo "    curl -s http://localhost:1984/api/streams | python3 -m json.tool | grep 'da-'"
echo "    curl -s http://localhost:3001/dahua/registro/devices"
echo "    pm2 logs backend-api --lines 20 | grep -i dahua"
echo ""
