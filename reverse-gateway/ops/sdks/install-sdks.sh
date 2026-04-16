#!/usr/bin/env bash
# ops/sdks/install-sdks.sh
#
# Installs the Dahua NetSDK and Hikvision HCNetSDK/ISUP libraries into
# ./sdks/<vendor>/lib|include, verifying SHA-256 against a pinned manifest.
#
# The SDKs themselves are proprietary and must be downloaded from the
# respective vendor partner portals. This script does NOT download them —
# it validates archives that you place into ./sdks/incoming/.
#
# Expected inputs:
#   sdks/incoming/General_NetSDK_Linux64.tar.gz
#   sdks/incoming/HCNetSDK_Linux64.tar.gz
#   sdks/incoming/EHomeSDK_Linux64.tar.gz
#
# Expected pinned hashes in ops/sdks/SHA256SUMS.
#
# Usage:  bash ops/sdks/install-sdks.sh

set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
INCOMING="$ROOT/sdks/incoming"
MANIFEST="$HERE/SHA256SUMS"

mkdir -p "$ROOT/sdks/dahua/lib"     "$ROOT/sdks/dahua/include"
mkdir -p "$ROOT/sdks/hikvision/lib" "$ROOT/sdks/hikvision/include"

log() { printf '[sdk] %s\n' "$*"; }

verify() {
  local expected_file="$1"
  cd "$INCOMING"
  grep -F "  $expected_file" "$MANIFEST" | sha256sum -c - \
    || { echo "HASH MISMATCH on $expected_file"; exit 1; }
  cd - >/dev/null
}

install_dahua() {
  local archive="General_NetSDK_Linux64.tar.gz"
  [[ -f "$INCOMING/$archive" ]] || { log "missing $INCOMING/$archive; skipping Dahua"; return 0; }
  verify "$archive"
  log "extracting Dahua NetSDK"
  tar -xzf "$INCOMING/$archive" -C "$ROOT/sdks/dahua" --strip-components=1
  # Normalize: the vendor archive lays out lib/ and include/ but sometimes
  # under "Lib", "Libs", "NetSDK/Lib". Flatten.
  find "$ROOT/sdks/dahua" -maxdepth 4 -name '*.so*' -exec cp -av {} "$ROOT/sdks/dahua/lib/" \; 2>/dev/null || true
  find "$ROOT/sdks/dahua" -maxdepth 4 -name '*.h'   -exec cp -av {} "$ROOT/sdks/dahua/include/" \; 2>/dev/null || true
  test -f "$ROOT/sdks/dahua/lib/libdhnetsdk.so" || { echo "libdhnetsdk.so not found after extract"; exit 1; }
  log "Dahua OK"
}

install_hik() {
  local hcnet="HCNetSDK_Linux64.tar.gz"
  local ehome="EHomeSDK_Linux64.tar.gz"
  [[ -f "$INCOMING/$hcnet" ]] || { log "missing $hcnet; skipping Hikvision HCNet"; return 0; }
  [[ -f "$INCOMING/$ehome" ]] || { log "missing $ehome; skipping Hikvision EHome/ISUP"; return 0; }
  verify "$hcnet"
  verify "$ehome"
  log "extracting HCNetSDK"
  tar -xzf "$INCOMING/$hcnet" -C "$ROOT/sdks/hikvision" --strip-components=1
  log "extracting EHome/ISUP SDK"
  tar -xzf "$INCOMING/$ehome" -C "$ROOT/sdks/hikvision" --strip-components=1 --overwrite
  find "$ROOT/sdks/hikvision" -maxdepth 5 -name '*.so*' -exec cp -av {} "$ROOT/sdks/hikvision/lib/" \; 2>/dev/null || true
  find "$ROOT/sdks/hikvision" -maxdepth 5 -name '*.h'   -exec cp -av {} "$ROOT/sdks/hikvision/include/" \; 2>/dev/null || true
  test -f "$ROOT/sdks/hikvision/lib/libhcnetsdk.so"  || { echo "libhcnetsdk.so not found"; exit 1; }
  test -f "$ROOT/sdks/hikvision/lib/libhcISUPSDK.so" || { echo "libhcISUPSDK.so not found"; exit 1; }
  log "Hikvision OK"
}

install_dahua
install_hik

log "All SDKs installed. You can now run:  make build-full"
