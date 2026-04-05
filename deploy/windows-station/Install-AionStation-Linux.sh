#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# AION STATION INSTALLER — Linux (Ubuntu/Debian/Fedora)
# Clave Seguridad CTA — Central de Monitoreo 24/7
# ═══════════════════════════════════════════════════════════════
#
# EJECUTAR:
#   chmod +x Install-AionStation-Linux.sh
#   sudo ./Install-AionStation-Linux.sh
#
# O directamente:
#   curl -sL https://aionseg.co/installer/Install-AionStation-Linux.sh | sudo bash
# ═══════════════════════════════════════════════════════════════

AION_URL="${AION_URL:-https://aionseg.co}"
STATION_NAME="${STATION_NAME:-CCTV-LINUX-01}"
AION_DIR="/opt/aion-station"
USER_HOME=$(eval echo ~${SUDO_USER:-$USER})
REAL_USER="${SUDO_USER:-$USER}"
LOG_FILE="$AION_DIR/install.log"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

log() { echo -e "  ${GREEN}[OK]${NC} $1"; echo "[$(date)] [OK] $1" >> "$LOG_FILE" 2>/dev/null; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; echo "[$(date)] [WARN] $1" >> "$LOG_FILE" 2>/dev/null; }
fail() { echo -e "  ${RED}[ERROR]${NC} $1"; echo "[$(date)] [ERROR] $1" >> "$LOG_FILE" 2>/dev/null; }

echo ""
echo -e "  ${CYAN}====================================================${NC}"
echo -e "  ${CYAN}|   AION SECURITY PLATFORM                        |${NC}"
echo -e "  ${CYAN}|   Linux STATION INSTALLER v1.0                   |${NC}"
echo -e "  ${CYAN}|   Clave Seguridad CTA                           |${NC}"
echo -e "  ${CYAN}====================================================${NC}"
echo ""

# Verificar root
if [ "$(id -u)" -ne 0 ]; then
  fail "Ejecutar con sudo: sudo ./Install-AionStation-Linux.sh"
  exit 1
fi

mkdir -p "$AION_DIR"/{logs,config,scripts}
chown -R "$REAL_USER:$REAL_USER" "$AION_DIR"
echo "[$(date)] Instalacion iniciada - $STATION_NAME" > "$LOG_FILE"

# ═══ Detectar distro ═══
if [ -f /etc/os-release ]; then
  . /etc/os-release
  DISTRO=$ID
else
  DISTRO="unknown"
fi
log "Distro: $DISTRO ($PRETTY_NAME)"

# ═══════════════════════════════════════════════════════════════
# PASO 1: Instalar Chrome
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 1: Verificando Google Chrome...${NC}"

if ! command -v google-chrome &>/dev/null && ! command -v google-chrome-stable &>/dev/null; then
  warn "Chrome no encontrado - instalando..."
  case $DISTRO in
    ubuntu|debian|pop|linuxmint)
      wget -q -O /tmp/chrome.deb "https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb"
      apt-get install -y /tmp/chrome.deb >/dev/null 2>&1
      rm /tmp/chrome.deb
      ;;
    fedora|rhel|centos|rocky|alma)
      dnf install -y "https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm" >/dev/null 2>&1
      ;;
    arch|manjaro)
      su -c "yay -S --noconfirm google-chrome" "$REAL_USER" 2>/dev/null || warn "Instalar Chrome manualmente: yay -S google-chrome"
      ;;
    *)
      warn "Distro no soportada para auto-install. Instalar Chrome manualmente."
      ;;
  esac
  command -v google-chrome &>/dev/null && log "Chrome instalado" || command -v google-chrome-stable &>/dev/null && log "Chrome instalado" || fail "No se pudo instalar Chrome"
else
  CHROME_BIN=$(command -v google-chrome 2>/dev/null || command -v google-chrome-stable)
  log "Chrome encontrado: $CHROME_BIN"
fi

CHROME_BIN=$(command -v google-chrome 2>/dev/null || command -v google-chrome-stable 2>/dev/null || echo "/usr/bin/google-chrome-stable")

# ═══════════════════════════════════════════════════════════════
# PASO 2: Perfil Chrome AION
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 2: Configurando perfil Chrome...${NC}"

CHROME_PROFILE="$USER_HOME/.config/google-chrome/AION-Station"
mkdir -p "$CHROME_PROFILE"
chown -R "$REAL_USER:$REAL_USER" "$CHROME_PROFILE"

if [ ! -f "$CHROME_PROFILE/Preferences" ]; then
  cat > "$CHROME_PROFILE/Preferences" << 'PREFS'
{"profile":{"name":"AION Monitor","default_content_setting_values":{"notifications":1,"media_stream_mic":1,"media_stream_camera":1}},"browser":{"check_default_browser":false},"session":{"restore_on_startup":1}}
PREFS
  chown "$REAL_USER:$REAL_USER" "$CHROME_PROFILE/Preferences"
  log "Perfil Chrome AION creado"
