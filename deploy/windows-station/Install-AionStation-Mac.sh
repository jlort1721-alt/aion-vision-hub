#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# AION STATION INSTALLER — macOS Workstation Setup
# Clave Seguridad CTA — Central de Monitoreo 24/7
# ═══════════════════════════════════════════════════════════════
#
# EJECUTAR:
#   chmod +x Install-AionStation-Mac.sh
#   ./Install-AionStation-Mac.sh
#
# O directamente:
#   curl -sL https://aionseg.co/installer/Install-AionStation-Mac.sh | bash
# ═══════════════════════════════════════════════════════════════

set -e

AION_URL="${AION_URL:-https://aionseg.co}"
STATION_NAME="${STATION_NAME:-CCTV-MAC-01}"
AION_DIR="$HOME/.aion-station"
LOG_FILE="$AION_DIR/install.log"
KIOSK_MODE="${KIOSK_MODE:-false}"
DUAL_MONITOR="${DUAL_MONITOR:-false}"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'; GRAY='\033[0;37m'

log() { echo -e "  ${GREEN}[OK]${NC} $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] [OK] $1" >> "$LOG_FILE" 2>/dev/null; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN] $1" >> "$LOG_FILE" 2>/dev/null; }
fail() { echo -e "  ${RED}[ERROR]${NC} $1"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >> "$LOG_FILE" 2>/dev/null; }

banner() {
  echo ""
  echo -e "  ${CYAN}====================================================${NC}"
  echo -e "  ${CYAN}|                                                  |${NC}"
  echo -e "  ${CYAN}|   AION SECURITY PLATFORM                        |${NC}"
  echo -e "  ${CYAN}|   macOS STATION INSTALLER v1.0                   |${NC}"
  echo -e "  ${CYAN}|   Clave Seguridad CTA                           |${NC}"
  echo -e "  ${CYAN}|                                                  |${NC}"
  echo -e "  ${CYAN}====================================================${NC}"
  echo ""
}

banner

# ═══ Crear directorios ═══
mkdir -p "$AION_DIR"/{logs,config,scripts}
echo "[$(date)] Instalacion iniciada - $STATION_NAME" > "$LOG_FILE"

# ═══════════════════════════════════════════════════════════════
# PASO 1: Verificar/Instalar Chrome
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 1: Verificando Google Chrome...${NC}"

CHROME_APP="/Applications/Google Chrome.app"
CHROME_BIN="$CHROME_APP/Contents/MacOS/Google Chrome"

if [ ! -d "$CHROME_APP" ]; then
  warn "Chrome no encontrado - instalando..."
  if command -v brew &>/dev/null; then
    brew install --cask google-chrome
    log "Chrome instalado via Homebrew"
  else
    echo "  Descargando Chrome..."
    curl -sL "https://dl.google.com/chrome/mac/universal/stable/GGRO/googlechrome.dmg" -o /tmp/chrome.dmg
    hdiutil attach /tmp/chrome.dmg -quiet
    cp -R "/Volumes/Google Chrome/Google Chrome.app" /Applications/
    hdiutil detach "/Volumes/Google Chrome" -quiet
    rm /tmp/chrome.dmg
    log "Chrome instalado desde DMG"
  fi
else
  log "Chrome encontrado: $CHROME_APP"
fi

# ═══════════════════════════════════════════════════════════════
# PASO 2: Crear perfil dedicado Chrome AION
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 2: Configurando perfil Chrome AION...${NC}"

CHROME_PROFILE="$HOME/Library/Application Support/Google/Chrome/AION-Station"
mkdir -p "$CHROME_PROFILE"

if [ ! -f "$CHROME_PROFILE/Preferences" ]; then
  cat > "$CHROME_PROFILE/Preferences" << 'PREFS'
{
  "profile": {
    "name": "AION Monitor",
    "default_content_setting_values": {
      "notifications": 1,
      "media_stream_mic": 1,
      "media_stream_camera": 1
    }
  },
  "browser": {
    "show_home_button": false,
    "check_default_browser": false
  },
  "session": {
    "restore_on_startup": 1
  }
}
PREFS
  log "Perfil Chrome AION creado"
else
  log "Perfil Chrome AION ya existe"
fi

# ═══════════════════════════════════════════════════════════════
# PASO 3: Configurar macOS para 24/7
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 3: Configurando macOS para operacion 24/7...${NC}"

# Desactivar sleep
sudo pmset -a sleep 0 displaysleep 0 disksleep 0 2>/dev/null && log "Sleep desactivado" || warn "No se pudo desactivar sleep (necesita sudo)"

# Desactivar screensaver
defaults write com.apple.screensaver idleTime 0 2>/dev/null
log "Screensaver desactivado"

# Evitar que el sistema entre en App Nap
defaults write NSGlobalDomain NSAppSleepDisabled -bool YES 2>/dev/null
log "App Nap desactivado"

# Auto-login (requiere password del usuario)
echo -e "  ${GRAY}NOTA: Para auto-login, configurar manualmente:${NC}"
echo -e "  ${GRAY}  Preferencias del Sistema > Usuarios > Opciones de inicio > Inicio automatico${NC}"

# Mantener activo tras cerrar tapa (solo para Mac de escritorio con monitor externo)
sudo pmset -a lidwake 1 2>/dev/null

# Reiniciar automaticamente tras fallo de energia
sudo pmset -a autorestart 1 2>/dev/null && log "Auto-restart tras fallo de energia activado" || true

# Prevenir actualizaciones automaticas que reinicien
sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticDownload -bool false 2>/dev/null
sudo defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool false 2>/dev/null
log "Actualizaciones automaticas desactivadas"

# ═══════════════════════════════════════════════════════════════
# PASO 4: Crear aplicaciones de acceso directo
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 4: Creando accesos directos...${NC}"

# App wrapper: AION Monitor
AION_APP="$HOME/Desktop/AION Monitor.app"
mkdir -p "$AION_APP/Contents/MacOS"
mkdir -p "$AION_APP/Contents/Resources"

cat > "$AION_APP/Contents/MacOS/aion-launch" << LAUNCHER
#!/bin/bash
open -a "Google Chrome" --args --profile-directory="AION-Station" --start-maximized --autoplay-policy=no-user-gesture-required "$AION_URL/dashboard"
LAUNCHER
chmod +x "$AION_APP/Contents/MacOS/aion-launch"

cat > "$AION_APP/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key><string>AION Monitor</string>
    <key>CFBundleDisplayName</key><string>AION Monitor</string>
    <key>CFBundleIdentifier</key><string>co.aionseg.station</string>
    <key>CFBundleVersion</key><string>1.0.0</string>
    <key>CFBundleExecutable</key><string>aion-launch</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict>
</plist>
PLIST
log "App: AION Monitor (escritorio)"

# AION Kiosk
KIOSK_APP="$HOME/Desktop/AION Kiosk.app"
mkdir -p "$KIOSK_APP/Contents/MacOS"
cat > "$KIOSK_APP/Contents/MacOS/aion-kiosk" << LAUNCHER2
#!/bin/bash
open -a "Google Chrome" --args --profile-directory="AION-Station" --kiosk --autoplay-policy=no-user-gesture-required "$AION_URL/dashboard"
LAUNCHER2
chmod +x "$KIOSK_APP/Contents/MacOS/aion-kiosk"
cp "$AION_APP/Contents/Info.plist" "$KIOSK_APP/Contents/Info.plist"
sed -i '' 's/AION Monitor/AION Kiosk/g' "$KIOSK_APP/Contents/Info.plist" 2>/dev/null
sed -i '' 's/aion-launch/aion-kiosk/g' "$KIOSK_APP/Contents/Info.plist" 2>/dev/null
log "App: AION Kiosk (escritorio)"

# AION LiveView (si dual monitor)
if [ "$DUAL_MONITOR" = "true" ]; then
  LV_APP="$HOME/Desktop/AION LiveView.app"
  mkdir -p "$LV_APP/Contents/MacOS"
  cat > "$LV_APP/Contents/MacOS/aion-liveview" << LAUNCHER3
#!/bin/bash
open -a "Google Chrome" --args --profile-directory="AION-Station" --new-window --start-maximized "$AION_URL/live"
LAUNCHER3
  chmod +x "$LV_APP/Contents/MacOS/aion-liveview"
  cp "$AION_APP/Contents/Info.plist" "$LV_APP/Contents/Info.plist"
  sed -i '' 's/AION Monitor/AION LiveView/g' "$LV_APP/Contents/Info.plist" 2>/dev/null
  sed -i '' 's/aion-launch/aion-liveview/g' "$LV_APP/Contents/Info.plist" 2>/dev/null
  log "App: AION LiveView (segundo monitor)"
fi

# ═══════════════════════════════════════════════════════════════
# PASO 5: Auto-inicio al encender Mac
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 5: Configurando auto-inicio...${NC}"

# LaunchAgent para auto-inicio
PLIST_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$PLIST_DIR"

cat > "$PLIST_DIR/co.aionseg.station.plist" << LAGENT
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>co.aionseg.station</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$AION_DIR/scripts/autostart.sh</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><false/>
    <key>StandardOutPath</key><string>$AION_DIR/logs/autostart.log</string>
    <key>StandardErrorPath</key><string>$AION_DIR/logs/autostart-error.log</string>
</dict>
</plist>
LAGENT

# Script de autostart
cat > "$AION_DIR/scripts/autostart.sh" << 'ASTART'
#!/bin/bash
AION_URL="https://aionseg.co"

# Esperar 20 segundos para que el sistema cargue
sleep 20

# Esperar conectividad
for i in $(seq 1 30); do
  ping -c 1 -W 2 aionseg.co >/dev/null 2>&1 && break
  sleep 5
done

# Abrir AION
open -a "Google Chrome" --args --profile-directory="AION-Station" --start-maximized --autoplay-policy=no-user-gesture-required "$AION_URL/dashboard"

# Iniciar watchdog
nohup bash "$HOME/.aion-station/scripts/watchdog.sh" &>/dev/null &
ASTART
chmod +x "$AION_DIR/scripts/autostart.sh"

# Cargar el LaunchAgent
launchctl load "$PLIST_DIR/co.aionseg.station.plist" 2>/dev/null
log "Auto-inicio configurado via LaunchAgent"

# ═══════════════════════════════════════════════════════════════
# PASO 6: Watchdog de conectividad
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 6: Instalando watchdog...${NC}"

cat > "$AION_DIR/scripts/watchdog.sh" << 'WATCHDOG'
#!/bin/bash
AION_URL="https://aionseg.co"
CHECK_INTERVAL=120
LOG_FILE="$HOME/.aion-station/logs/watchdog.log"
MAX_LOG_BYTES=5000000

wlog() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

wlog "Watchdog iniciado"

while true; do
  sleep $CHECK_INTERVAL

  # 1. Verificar conectividad
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 10 "$AION_URL/api/health/ready" 2>/dev/null)
  if [ "$HTTP_CODE" != "200" ]; then
    wlog "WARN: AION responde $HTTP_CODE"
    RETRIES=0; RECOVERED=false
    while [ $RETRIES -lt 3 ] && [ "$RECOVERED" = "false" ]; do
      sleep 30
      HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 10 "$AION_URL/api/health/ready" 2>/dev/null)
      if [ "$HTTP_CODE" = "200" ]; then RECOVERED=true; wlog "OK: Recuperado"; fi
      RETRIES=$((RETRIES+1))
    done
    if [ "$RECOVERED" = "false" ]; then
      wlog "CRITICAL: AION no responde x3"
      osascript -e 'display alert "AION ALERTA" message "AION no responde. Verificar conexion a internet y contactar al supervisor." as critical' 2>/dev/null
    fi
  fi

  # 2. Chrome abierto?
  if ! pgrep -x "Google Chrome" >/dev/null 2>&1; then
    wlog "WARN: Chrome cerrado - reabriendo"
    open -a "Google Chrome" --args --profile-directory="AION-Station" --start-maximized "$AION_URL/dashboard"
  fi

  # 3. Chrome RAM check (>8GB = restart)
  CHROME_MEM=$(ps aux | grep "[G]oogle Chrome" | awk '{sum+=$6} END {print int(sum/1024)}')
  if [ "${CHROME_MEM:-0}" -gt 8192 ]; then
    wlog "WARN: Chrome ${CHROME_MEM}MB - reiniciando"
    osascript -e 'quit app "Google Chrome"' 2>/dev/null
    sleep 5
    open -a "Google Chrome" --args --profile-directory="AION-Station" --start-maximized "$AION_URL/dashboard"
  fi

  # 4. Status cada hora
  MINUTE=$(date '+%M')
  if [ "$MINUTE" = "00" ]; then
    UPTIME=$(uptime | awk -F'up ' '{print $2}' | awk -F',' '{print $1}')
    RAM_FREE=$(vm_stat | awk '/Pages free/ {print int($3*4096/1048576)}')
    CPU=$(top -l 1 -n 0 | awk '/CPU usage/ {print $3}' 2>/dev/null || echo "?")
    wlog "STATUS: Uptime=$UPTIME RAM_free=${RAM_FREE}MB CPU=$CPU"
  fi

  # 5. Log rotation
  if [ -f "$LOG_FILE" ] && [ $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null) -gt $MAX_LOG_BYTES ]; then
    mv "$LOG_FILE" "${LOG_FILE%.log}-$(date '+%Y%m%d').log"
  fi
