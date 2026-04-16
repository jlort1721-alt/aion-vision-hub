# 🆘 AION On-Call Quick Card

**Imprime esto y pégalo cerca del laptop.**

---

## Primer comando SIEMPRE

```bash
ssh aion@vps.aionseg.co "
  pm2 list | head -25
  curl -fsS http://127.0.0.1:3000/api/health || echo 'API DOWN'
  df -h / | tail -1
  uptime
  basename \$(readlink -f /etc/nginx/conf.d/aion-upstream.conf) .conf
"
```

## Si todo está mal y no sabes qué hacer

```bash
ssh aion@vps.aionseg.co "/opt/aion/scripts/rollback.sh"
```

Esto te devuelve al último deploy estable en <15 segundos.

## Silenciar alerta ruidosa por 1 hora

```bash
amtool silence add alertname=AionAuthedUrlDown --duration=1h \
  --comment="investigando" --author="<tu-nombre>"
```

## URLs importantes

- Producción: https://aionseg.co
- Grafana: https://metrics.aionseg.co
- Alertmanager: https://alerts.aionseg.co
- API health: https://aionseg.co/api/health
- Vision Hub health: https://aionseg.co/api/vision-hub/health

## Contactos

- **Isabella** (owner): WhatsApp +57 304 590 8976 (voz) — SMS al US number de Twilio
- **Anthropic API**: https://status.anthropic.com
- **Twilio**: https://status.twilio.com

## Escalación

| Duración del incidente | Acción |
|------------------------|--------|
| 0-15 min | Tú resuelves |
| 15-30 min | Despertar a Isabella |
| 30-60 min | Comunicar a clientes vía WhatsApp Business |
| >60 min | Status page público + plan de comunicación |

## Recordatorios

- ✅ Toma snapshot de logs ANTES de reiniciar.
- ✅ Documenta la línea de tiempo en Slack mientras lo haces (te lo agradecerás luego).
- ✅ Si no estás 100% seguro de un comando destructivo, **NO lo corras**. Despierta a alguien.
- ✅ Después del incidente, escribe el post-mortem en menos de 24h.