fi

# ═══════════════════════════════════════════════════════════════
# PASO 3: Configurar Linux para 24/7
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 3: Configurando Linux 24/7...${NC}"

# Desactivar screensaver/lock
su -c "gsettings set org.gnome.desktop.screensaver lock-enabled false" "$REAL_USER" 2>/dev/null
su -c "gsettings set org.gnome.desktop.screensaver idle-activation-enabled false" "$REAL_USER" 2>/dev/null
su -c "gsettings set org.gnome.desktop.session idle-delay 0" "$REAL_USER" 2>/dev/null
su -c "gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing'" "$REAL_USER" 2>/dev/null
su -c "gsettings set org.gnome.settings-daemon.plugins.power idle-dim false" "$REAL_USER" 2>/dev/null
log "Screensaver/sleep desactivado"

# Desactivar auto-updates que reinicien
if [ -f /etc/apt/apt.conf.d/20auto-upgrades ]; then
  sed -i 's/Unattended-Upgrade "1"/Unattended-Upgrade "0"/' /etc/apt/apt.conf.d/20auto-upgrades 2>/dev/null
  log "Auto-upgrades desactivados"
fi

# Desactivar suspend con systemd
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null
log "Suspend/hibernate desactivado via systemd"

# ═══════════════════════════════════════════════════════════════
# PASO 4: Accesos directos (.desktop)
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 4: Creando accesos directos...${NC}"

DESKTOP_DIR="$USER_HOME/Desktop"
mkdir -p "$DESKTOP_DIR"

# AION Monitor
cat > "$DESKTOP_DIR/aion-monitor.desktop" << DESK1
[Desktop Entry]
Version=1.0
Name=AION Monitor
Comment=AION Security Monitor - Clave Seguridad
Exec=$CHROME_BIN --profile-directory="AION-Station" --start-maximized --autoplay-policy=no-user-gesture-required $AION_URL/dashboard
Icon=google-chrome
Terminal=false
Type=Application
Categories=Security;
DESK1
chmod +x "$DESKTOP_DIR/aion-monitor.desktop"
chown "$REAL_USER:$REAL_USER" "$DESKTOP_DIR/aion-monitor.desktop"
log "Acceso directo: AION Monitor"

# AION Kiosk
cat > "$DESKTOP_DIR/aion-kiosk.desktop" << DESK2
[Desktop Entry]
Version=1.0
Name=AION Kiosk
Comment=AION Pantalla Completa
Exec=$CHROME_BIN --profile-directory="AION-Station" --kiosk --autoplay-policy=no-user-gesture-required $AION_URL/dashboard
Icon=google-chrome
Terminal=false
Type=Application
DESK2
chmod +x "$DESKTOP_DIR/aion-kiosk.desktop"
chown "$REAL_USER:$REAL_USER" "$DESKTOP_DIR/aion-kiosk.desktop"
log "Acceso directo: AION Kiosk"

# ═══════════════════════════════════════════════════════════════
# PASO 5: Auto-inicio (systemd user service)
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 5: Configurando auto-inicio...${NC}"

SYSTEMD_DIR="$USER_HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_DIR"

cat > "$SYSTEMD_DIR/aion-station.service" << SVCFILE
[Unit]
Description=AION Station Auto-Start
After=graphical-session.target

[Service]
Type=oneshot
ExecStartPre=/bin/sleep 15
ExecStart=/bin/bash $AION_DIR/scripts/autostart.sh
RemainAfterExit=yes

[Install]
WantedBy=default.target
SVCFILE
chown "$REAL_USER:$REAL_USER" "$SYSTEMD_DIR/aion-station.service"

cat > "$AION_DIR/scripts/autostart.sh" << ASTART
#!/bin/bash
AION_URL="$AION_URL"
CHROME_BIN="$CHROME_BIN"

# Esperar conectividad
for i in \$(seq 1 30); do
  ping -c 1 -W 2 aionseg.co >/dev/null 2>&1 && break
  sleep 5
done

# Abrir AION
\$CHROME_BIN --profile-directory="AION-Station" --start-maximized --autoplay-policy=no-user-gesture-required "\$AION_URL/dashboard" &

# Iniciar watchdog
nohup bash $AION_DIR/scripts/watchdog.sh &>/dev/null &
ASTART
chmod +x "$AION_DIR/scripts/autostart.sh"
chown "$REAL_USER:$REAL_USER" "$AION_DIR/scripts/autostart.sh"

su -c "systemctl --user daemon-reload" "$REAL_USER" 2>/dev/null
su -c "systemctl --user enable aion-station.service" "$REAL_USER" 2>/dev/null
loginctl enable-linger "$REAL_USER" 2>/dev/null
log "Auto-inicio configurado via systemd user service"