done
WATCHDOG
chmod +x "$AION_DIR/scripts/watchdog.sh"
log "Watchdog instalado"

# ═══════════════════════════════════════════════════════════════
# PASO 7: Configuracion de audio
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 7: Configurando audio...${NC}"

# Poner volumen al 80%
osascript -e "set volume output volume 80" 2>/dev/null && log "Volumen al 80%" || warn "No se pudo ajustar volumen"

# Desactivar sonido de inicio (Mac Intel)
sudo nvram SystemAudioVolume=" " 2>/dev/null || true

# ═══════════════════════════════════════════════════════════════
# PASO 8: Firewall
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 8: Configurando firewall...${NC}"

# macOS firewall - permitir Chrome
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "$CHROME_BIN" --unblockapp "$CHROME_BIN" 2>/dev/null && log "Firewall: Chrome permitido" || warn "No se pudo configurar firewall (necesita sudo)"

# ═══════════════════════════════════════════════════════════════
# PASO 9: Guardar configuracion
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 9: Guardando configuracion...${NC}"

cat > "$AION_DIR/config/station.json" << CONFIG
{
  "station_name": "$STATION_NAME",
  "aion_url": "$AION_URL",
  "platform": "macOS",
  "macos_version": "$(sw_vers -productVersion 2>/dev/null || echo unknown)",
  "installed_at": "$(date '+%Y-%m-%d %H:%M:%S')",
  "installer_version": "1.0.0",
  "kiosk_mode": $KIOSK_MODE,
  "dual_monitor": $DUAL_MONITOR,
  "chrome_path": "$CHROME_BIN",
  "watchdog_interval": 120,
  "auto_restart_chrome": true,
  "max_chrome_memory_mb": 8192
}
CONFIG
log "Configuracion guardada en $AION_DIR/config/station.json"

