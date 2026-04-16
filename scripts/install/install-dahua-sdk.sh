#!/usr/bin/env bash
# =============================================================================
# install-dahua-sdk.sh — Instala Dahua General NetSDK en el VPS
#
# Uso:  sudo bash install-dahua-sdk.sh /path/to/General_NetSDK_Linux64.tar.gz
# =============================================================================
set -euo pipefail

SDK_TARBALL="${1:?Uso: $0 <ruta-al-tarball-NetSDK-Dahua.tar.gz>}"
SDK_DIR="/opt/aion/services/reverse-gateway/sdks/dahua"
LIB_DIR="$SDK_DIR/lib"
INC_DIR="$SDK_DIR/include"
ENV_FILE="/etc/aion/vision-hub.env"

echo "=== Instalando Dahua General NetSDK ==="
echo "Tarball: $SDK_TARBALL"

if [ ! -f "$SDK_TARBALL" ]; then
  echo "ERROR: Archivo no encontrado: $SDK_TARBALL"
  exit 1
fi

mkdir -p "$LIB_DIR" "$INC_DIR"

TMPDIR=$(mktemp -d)
echo "Extrayendo en $TMPDIR..."
tar xzf "$SDK_TARBALL" -C "$TMPDIR"

echo "Buscando bibliotecas..."
find "$TMPDIR" -name "*.so*" -exec cp -v {} "$LIB_DIR/" \;
find "$TMPDIR" -name "*.h" -exec cp -v {} "$INC_DIR/" \;

REQUIRED_LIBS=("libdhnetsdk.so" "libdhconfigsdk.so" "libNetFramework.so")
MISSING=0
for lib in "${REQUIRED_LIBS[@]}"; do
  if [ ! -f "$LIB_DIR/$lib" ]; then
    echo "WARNING: $lib no encontrada"
    MISSING=$((MISSING+1))
  else
    echo "OK: $lib"
  fi
done

cd "$LIB_DIR"
for f in *.so.*; do
  [ -f "$f" ] || continue
  base=$(echo "$f" | sed 's/\.so\..*/\.so/')
  if [ ! -f "$base" ]; then
    ln -sf "$f" "$base"
    echo "Symlink: $base -> $f"
  fi
done

echo "$LIB_DIR" | sudo tee /etc/ld.so.conf.d/dahua-sdk.conf
sudo ldconfig

if [ -f "$ENV_FILE" ]; then
  if grep -q "LD_LIBRARY_PATH" "$ENV_FILE"; then
    sed -i "s|LD_LIBRARY_PATH=.*|LD_LIBRARY_PATH=/opt/aion/services/reverse-gateway/sdks/hikvision/lib:$LIB_DIR:\$LD_LIBRARY_PATH|" "$ENV_FILE"
  else
    echo "LD_LIBRARY_PATH=/opt/aion/services/reverse-gateway/sdks/hikvision/lib:$LIB_DIR" >> "$ENV_FILE"
  fi
fi

GATEWAY_BIN="/opt/aion/services/reverse-gateway/bin/gateway"
if [ -f "$GATEWAY_BIN" ]; then
  echo ""
  echo "ldd output:"
  LD_LIBRARY_PATH="$LIB_DIR" ldd "$GATEWAY_BIN" 2>&1 | grep -E "dhnet|dhconfig|NetFramework|not found" || echo "(stub mode)"
fi

rm -rf "$TMPDIR"

echo ""
echo "=== INSTALACION COMPLETADA ==="
echo "SDK dir: $SDK_DIR"
echo "Libs: $(ls "$LIB_DIR" | wc -l) archivos"
echo ""
echo "Siguiente paso: recompilar con CGO_ENABLED=1 y tags SDK:"
echo "  cd /opt/aion/services/reverse-gateway"
echo "  CGO_ENABLED=1 go build -tags 'sdk_hikvision,sdk_dahua' -o bin/gateway ./cmd/gateway/"
echo ""
echo "Luego reiniciar:"
echo "  pm2 restart aion-reverse-gateway"