# ═══════════════════════════════════════════════════════════════
# PASO 6: Watchdog
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 6: Instalando watchdog...${NC}"

cat > "$AION_DIR/scripts/watchdog.sh" << 'WATCHDOG'
#!/bin/bash
AION_URL="https://aionseg.co"
CHECK_INTERVAL=120
LOG_FILE="/opt/aion-station/logs/watchdog.log"

wlog() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }
wlog "Watchdog iniciado"

while true; do
  sleep $CHECK_INTERVAL

  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 10 "$AION_URL/api/health/ready" 2>/dev/null)
  if [ "$HTTP_CODE" != "200" ]; then
    wlog "WARN: AION responde $HTTP_CODE"
    RETRIES=0; OK=false
    while [ $RETRIES -lt 3 ] && [ "$OK" = "false" ]; do
      sleep 30
      HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout 10 "$AION_URL/api/health/ready" 2>/dev/null)
      [ "$HTTP_CODE" = "200" ] && OK=true && wlog "OK: Recuperado"
      RETRIES=$((RETRIES+1))
    done
    [ "$OK" = "false" ] && wlog "CRITICAL: AION no responde x3" && notify-send "AION ALERTA" "AION no responde. Verificar conexion." -u critical 2>/dev/null
  fi

  if ! pgrep -f "chrome.*AION-Station" >/dev/null 2>&1; then
    wlog "WARN: Chrome cerrado - reabriendo"
    CHROME_BIN=$(command -v google-chrome 2>/dev/null || command -v google-chrome-stable)
    [ -n "$CHROME_BIN" ] && $CHROME_BIN --profile-directory="AION-Station" --start-maximized "$AION_URL/dashboard" &
  fi

  CHROME_MEM=$(ps aux | grep "[c]hrome.*AION" | awk '{sum+=$6} END {print int(sum/1024)}')
  if [ "${CHROME_MEM:-0}" -gt 8192 ]; then
    wlog "WARN: Chrome ${CHROME_MEM}MB - reiniciando"
    pkill -f "chrome.*AION-Station"
    sleep 5
    CHROME_BIN=$(command -v google-chrome 2>/dev/null || command -v google-chrome-stable)
    [ -n "$CHROME_BIN" ] && $CHROME_BIN --profile-directory="AION-Station" --start-maximized "$AION_URL/dashboard" &
  fi

  MINUTE=$(date '+%M')
  if [ "$MINUTE" = "00" ]; then
    UPTIME=$(uptime -p 2>/dev/null || uptime)
    RAM=$(free -h | awk '/Mem:/{print $7}')
    CPU=$(top -bn1 | awk '/Cpu/ {print $2}')
    wlog "STATUS: $UPTIME RAM_free=$RAM CPU=${CPU}%"
  fi

  [ -f "$LOG_FILE" ] && [ $(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0) -gt 5000000 ] && mv "$LOG_FILE" "${LOG_FILE%.log}-$(date '+%Y%m%d').log"
done
WATCHDOG
chmod +x "$AION_DIR/scripts/watchdog.sh"
chown "$REAL_USER:$REAL_USER" "$AION_DIR/scripts/watchdog.sh"
log "Watchdog instalado"

# ═══════════════════════════════════════════════════════════════
# PASO 7: Guardar config + desinstalador
# ═══════════════════════════════════════════════════════════════

echo -e "\n  ${CYAN}PASO 7: Finalizando...${NC}"

cat > "$AION_DIR/config/station.json" << CONFIG
{"station_name":"$STATION_NAME","aion_url":"$AION_URL","platform":"linux","distro":"$DISTRO","installed_at":"$(date '+%Y-%m-%d %H:%M:%S')","version":"1.0.0"}
CONFIG

cat > "$AION_DIR/uninstall.sh" << 'UNINST'
#!/bin/bash
echo "Desinstalando AION Station..."
systemctl --user disable aion-station.service 2>/dev/null
rm -f "$HOME/.config/systemd/user/aion-station.service"
rm -f "$HOME/Desktop/aion-monitor.desktop" "$HOME/Desktop/aion-kiosk.desktop"
sudo systemctl unmask sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null
echo "Desinstalado. Para eliminar: sudo rm -rf /opt/aion-station"
UNINST
chmod +x "$AION_DIR/uninstall.sh"

chown -R "$REAL_USER:$REAL_USER" "$AION_DIR"

echo ""
echo -e "  ${GREEN}====================================================${NC}"
echo -e "  ${GREEN}|  INSTALACION COMPLETA                             |${NC}"
echo -e "  ${GREEN}|  Estacion: $STATION_NAME${NC}"
echo -e "  ${GREEN}|  [OK] Chrome, 24/7, Auto-inicio, Watchdog         |${NC}"
echo -e "  ${GREEN}|  Desinstalar: bash $AION_DIR/uninstall.sh${NC}"
echo -e "  ${GREEN}====================================================${NC}"
echo ""
log "Instalacion completada"