# ═══════════════════════════════════════════════════════════════
# PASO 10: Script de desinstalacion
# ═══════════════════════════════════════════════════════════════

cat > "$AION_DIR/uninstall.sh" << 'UNINSTALL'
#!/bin/bash
echo "Desinstalando AION Station..."
launchctl unload "$HOME/Library/LaunchAgents/co.aionseg.station.plist" 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/co.aionseg.station.plist"
rm -rf "$HOME/Desktop/AION Monitor.app" "$HOME/Desktop/AION Kiosk.app" "$HOME/Desktop/AION LiveView.app"
sudo pmset -a sleep 10 displaysleep 10 2>/dev/null
defaults write com.apple.screensaver idleTime 300 2>/dev/null
echo "AION Station desinstalado."
echo "Para eliminar completamente: rm -rf $HOME/.aion-station"
UNINSTALL
chmod +x "$AION_DIR/uninstall.sh"

# ═══════════════════════════════════════════════════════════════
# RESUMEN
# ═══════════════════════════════════════════════════════════════

echo ""
echo -e "  ${GREEN}====================================================${NC}"
echo -e "  ${GREEN}|  INSTALACION COMPLETA                             |${NC}"
echo -e "  ${GREEN}|                                                   |${NC}"
echo -e "  ${GREEN}|  Estacion: $STATION_NAME${NC}"
echo -e "  ${GREEN}|  URL: $AION_URL${NC}"
echo -e "  ${GREEN}|                                                   |${NC}"
echo -e "  ${GREEN}|  [OK] Chrome con perfil dedicado AION             |${NC}"
echo -e "  ${GREEN}|  [OK] macOS 24/7 (sin sleep/screensaver)          |${NC}"
echo -e "  ${GREEN}|  [OK] Auto-inicio via LaunchAgent                 |${NC}"
echo -e "  ${GREEN}|  [OK] Watchdog de conectividad                    |${NC}"
echo -e "  ${GREEN}|  [OK] Firewall configurado                        |${NC}"
echo -e "  ${GREEN}|  [OK] Accesos directos en escritorio              |${NC}"
echo -e "  ${GREEN}|                                                   |${NC}"
echo -e "  ${GRAY}|  Desinstalar: bash $AION_DIR/uninstall.sh${NC}"
echo -e "  ${GREEN}|                                                   |${NC}"
echo -e "  ${GREEN}====================================================${NC}"
echo ""
log "Instalacion completada"
