#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# OpenClaw Setup for AION VPS (18.230.40.6)
# Plan B: Same EC2, sidecar logico — usuario dedicado, sandbox Docker
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

readonly OPENCLAW_USER="openclaw"
readonly OPENCLAW_HOME="/home/${OPENCLAW_USER}"
readonly AION_LOGS="/opt/aion/logs"
readonly BACKUP_DIR="/opt/aion/backups/openclaw"

# ── Colores ───────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
die()   { error "$*"; exit 1; }

# ── Pre-checks ────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Ejecutar como root: sudo bash $0"
[[ -f /etc/os-release ]] && source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "Solo Ubuntu soportado (detectado: ${ID:-unknown})"

info "=== OpenClaw Setup para AION VPS ==="
info "OS: ${PRETTY_NAME:-Ubuntu}"
info "Host: $(hostname)"

# ── Verificar que AION esta corriendo ─────────────────────────────
if ! command -v pm2 &>/dev/null; then
    die "PM2 no encontrado. AION debe estar corriendo antes de instalar OpenClaw."
fi

PM2_LIST=$(su - ubuntu -c "pm2 jlist" 2>/dev/null || echo "[]")
AION_PROCS=$(echo "$PM2_LIST" | jq -r '.[].name' 2>/dev/null | head -10)
if [[ -z "$AION_PROCS" ]]; then
    warn "No se detectaron procesos PM2. Continuar de todos modos? (y/N)"
    read -r CONFIRM
    [[ "$CONFIRM" == "y" || "$CONFIRM" == "Y" ]] || exit 0
else
    info "Procesos PM2 detectados:"
    echo "$AION_PROCS" | sed 's/^/  - /'
fi

# ── Verificar Docker ──────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    info "Instalando Docker..."
    apt-get update -qq
    apt-get install -y -qq docker.io
    systemctl enable --now docker
else
    info "Docker ya instalado: $(docker --version)"
fi

# ── Dependencias basicas ──────────────────────────────────────────
info "Instalando dependencias..."
apt-get install -y -qq curl git jq ca-certificates 2>/dev/null

# ── Crear usuario dedicado ────────────────────────────────────────
if id "$OPENCLAW_USER" &>/dev/null; then
    info "Usuario '$OPENCLAW_USER' ya existe"
else
    info "Creando usuario '$OPENCLAW_USER'..."
    adduser --disabled-password --gecos "OpenClaw Service" "$OPENCLAW_USER"
fi

# Agregar a grupo docker (sin acceso a sudo generico)
usermod -aG docker "$OPENCLAW_USER"

# ── Directorios con permisos correctos ────────────────────────────
info "Creando estructura de directorios..."

sudo -u "$OPENCLAW_USER" bash <<'USEREOF'
set -euo pipefail

mkdir -p ~/.openclaw/{workspace,workspace-aion-ops,workspace-aion-reader}
chmod 700 ~/.openclaw
chmod 700 ~/.openclaw/workspace*

# Workspace para agente global (solo mensajeria)
mkdir -p ~/.openclaw/workspace/shared

# Workspace aislado para operaciones
mkdir -p ~/.openclaw/workspace-aion-ops/logs

# Workspace aislado para lectura
mkdir -p ~/.openclaw/workspace-aion-reader/reports
USEREOF

# Directorio de backups
mkdir -p "$BACKUP_DIR"
chown "$OPENCLAW_USER:$OPENCLAW_USER" "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"

# ── Acceso lectura a logs de AION (sin escribir) ──────────────────
info "Configurando acceso a logs de AION..."
if [[ -d "$AION_LOGS" ]]; then
    # Crear grupo compartido para lectura de logs
    groupadd -f aion-log-readers
    usermod -aG aion-log-readers "$OPENCLAW_USER"

    # Los logs deben ser legibles por el grupo
    chgrp -R aion-log-readers "$AION_LOGS" 2>/dev/null || true
    chmod -R g+r "$AION_LOGS" 2>/dev/null || true
    # Asegurar que nuevos logs hereden el grupo
    chmod g+s "$AION_LOGS" 2>/dev/null || true
else
    warn "Directorio de logs AION no encontrado: $AION_LOGS"
fi

# ── Instalar OpenClaw ─────────────────────────────────────────────
info "Instalando OpenClaw..."
sudo -iu "$OPENCLAW_USER" bash <<'INSTALLEOF'
set -euo pipefail

# Instalar OpenClaw sin onboarding automatico
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --no-onboard

echo ""
echo "OpenClaw instalado. Version:"
openclaw --version 2>/dev/null || echo "(verificar PATH)"
INSTALLEOF

# ── Crear archivos de configuracion ──────────────────────────────
info "Desplegando configuracion..."

# Copiar configs (se crean con el script companion)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$SCRIPT_DIR/openclaw.env" ]]; then
    cp "$SCRIPT_DIR/openclaw.env" "$OPENCLAW_HOME/.openclaw/.env"
    chown "$OPENCLAW_USER:$OPENCLAW_USER" "$OPENCLAW_HOME/.openclaw/.env"
    chmod 600 "$OPENCLAW_HOME/.openclaw/.env"
    info "Archivo .env desplegado"
else
    warn "Crear $SCRIPT_DIR/openclaw.env antes de arrancar OpenClaw"
