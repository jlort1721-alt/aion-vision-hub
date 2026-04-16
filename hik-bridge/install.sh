#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# AION Hikvision Bridge — Installation Script
# Target: Ubuntu Server 24.04 LTS (AWS t3.xlarge)
# ═══════════════════════════════════════════════════════════
set -euo pipefail

INSTALL_DIR="/opt/aion/hik-bridge"
VENV_DIR="${INSTALL_DIR}/venv"
LOG_DIR="/var/log/aion/hik-bridge"
SERVICE_USER="ubuntu"

echo "══════════════════════════════════════════"
echo "  AION Hikvision Bridge — Installer"
echo "══════════════════════════════════════════"

# 1. System dependencies
echo "[1/7] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  python3.11 python3.11-venv python3.11-dev \
  python3-pip \
  libstdc++6 \
  libssl-dev \
  libasound2 \
  jq

# 2. Create directories
echo "[2/7] Creating directories..."
sudo mkdir -p "${INSTALL_DIR}"/{snapshots,downloads,logs}
sudo mkdir -p "${LOG_DIR}"/sdk
sudo chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}"
sudo chown -R "${SERVICE_USER}:${SERVICE_USER}" "${LOG_DIR}"

# 3. Create virtual environment
echo "[3/7] Creating Python virtual environment..."
python3.11 -m venv "${VENV_DIR}"
source "${VENV_DIR}/bin/activate"

# 4. Install Python dependencies
echo "[4/7] Installing Python packages..."
pip install --upgrade pip setuptools wheel -q
pip install -r "${INSTALL_DIR}/requirements.txt" -q

# 5. Verify HCNetSDK libraries
echo "[5/7] Verifying HCNetSDK native libraries..."
SDK_LIB_PATH="${VENV_DIR}/lib/python3.11/site-packages/hikvision_sdk/lib"
if [ -d "${SDK_LIB_PATH}" ]; then
  echo "  SDK libraries found at: ${SDK_LIB_PATH}"
  ls -la "${SDK_LIB_PATH}"/*.so 2>/dev/null || echo "  WARNING: No .so files found — SDK may need manual library installation"
else
  echo "  WARNING: SDK lib directory not found at ${SDK_LIB_PATH}"
  echo "  You may need to download HCNetSDK Linux 64-bit from Hikvision portal"
  echo "  and place .so files in: ${SDK_LIB_PATH}/"
fi

# 6. Create .env from example if not exists
echo "[6/7] Configuring environment..."
if [ ! -f "${INSTALL_DIR}/.env" ]; then
  cp "${INSTALL_DIR}/.env.example" "${INSTALL_DIR}/.env"
  echo "  Created .env from template — EDIT WITH YOUR VALUES"
else
  echo "  .env already exists — skipping"
fi

# 7. Create systemd service
echo "[7/7] Installing systemd service..."
sudo tee /etc/systemd/system/aion-hik-bridge.service > /dev/null <<SERVICEEOF
[Unit]
Description=AION Hikvision Bridge (HCNetSDK)
After=network.target redis-server.service
Wants=redis-server.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
Environment=LD_LIBRARY_PATH=${VENV_DIR}/lib/python3.11/site-packages/hikvision_sdk/lib
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=${VENV_DIR}/bin/uvicorn app.main:app --host 0.0.0.0 --port 8100 --workers 1 --log-level info
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=aion-hik-bridge

[Install]
WantedBy=multi-user.target
SERVICEEOF

sudo systemctl daemon-reload

echo ""
echo "══════════════════════════════════════════"
echo "  Installation complete!"
echo "══════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Edit ${INSTALL_DIR}/.env with your values"
echo "  2. Copy app/ directory to ${INSTALL_DIR}/"
echo "  3. sudo systemctl enable aion-hik-bridge"
echo "  4. sudo systemctl start aion-hik-bridge"
echo "  5. curl http://localhost:8100/health"
echo ""
