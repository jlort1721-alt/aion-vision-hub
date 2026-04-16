#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# AION Hikvision Bridge — Installation Validation Script
# Run after install.sh to verify everything works
# ═══════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

check() {
  local desc="$1"
  local cmd="$2"
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $desc"
    ((PASS++))
  else
    echo -e "  ${RED}✗${NC} $desc"
    ((FAIL++))
  fi
}

warn_check() {
  local desc="$1"
  local cmd="$2"
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $desc"
    ((PASS++))
  else
    echo -e "  ${YELLOW}⚠${NC} $desc (non-critical)"
    ((WARN++))
  fi
}

echo "══════════════════════════════════════════"
echo "  AION Hikvision Bridge — Validation"
echo "══════════════════════════════════════════"
echo ""

# 1. Python environment
echo "1. Python Environment"
check "Python 3.11+ installed" "python3.11 --version"
check "Virtual environment exists" "test -d /opt/aion/hik-bridge/venv"
check "FastAPI installed" "/opt/aion/hik-bridge/venv/bin/python -c 'import fastapi'"
check "Pydantic installed" "/opt/aion/hik-bridge/venv/bin/python -c 'import pydantic'"
check "Redis client installed" "/opt/aion/hik-bridge/venv/bin/python -c 'import redis'"
check "httpx installed" "/opt/aion/hik-bridge/venv/bin/python -c 'import httpx'"
warn_check "hikvision-sdk installed" "/opt/aion/hik-bridge/venv/bin/python -c 'import hikvision_sdk'"
echo ""

# 2. Directories
echo "2. Directories"
check "App directory exists" "test -d /opt/aion/hik-bridge/app"
check "Snapshots directory exists" "test -d /opt/aion/hik-bridge/snapshots"
check "Downloads directory exists" "test -d /opt/aion/hik-bridge/downloads"
check "Log directory exists" "test -d /var/log/aion/hik-bridge"
check "SDK log directory exists" "test -d /var/log/aion/hik-bridge/sdk"
echo ""

# 3. Configuration
echo "3. Configuration"
check ".env file exists" "test -f /opt/aion/hik-bridge/.env"
check "API key configured" "grep -q 'HIK_BRIDGE_API_KEY' /opt/aion/hik-bridge/.env"
check "Redis URL configured" "grep -q 'REDIS_URL' /opt/aion/hik-bridge/.env"
check "AION API URL configured" "grep -q 'AION_API_URL' /opt/aion/hik-bridge/.env"
echo ""

# 4. Systemd service
echo "4. Systemd Service"
check "Service file exists" "test -f /etc/systemd/system/aion-hik-bridge.service"
warn_check "Service enabled" "systemctl is-enabled aion-hik-bridge"
warn_check "Service running" "systemctl is-active aion-hik-bridge"
echo ""

# 5. Network
echo "5. Network Connectivity"
warn_check "Port 8100 listening" "ss -tlnp | grep -q ':8100'"
warn_check "Redis reachable" "redis-cli ping"
warn_check "AION API reachable (port 3001)" "curl -sf http://localhost:3001/health > /dev/null"
echo ""

# 6. API health check
echo "6. API Health Check"
if curl -sf http://localhost:8100/health > /dev/null 2>&1; then
  HEALTH=$(curl -sf http://localhost:8100/health)
  echo -e "  ${GREEN}✓${NC} Health endpoint responding"
  echo "    $HEALTH"
  ((PASS++))

  SDK_STATUS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('sdk_initialized', False))" 2>/dev/null || echo "unknown")
  CONNECTED=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('connected_devices', 0))" 2>/dev/null || echo "0")

  if [ "$SDK_STATUS" = "True" ]; then
    echo -e "  ${GREEN}✓${NC} SDK initialized"
  else
    echo -e "  ${YELLOW}⚠${NC} SDK not initialized (mock mode or libs missing)"
    ((WARN++))
  fi
  echo -e "  Connected devices: $CONNECTED"
else
  echo -e "  ${RED}✗${NC} Health endpoint not responding"
  echo "    Is the service running? Try: systemctl start aion-hik-bridge"
  ((FAIL++))
fi
echo ""

# 7. SDK libraries
echo "7. HCNetSDK Native Libraries"
SDK_PATH="/opt/aion/hik-bridge/venv/lib/python3.11/site-packages/hikvision_sdk/lib"
if [ -d "$SDK_PATH" ]; then
  SO_COUNT=$(find "$SDK_PATH" -name "*.so" 2>/dev/null | wc -l)
  if [ "$SO_COUNT" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} Found $SO_COUNT .so libraries in SDK path"
  else
    echo -e "  ${YELLOW}⚠${NC} SDK directory exists but no .so files found"
    echo "    Download HCNetSDK Linux 64-bit from Hikvision portal"
    ((WARN++))
  fi
else
  echo -e "  ${YELLOW}⚠${NC} SDK lib directory not found at: $SDK_PATH"
  echo "    The service will run in mock mode without native SDK"
  ((WARN++))
fi
echo ""

# Summary
echo "══════════════════════════════════════════"
echo -e "  Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${WARN} warnings${NC}"
echo "══════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}Some checks failed — review errors above${NC}"
  exit 1
else
  echo -e "  ${GREEN}Installation validated successfully!${NC}"
  exit 0
fi