fi

if [[ -f "$SCRIPT_DIR/openclaw.json" ]]; then
    cp "$SCRIPT_DIR/openclaw.json" "$OPENCLAW_HOME/.openclaw/openclaw.json"
    chown "$OPENCLAW_USER:$OPENCLAW_USER" "$OPENCLAW_HOME/.openclaw/openclaw.json"
    chmod 600 "$OPENCLAW_HOME/.openclaw/openclaw.json"
    info "Config openclaw.json desplegada"
fi

if [[ -f "$SCRIPT_DIR/exec-approvals.json" ]]; then
    cp "$SCRIPT_DIR/exec-approvals.json" "$OPENCLAW_HOME/.openclaw/exec-approvals.json"
    chown "$OPENCLAW_USER:$OPENCLAW_USER" "$OPENCLAW_HOME/.openclaw/exec-approvals.json"
    chmod 600 "$OPENCLAW_HOME/.openclaw/exec-approvals.json"
    info "Exec approvals desplegadas"
fi

# ── Instalar wrappers AION ────────────────────────────────────────
info "Instalando wrappers de operacion AION..."

if [[ -f "$SCRIPT_DIR/install-wrappers.sh" ]]; then
    bash "$SCRIPT_DIR/install-wrappers.sh"
else
    warn "install-wrappers.sh no encontrado. Ejecutar manualmente."
fi

# ── Preparar sandbox Docker ───────────────────────────────────────
info "Preparando sandbox Docker..."
sudo -iu "$OPENCLAW_USER" bash <<'DOCKEREOF'
set -euo pipefail

# Verificar acceso a Docker
docker info >/dev/null 2>&1 || { echo "ERROR: Sin acceso a Docker"; exit 1; }

# Descargar imagen de sandbox
docker pull openclaw-sandbox:latest 2>/dev/null && \
    docker tag openclaw-sandbox:latest openclaw-sandbox:bookworm-slim || \
    echo "WARN: No se pudo descargar openclaw-sandbox:latest. Configurar manualmente."
DOCKEREOF

# ── Proteger .env de AION contra lectura por openclaw ─────────────
info "Protegiendo secretos de AION..."
if [[ -f /opt/aion/app/backend/.env ]]; then
    chmod 640 /opt/aion/app/backend/.env
    chown ubuntu:ubuntu /opt/aion/app/backend/.env
    info ".env de AION protegido (640 ubuntu:ubuntu)"
fi

# ── Logrotate ─────────────────────────────────────────────────────
if [[ -f "$SCRIPT_DIR/logrotate-openclaw.conf" ]]; then
    cp "$SCRIPT_DIR/logrotate-openclaw.conf" /etc/logrotate.d/openclaw
    chmod 644 /etc/logrotate.d/openclaw
    info "Logrotate configurado"
fi

# ── Event Bridge service ──────────────────────────────────────────
if [[ -f "$SCRIPT_DIR/aion-event-bridge.sh" ]]; then
    cp "$SCRIPT_DIR/aion-event-bridge.sh" "$OPENCLAW_HOME/aion-event-bridge.sh"
    chown "$OPENCLAW_USER:$OPENCLAW_USER" "$OPENCLAW_HOME/aion-event-bridge.sh"
    chmod 750 "$OPENCLAW_HOME/aion-event-bridge.sh"
    info "Event bridge script instalado"
fi
if [[ -f "$SCRIPT_DIR/aion-event-bridge.service" ]]; then
    cp "$SCRIPT_DIR/aion-event-bridge.service" /etc/systemd/system/aion-event-bridge.service
    systemctl daemon-reload
    info "Event bridge systemd unit instalada (no habilitada aun)"
fi

# ── Seguridad: verificar que 18789 NO esta abierto ───────────────
info "Verificando seguridad de puertos..."

# Verificar iptables/nftables
if command -v ufw &>/dev/null; then
    UFW_STATUS=$(ufw status 2>/dev/null | grep "18789" || true)
    if [[ -n "$UFW_STATUS" ]]; then
        warn "Puerto 18789 encontrado en UFW. Eliminar regla:"
        echo "  sudo ufw delete allow 18789"
    fi
fi

# Verificar que nginx NO tiene proxy a 18789
if grep -rq "18789" /etc/nginx/ 2>/dev/null; then
    die "Nginx tiene referencia a puerto 18789. NO exponer el Control UI."
fi

info "Puerto 18789 no expuesto publicamente. OK."

# ── Resumen ───────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
info "Setup completado."
echo ""
echo "  Proximos pasos:"
echo "  1. Editar /home/openclaw/.openclaw/.env con tus API keys"
echo "  2. Validar config:  sudo -iu openclaw openclaw config validate"
echo "  3. Onboarding:      sudo -iu openclaw openclaw onboard --install-daemon"
echo "  4. Security audit:  sudo -iu openclaw openclaw security audit --fix"
echo "  5. Verificar:       sudo -iu openclaw openclaw status --all"
echo ""
echo "  Acceso remoto (desde tu laptop):"
echo "  ssh -N -L 18789:127.0.0.1:18789 -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6"
echo "  Luego abre: http://127.0.0.1:18789/"
echo "═══════════════════════════════════════════════════════════"
