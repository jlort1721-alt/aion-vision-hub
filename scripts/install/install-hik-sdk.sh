#!/usr/bin/env bash
# =============================================================================
# install-hik-sdk.sh — Instala Hikvision HCNetSDK en el VPS
#
# Uso:  sudo bash install-hik-sdk.sh /path/to/CH-HCNetSDKV6.x.x_linux64.tar.gz
# =============================================================================
set -euo pipefail

SDK_TARBALL="${1:?Uso: $0 <ruta-al-tarball-HCNetSDK.tar.gz>}"
SDK_DIR="/opt/aion/services/reverse-gateway/sdks/hikvision"
LIB_DIR="$SDK_DIR/lib"
INC_DIR="$SDK_DIR/include"
ENV_FILE="/etc/aion/vision-hub.env"
GATEWAY_UNIT="aion-reverse-gateway"

echo "=== Instalando Hikvision HCNetSDK ==="
echo "Tarball: $SDK_TARBALL"

# 1. Validar tarball
if [ ! -f "$SDK_TARBALL" ]; then
  echo "ERROR: Archivo no encontrado: $SDK_TARBALL"
  exit 1
fi

# 2. Crear directorios
mkdir -p "$LIB_DIR" "$INC_DIR"

# 3. Extraer
TMPDIR=$(mktemp -d)
echo "Extrayendo en $TMPDIR..."
tar xzf "$SDK_TARBALL" -C "$TMPDIR"

# 4. Buscar libs (.so) y headers (.h)
echo "Buscando bibliotecas..."
find "$TMPDIR" -name "*.so*" -exec cp -v {} "$LIB_DIR/" \;
find "$TMPDIR" -name "*.h" -exec cp -v {} "$INC_DIR/" \;

# 5. Verificar libs criticas
REQUIRED_LIBS=("libhcnetsdk.so" "libHCCore.so" "libhpr.so")
MISSING=0
for lib in "${REQUIRED_LIBS[@]}"; do
  if [ ! -f "$LIB_DIR/$lib" ]; then
    echo "WARNING: $lib no encontrada en el tarball"
    MISSING=$((MISSING+1))
  else
    echo "OK: $lib"
  fi
done

if [ "$MISSING" -gt 0 ]; then
  echo ""
  echo "Algunas libs no se encontraron. Verifica que el tarball sea la version Linux x64."
  echo "Las libs disponibles son:"
  ls -la "$LIB_DIR/"
  echo ""
  echo "Continuando de todas formas..."
fi

# 6. Crear symlinks si hay versionados
cd "$LIB_DIR"
for f in *.so.*; do
  [ -f "$f" ] || continue
  base=$(echo "$f" | sed 's/\.so\..*/\.so/')
  if [ ! -f "$base" ]; then
    ln -sf "$f" "$base"
    echo "Symlink: $base -> $f"
  fi
done

# 7. Actualizar ldconfig
echo "$LIB_DIR" | sudo tee /etc/ld.so.conf.d/hikvision-sdk.conf
sudo ldconfig

# 8. Actualizar LD_LIBRARY_PATH en env file
if [ -f "$ENV_FILE" ]; then
  if grep -q "LD_LIBRARY_PATH" "$ENV_FILE"; then
    sed -i "s|LD_LIBRARY_PATH=.*|LD_LIBRARY_PATH=$LIB_DIR:/opt/aion/services/reverse-gateway/sdks/dahua/lib:\$LD_LIBRARY_PATH|" "$ENV_FILE"
  else
    echo "LD_LIBRARY_PATH=$LIB_DIR:/opt/aion/services/reverse-gateway/sdks/dahua/lib" >> "$ENV_FILE"
  fi
else
  mkdir -p "$(dirname "$ENV_FILE")"
  echo "LD_LIBRARY_PATH=$LIB_DIR:/opt/aion/services/reverse-gateway/sdks/dahua/lib" > "$ENV_FILE"
fi

# 9. Verificar con ldd
echo ""
echo "=== Verificando dependencias del gateway ==="
GATEWAY_BIN="/opt/aion/services/reverse-gateway/bin/gateway"
if [ -f "$GATEWAY_BIN" ]; then
  echo "ldd output:"
  LD_LIBRARY_PATH="$LIB_DIR" ldd "$GATEWAY_BIN" 2>&1 | grep -E "hcnet|HCCore|hpr|not found" || echo "(gateway compilado sin CGO — no tiene deps de SDK en stub mode)"
fi

# 10. Limpiar
rm -rf "$TMPDIR"

echo ""
echo "=== INSTALACION COMPLETADA ==="
echo "SDK dir: $SDK_DIR"
echo "Libs: $(ls "$LIB_DIR" | wc -l) archivos"
echo ""
echo "Siguiente paso: recompilar el gateway con CGO_ENABLED=1 y tags SDK:"
echo "  cd /opt/aion/services/reverse-gateway"
echo "  CGO_ENABLED=1 go build -tags sdk_hikvision -o bin/gateway ./cmd/gateway/"
echo ""
echo "Luego reiniciar:"
echo "  pm2 restart aion-reverse-gateway"
