#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# OpenClaw Operations — Comandos de mantenimiento diario
# Ejecutar como: sudo -iu openclaw bash openclaw-ops.sh [comando]
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_DIR="${HOME}/Backups"
mkdir -p "$BACKUP_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[FAIL]${NC} $*"; }

CMD="${1:-check}"

case "$CMD" in

    check|status)
        echo "=== OpenClaw Status ==="
        openclaw status --all 2>/dev/null || warn "openclaw status fallo"

        echo ""
        echo "=== Health ==="
        openclaw health --json 2>/dev/null | jq '.' 2>/dev/null || warn "openclaw health fallo"

        echo ""
        echo "=== AION Status ==="
        sudo /usr/local/sbin/aion-health
        ;;

    audit)
        echo "=== Security Audit ==="
        openclaw security audit --deep 2>&1
        ;;

    backup)
        TIMESTAMP=$(date +%Y%m%d-%H%M%S)
        BACKUP_FILE="${BACKUP_DIR}/openclaw-backup-${TIMESTAMP}"
        echo "=== Backup ==="
        openclaw backup create --verify --output "$BACKUP_FILE" 2>&1
        info "Backup: $BACKUP_FILE"

        # Limpiar backups antiguos (mantener ultimos 7)
        ls -t "${BACKUP_DIR}"/openclaw-backup-* 2>/dev/null | tail -n +8 | xargs rm -rf 2>/dev/null || true
        info "Backups antiguos limpiados"
        ;;

    update)
        echo "=== Update ==="
        openclaw update 2>&1

        echo ""
        echo "=== Recrear Sandboxes ==="
        openclaw sandbox recreate --all 2>&1 || warn "sandbox recreate fallo (puede ser normal)"

        echo ""
        echo "=== Validar Config ==="
        openclaw config validate 2>&1
        ;;

    full-maintenance)
        echo "═══════════════════════════════════════════"
        echo "  Mantenimiento Completo OpenClaw + AION"
        echo "═══════════════════════════════════════════"
        echo ""

        echo "1/5 Status..."
        openclaw status --all 2>/dev/null || warn "status fallo"

        echo ""
        echo "2/5 Health..."
        openclaw health --json 2>/dev/null | jq '.' 2>/dev/null || warn "health fallo"

        echo ""
        echo "3/5 Security Audit..."
        openclaw security audit --deep 2>&1 || warn "audit fallo"

        echo ""
        echo "4/5 Backup..."
        TIMESTAMP=$(date +%Y%m%d-%H%M%S)
        openclaw backup create --verify --output "${BACKUP_DIR}/openclaw-backup-${TIMESTAMP}" 2>&1 || warn "backup fallo"
        ls -t "${BACKUP_DIR}"/openclaw-backup-* 2>/dev/null | tail -n +8 | xargs rm -rf 2>/dev/null || true

        echo ""
        echo "5/5 AION Health..."
        sudo /usr/local/sbin/aion-health

        echo ""
        echo "═══════════════════════════════════════════"
        info "Mantenimiento completado"
        ;;

    channel-login)
        echo "=== Channel Login ==="
        openclaw channels login 2>&1
        ;;

    validate)
        echo "=== Config Validate ==="
        openclaw config validate 2>&1
        ;;

    *)
        echo "OpenClaw Operations"
        echo ""
        echo "Uso: $0 <comando>"
        echo ""
        echo "Comandos:"
        echo "  check             Estado de OpenClaw + AION"
        echo "  audit             Security audit profundo"
        echo "  backup            Backup con verificacion"
        echo "  update            Actualizar OpenClaw + recrear sandboxes"
        echo "  full-maintenance  Mantenimiento completo (5 pasos)"
        echo "  channel-login     Emparejar canal (WhatsApp/Telegram)"
        echo "  validate          Validar configuracion"
        exit 1
        ;;
esac
