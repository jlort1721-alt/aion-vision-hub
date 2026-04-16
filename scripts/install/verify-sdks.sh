#!/usr/bin/env bash
# =============================================================================
# verify-sdks.sh — Verifica que los SDKs estan correctamente instalados
# =============================================================================
set -euo pipefail

HIK_DIR="/opt/aion/services/reverse-gateway/sdks/hikvision/lib"
DAH_DIR="/opt/aion/services/reverse-gateway/sdks/dahua/lib"
GATEWAY="/opt/aion/services/reverse-gateway/bin/gateway"

echo "=== SDK Verification Report ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Hikvision
echo "--- Hikvision HCNetSDK ---"
if [ -d "$HIK_DIR" ]; then
  HIK_LIBS=$(ls "$HIK_DIR"/*.so* 2>/dev/null | wc -l)
  echo "Directory: $HIK_DIR"
  echo "Libraries: $HIK_LIBS files"
  for lib in libhcnetsdk.so libHCCore.so libhpr.so; do
    if [ -f "$HIK_DIR/$lib" ]; then
      SIZE=$(stat -c%s "$HIK_DIR/$lib" 2>/dev/null || stat -f%z "$HIK_DIR/$lib" 2>/dev/null)
      echo "  OK: $lib ($SIZE bytes)"
    else
      echo "  MISSING: $lib"
    fi
  done
else
  echo "  NOT INSTALLED (directory not found)"
fi

echo ""

# Dahua
echo "--- Dahua General NetSDK ---"
if [ -d "$DAH_DIR" ]; then
  DAH_LIBS=$(ls "$DAH_DIR"/*.so* 2>/dev/null | wc -l)
  echo "Directory: $DAH_DIR"
  echo "Libraries: $DAH_LIBS files"
  for lib in libdhnetsdk.so libdhconfigsdk.so libNetFramework.so; do
    if [ -f "$DAH_DIR/$lib" ]; then
      SIZE=$(stat -c%s "$DAH_DIR/$lib" 2>/dev/null || stat -f%z "$DAH_DIR/$lib" 2>/dev/null)
      echo "  OK: $lib ($SIZE bytes)"
    else
      echo "  MISSING: $lib"
    fi
  done
else
  echo "  NOT INSTALLED (directory not found)"
fi

echo ""

# Gateway binary
echo "--- Gateway Binary ---"
if [ -f "$GATEWAY" ]; then
  echo "Path: $GATEWAY"
  echo "Size: $(stat -c%s "$GATEWAY" 2>/dev/null || stat -f%z "$GATEWAY") bytes"
  echo "Type: $(file "$GATEWAY" | cut -d: -f2)"
  echo ""
  echo "ldd dependencies:"
  export LD_LIBRARY_PATH="${HIK_DIR}:${DAH_DIR}:${LD_LIBRARY_PATH:-}"
  ldd "$GATEWAY" 2>&1 | grep -E "not found|hcnet|HCCore|hpr|dhnet|dhconfig|NetFramework" || echo "  (no SDK deps — likely stub mode build)"
  echo ""
  UNRESOLVED=$(ldd "$GATEWAY" 2>&1 | grep -c "not found" || true)
  if [ "$UNRESOLVED" -gt 0 ]; then
    echo "RESULT: FAIL — $UNRESOLVED unresolved dependencies"
  else
    echo "RESULT: PASS — all dependencies resolved"
  fi
else
  echo "  NOT FOUND at $GATEWAY"
fi

echo ""

# Quick gateway test
echo "--- Gateway Dry Run ---"
if [ -f "$GATEWAY" ] && [ -f "/etc/aion/reverse/gateway.toml" ]; then
  export LD_LIBRARY_PATH="${HIK_DIR}:${DAH_DIR}:${LD_LIBRARY_PATH:-}"
  timeout 3 "$GATEWAY" --config /etc/aion/reverse/gateway.toml 2>&1 | head -5 || true
  echo "(gateway exited — expected in test mode)"
else
  echo "  SKIP — gateway or config not found"
fi

echo ""
echo "=== Verification Complete ==="
