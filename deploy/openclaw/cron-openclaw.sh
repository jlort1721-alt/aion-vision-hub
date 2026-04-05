#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Crontab para OpenClaw — instalar con: sudo crontab -u openclaw cron-openclaw.sh
# O copiar las lineas al crontab: sudo -iu openclaw crontab -e
# ═══════════════════════════════════════════════════════════════════

# Formato crontab (copiar estas lineas):
cat <<'CRON'
# OpenClaw Maintenance Cron Jobs
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin:/usr/local/sbin
MAILTO=""

# Health check cada 5 minutos — log silencioso, alerta solo si falla
*/5 * * * * /usr/local/sbin/aion-health > /home/openclaw/.openclaw/last-health.log 2>&1 || echo "$(date): HEALTH FAIL" >> /home/openclaw/.openclaw/health-alerts.log

# Backup diario a las 3:00 AM (antes del session reset de las 4:00)
0 3 * * * /home/openclaw/openclaw-ops.sh backup >> /home/openclaw/.openclaw/cron-backup.log 2>&1

# Security audit semanal (domingos 2:00 AM)
0 2 * * 0 /home/openclaw/openclaw-ops.sh audit >> /home/openclaw/.openclaw/cron-audit.log 2>&1

# Limpiar logs de cron mayores a 30 dias
0 4 1 * * find /home/openclaw/.openclaw/ -name "cron-*.log" -mtime +30 -delete 2>/dev/null
0 4 1 * * find /home/openclaw/.openclaw/ -name "health-alerts.log" -size +10M -delete 2>/dev/null
CRON
