#!/usr/bin/env bash
###############################################################################
# 04-test-devices.sh
#
# Tests connectivity of ALL Hikvision devices and Access Controllers via
# ISAPI digest authentication.
#
# Prerequisites:
#   - curl with digest auth support (standard on most systems)
#   - Network access to all device IPs/ports
#
# Usage:
#   chmod +x 04-test-devices.sh
#   ./04-test-devices.sh
###############################################################################
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
TIMEOUT=8         # seconds per device
PARALLEL=0        # set to 1 for parallel testing (faster but noisier output)
RESULTS_FILE="/tmp/device-test-results-$(date +%Y%m%d_%H%M%S).txt"

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
log()   { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
ok()    { printf '\033[1;32m[PASS]\033[0m  %s\n' "$*"; }
fail()  { printf '\033[1;31m[FAIL]\033[0m  %s\n' "$*"; }
warn()  { printf '\033[1;33m[WARN]\033[0m  %s\n' "$*"; }

# Counters
TOTAL=0
ONLINE=0
OFFLINE=0
declare -a FAILED_DEVICES=()

# ---------------------------------------------------------------------------
# Test function: ISAPI digest auth check
# ---------------------------------------------------------------------------
test_device() {
  local NAME="$1"
  local HOST="$2"
  local PORT="$3"
  local USER="$4"
  local PASS="$5"
  local TYPE="$6"  # DVR, NVR, LPR, or AC

  TOTAL=$((TOTAL + 1))

  local URL="http://${HOST}:${PORT}/ISAPI/System/deviceInfo"
  local LABEL="${NAME} (${TYPE}) — ${HOST}:${PORT}"

  # Perform digest auth request
  local HTTP_CODE
  local RESPONSE
  RESPONSE=$(curl -s --digest -u "${USER}:${PASS}" \
    --max-time "${TIMEOUT}" \
    --connect-timeout "${TIMEOUT}" \
    -o /dev/null \
    -w '%{http_code}' \
    "${URL}" 2>/dev/null) || RESPONSE="000"

  if [[ "${RESPONSE}" == "200" ]]; then
    ok "${LABEL} — HTTP ${RESPONSE}"
    echo "PASS ${LABEL}" >> "${RESULTS_FILE}"
    ONLINE=$((ONLINE + 1))
  else
    fail "${LABEL} — HTTP ${RESPONSE}"
    echo "FAIL ${LABEL} — HTTP ${RESPONSE}" >> "${RESULTS_FILE}"
    OFFLINE=$((OFFLINE + 1))
    FAILED_DEVICES+=("${LABEL} (HTTP ${RESPONSE})")
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
log "=== Hikvision Device Connectivity Test ==="
log "Timeout per device: ${TIMEOUT}s"
log "Results file: ${RESULTS_FILE}"
echo ""

# Initialize results file
echo "# Device Test Results — $(date)" > "${RESULTS_FILE}"
echo "" >> "${RESULTS_FILE}"

# ═══════════════════════════════════════════════════════════════════════════
#   SURVEILLANCE DEVICES (DVR / NVR / LPR)
# ═══════════════════════════════════════════════════════════════════════════
log "────────────────────────────────────────────────"
log "Testing Surveillance Devices (DVR / NVR / LPR)"
log "────────────────────────────────────────────────"
echo ""

# Torre Lucia DVR
test_device "Torre Lucia DVR" "181.205.215.210" "8010" "admin" "seg12345" "DVR"

# Torre Lucia NVR
test_device "Torre Lucia NVR" "181.205.215.210" "8020" "admin" "seg12345" "NVR"

# San Nicolas NVR
test_device "San Nicolas NVR" "181.143.16.170" "8000" "admin" "Clave.seg2023" "NVR"

# San Nicolas LPR
test_device "San Nicolas LPR" "181.143.16.170" "8081" "admin" "Clave.seg2023" "LPR"

# Pisquines NVR
test_device "Pisquines NVR" "181.205.202.122" "8010" "admin" "Clave.seg2023" "NVR"

# Pisquines DVR
test_device "Pisquines DVR" "181.205.202.122" "8020" "admin" "Clave.seg2023" "DVR"

# San Sebastian DVR
test_device "San Sebastian DVR" "186.97.106.252" "8000" "admin" "Clave.seg2023" "DVR"

# Portalegre NVR
test_device "Portalegre NVR" "200.58.214.114" "8000" "admin" "Clave.seg2023" "NVR"

# Portalegre DVR
test_device "Portalegre DVR" "200.58.214.114" "8040" "admin" "Clave.seg2023" "DVR"

# Altagracia DVR
test_device "Altagracia DVR" "181.205.175.18" "8030" "admin" "Clave.seg2023" "DVR"

# Altagracia LPR
test_device "Altagracia LPR" "181.205.175.18" "8010" "admin" "Clave.seg2023" "LPR"

# Portal Plaza NVR
test_device "Portal Plaza NVR" "181.205.175.19" "8020" "admin" "Clave.seg2023" "NVR"

# Brescia LPR1
test_device "Brescia LPR1" "186.97.104.202" "8030" "admin" "Clave.seg2023" "LPR"

# Brescia LPR2
test_device "Brescia LPR2" "186.97.104.202" "8020" "admin" "Clave.seg2023" "LPR"

# Senderos DVR1
test_device "Senderos DVR1" "38.9.217.12" "8030" "admin" "Clave.seg2023" "DVR"

# Senderos DVR2
test_device "Senderos DVR2" "38.9.217.12" "8020" "admin" "Clave.seg2023" "DVR"

# Altos Rosario DVR
test_device "Altos Rosario DVR" "190.159.37.188" "8010" "admin" "Clave.seg2023" "DVR"

# La Palencia DVR
test_device "La Palencia DVR" "181.205.249.130" "8000" "admin" "Clave.seg2023" "DVR"

echo ""

# ═══════════════════════════════════════════════════════════════════════════
#   ACCESS CONTROLLERS
# ═══════════════════════════════════════════════════════════════════════════
log "────────────────────────────────────────────────"
log "Testing Access Controllers"
log "────────────────────────────────────────────────"
echo ""

# TL SUR
test_device "TL SUR" "181.205.215.210" "8060" "admin" "Seg12345" "AC"

# TL NORTE
test_device "TL NORTE" "181.205.215.210" "8081" "admin" "Seg12345" "AC"

# TL TER
test_device "TL TER" "181.205.215.210" "8070" "admin" "Seg12345" "AC"

# TL GYM
test_device "TL GYM" "181.205.215.210" "8040" "admin" "Clave.seg2023" "AC"

# San Nicolas AC
test_device "San Nicolas AC" "181.143.16.170" "8050" "admin" "seg12345" "AC"

# Pisquines AC
test_device "Pisquines AC" "181.205.202.122" "8000" "admin" "Seg12345" "AC"

# San Sebastian AC
test_device "San Sebastian AC" "186.97.106.252" "8080" "admin" "seg12345" "AC"

# Portalegre AC
test_device "Portalegre AC" "200.58.214.114" "8010" "admin" "Seg12345" "AC"

# Altagracia AC
test_device "Altagracia AC" "181.205.175.18" "8050" "admin" "Clave.seg2023" "AC"

# Brescia AC
test_device "Brescia AC" "186.97.104.202" "8050" "admin" "Clave.seg2023" "AC"

echo ""

# ═══════════════════════════════════════════════════════════════════════════
#   RESULTS SUMMARY
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║               DEVICE CONNECTIVITY SUMMARY                    ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  Total devices tested:  ${TOTAL}"
echo "  Online (HTTP 200):     ${ONLINE}"
echo "  Offline / Failed:      ${OFFLINE}"
echo ""

if [[ ${OFFLINE} -gt 0 ]]; then
  echo "  ┌──────────────────────────────────────────────────────────┐"
  echo "  │  FAILED DEVICES                                          │"
  echo "  └──────────────────────────────────────────────────────────┘"
  echo ""
  for DEV in "${FAILED_DEVICES[@]}"; do
    echo "    - ${DEV}"
  done
  echo ""
fi

# Write summary to results file
echo "" >> "${RESULTS_FILE}"
echo "# Summary" >> "${RESULTS_FILE}"
echo "Total: ${TOTAL}" >> "${RESULTS_FILE}"
echo "Online: ${ONLINE}" >> "${RESULTS_FILE}"
echo "Offline: ${OFFLINE}" >> "${RESULTS_FILE}"

if [[ ${OFFLINE} -gt 0 ]]; then
  echo "" >> "${RESULTS_FILE}"
  echo "# Failed Devices" >> "${RESULTS_FILE}"
  for DEV in "${FAILED_DEVICES[@]}"; do
    echo "  ${DEV}" >> "${RESULTS_FILE}"
  done
fi

log "Results saved to: ${RESULTS_FILE}"

# Exit with non-zero if any device failed
if [[ ${OFFLINE} -gt 0 ]]; then
  warn "${OFFLINE} device(s) failed connectivity test."
  exit 1
else
  echo ""
  log "All ${TOTAL} devices are online and responding."
  exit 0
fi
