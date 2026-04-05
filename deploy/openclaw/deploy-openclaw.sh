#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Deploy OpenClaw a VPS AION — ejecutar desde tu laptop
# Sube archivos de configuracion y ejecuta setup remoto
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

PEM_KEY="${PEM_KEY:-$HOME/Downloads/clave-demo-aion.pem}"
VPS_HOST="${VPS_HOST:-18.230.40.6}"
VPS_USER="${VPS_USER:-ubuntu}"
REMOTE_TMP="/tmp/openclaw-deploy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Pre-checks ────────────────────────────────────────────────
if [[ ! -f "$PEM_KEY" ]]; then
    error "PEM key no encontrada: $PEM_KEY"
    echo "Usa: PEM_KEY=/ruta/a/key.pem $0"
    exit 1
fi

# Verificar que .env tiene valores reales
if grep -q "REEMPLAZA" "$SCRIPT_DIR/openclaw.env" 2>/dev/null; then
    error "Edita openclaw.env y reemplaza TODOS los valores REEMPLAZA_* antes de deployar"
    grep "REEMPLAZA" "$SCRIPT_DIR/openclaw.env"
    exit 1
fi

# Verificar que openclaw.json tiene numero de telefono
if grep -q "REEMPLAZA_TU_NUMERO" "$SCRIPT_DIR/openclaw.json" 2>/dev/null; then
    error "Edita openclaw.json y reemplaza +57REEMPLAZA_TU_NUMERO con tu numero real"
    exit 1
fi

SSH_CMD="ssh -i \"$PEM_KEY\" -o StrictHostKeyChecking=accept-new"
SCP_CMD="scp -i \"$PEM_KEY\" -o StrictHostKeyChecking=accept-new"

info "=== Deploy OpenClaw a $VPS_HOST ==="

# ── 1. Verificar conectividad ─────────────────────────────────
info "Verificando conexion SSH..."
$SSH_CMD "$VPS_USER@$VPS_HOST" "echo 'SSH OK: $(hostname)'" || {
    error "No se puede conectar a $VPS_HOST"
    exit 1
}

# ── 2. Subir archivos de configuracion ────────────────────────
info "Subiendo archivos..."
$SSH_CMD "$VPS_USER@$VPS_HOST" "mkdir -p $REMOTE_TMP"

FILES=(
    setup-openclaw.sh
    openclaw.json
    openclaw.env
    exec-approvals.json
    install-wrappers.sh
    openclaw-ops.sh
    cron-openclaw.sh
    setup-db-readonly.sql
    setup-aion-apikey.sh
    verify-openclaw.sh
    test-integration.sh
    logrotate-openclaw.conf
    aion-event-bridge.sh
    aion-event-bridge.service
    setup-devops-workspace.sh
    install-devops-wrappers.sh
    aion-continuous-improvement.sh
    aion-continuous-improvement.service
    aion-validate-all.sh
    aion-module-map.json
)

for F in "${FILES[@]}"; do
    if [[ -f "$SCRIPT_DIR/$F" ]]; then
        $SCP_CMD "$SCRIPT_DIR/$F" "$VPS_USER@$VPS_HOST:$REMOTE_TMP/$F"
        info "  Subido: $F"
    else
        warn "  No encontrado: $F"
    fi
done

# ── 3. Ejecutar setup ─────────────────────────────────────────
info "Ejecutando setup remoto..."
$SSH_CMD "$VPS_USER@$VPS_HOST" "sudo bash $REMOTE_TMP/setup-openclaw.sh"

# ── 4. Copiar scripts a home de openclaw ──────────────────────
info "Instalando scripts de operaciones..."
$SSH_CMD "$VPS_USER@$VPS_HOST" "sudo cp $REMOTE_TMP/openclaw-ops.sh /home/openclaw/openclaw-ops.sh && sudo chown openclaw:openclaw /home/openclaw/openclaw-ops.sh && sudo chmod 750 /home/openclaw/openclaw-ops.sh"
$SSH_CMD "$VPS_USER@$VPS_HOST" "sudo cp $REMOTE_TMP/aion-continuous-improvement.sh /home/openclaw/aion-continuous-improvement.sh && sudo chown openclaw:openclaw /home/openclaw/aion-continuous-improvement.sh && sudo chmod 750 /home/openclaw/aion-continuous-improvement.sh"

# ── 4b. Setup DevOps workspace ────────────────────────────────
info "Setting up DevOps workspace..."
$SSH_CMD "$VPS_USER@$VPS_HOST" "sudo bash $REMOTE_TMP/setup-devops-workspace.sh" || warn "DevOps workspace setup had warnings"

# ── 4c. Install DevOps wrappers ───────────────────────────────
info "Installing DevOps wrappers..."
$SSH_CMD "$VPS_USER@$VPS_HOST" "sudo bash $REMOTE_TMP/install-devops-wrappers.sh" || warn "DevOps wrappers had warnings"

# ── 4d. Install continuous improvement service ────────────────
info "Installing continuous improvement service..."
$SSH_CMD "$VPS_USER@$VPS_HOST" "sudo cp $REMOTE_TMP/aion-continuous-improvement.service /etc/systemd/system/ && sudo systemctl daemon-reload" || warn "CI service install had warnings"

# ── 5. Setup DB read-only ─────────────────────────────────────
info "Configurando usuario PostgreSQL read-only..."
warn "Edita el password en setup-db-readonly.sql y ejecuta manualmente:"
echo "  ssh -i $PEM_KEY $VPS_USER@$VPS_HOST"
echo "  sudo -u postgres psql -f $REMOTE_TMP/setup-db-readonly.sql"

# ── 6. Limpiar ────────────────────────────────────────────────
info "Limpiando archivos temporales (conservando SQL para ejecucion manual)..."
$SSH_CMD "$VPS_USER@$VPS_HOST" "rm -f $REMOTE_TMP/setup-openclaw.sh $REMOTE_TMP/install-wrappers.sh $REMOTE_TMP/openclaw.env"

# ── 7. Verificacion ──────────────────────────────────────────
info "Ejecutando verificacion..."
$SSH_CMD "$VPS_USER@$VPS_HOST" "sudo bash $REMOTE_TMP/verify-openclaw.sh" || warn "Verificacion reporto warnings"

echo ""
echo "═══════════════════════════════════════════════════════════"
info "Deploy completado."
echo ""
echo "  Pasos manuales restantes:"
echo "  1. SSH a VPS:    ssh -i $PEM_KEY $VPS_USER@$VPS_HOST"
echo "  2. Setup DB:     sudo -u postgres psql -f $REMOTE_TMP/setup-db-readonly.sql"
echo "  3. API Key:      sudo bash $REMOTE_TMP/setup-aion-apikey.sh"
echo "  4. Onboard:      sudo -iu openclaw openclaw onboard --install-daemon"
echo "  5. Canal:        sudo -iu openclaw openclaw channels login"
echo "  6. Audit:        sudo -iu openclaw openclaw security audit --fix"
echo "  7. Cron:         sudo -iu openclaw crontab -e  (copiar de cron-openclaw.sh)"
echo "  8. Event bridge: sudo systemctl enable --now aion-event-bridge"
echo "  9. CI Agent:     sudo systemctl enable --now aion-continuous-improvement"
echo "  10. Test:        sudo bash $REMOTE_TMP/test-integration.sh"
echo ""
echo "  Acceso Control UI:"
echo "  ssh -N -L 18789:127.0.0.1:18789 -i $PEM_KEY $VPS_USER@$VPS_HOST"
echo "  http://127.0.0.1:18789/"
echo "═══════════════════════════════════════════════════════════"
