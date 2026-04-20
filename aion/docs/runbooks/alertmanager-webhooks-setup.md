# Runbook — Configurar webhooks reales en Alertmanager

**Propietario:** Isabella
**Prioridad:** ALTA — hoy hay 37 alertas firing pero NO LLEGAN A NINGÚN LADO
**Tiempo estimado:** 30 minutos

## Problema actual

`/opt/aion/observability/alertmanager/alertmanager.yml` tiene los receivers configurados con placeholders:

```yaml
slack_configs:
  - api_url: 'https://hooks.slack.com/services/placeholder'   # ← FAKE
  - smtp_auth_password: 'placeholder'                         # ← FAKE
```

Resultado: Prometheus detecta problemas (PM2AppDown, PostgresDown, etc.) pero **nadie se entera**.

## Solución

### Paso 1 — Crear Slack webhook

1. Ir a <https://api.slack.com/apps> → **Create New App** → *From scratch*.
2. App name: `aion-alerts` — Workspace: el tuyo.
3. *Incoming Webhooks* → On → **Add New Webhook to Workspace**.
4. Canal sugerido: `#aion-alerts` (crearlo primero si no existe).
5. Copiar la URL — formato `https://hooks.slack.com/services/T.../B.../xxx`.
6. Repetir para `#aion-vision` si quieres canal separado para video.

### Paso 2 — Obtener credenciales SMTP

Opciones (una):
- **SendGrid** (ya configurado como smarthost): <https://app.sendgrid.com/settings/api_keys> → crear API key con scope "Mail Send".
- **AWS SES**: si tienes cuenta AWS, crear SMTP credentials desde SES console.

### Paso 3 — Actualizar alertmanager.yml

```bash
ssh aion-vps '
  # Backup
  sudo cp /opt/aion/observability/alertmanager/alertmanager.yml \
    /var/backups/aion/alertmanager.yml.$(date +%Y%m%d-%H%M%S).bak

  # Editar (reemplazar SOLO los placeholders)
  sudo -u ubuntu nano /opt/aion/observability/alertmanager/alertmanager.yml
'
```

Reemplazar en el archivo:

```yaml
global:
  smtp_auth_password: 'SG.xxxxx...'   # de SendGrid

receivers:
  - name: default-slack
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/T.../B.../xxx'   # del paso 1

  - name: slack-vision
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/T.../B.../yyy'   # canal vision
```

### Paso 4 — Validar y reload

```bash
ssh aion-vps '
  # Validar config
  docker exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

  # Reload sin restart
  curl -s -X POST http://127.0.0.1:9093/-/reload && echo "reload ok"

  # Ver configuración activa
  curl -s http://127.0.0.1:9093/api/v2/status | python3 -m json.tool | head -40
'
```

### Paso 5 — Forzar una alerta de prueba

```bash
ssh aion-vps '
  # Envío directo al alertmanager API
  curl -s -X POST http://127.0.0.1:9093/api/v2/alerts -H "Content-Type: application/json" -d "[{
    \"labels\": {
      \"alertname\": \"TestAlertFromRunbook\",
      \"severity\": \"high\",
      \"instance\": \"manual-test\"
    },
    \"annotations\": {
      \"summary\": \"Prueba de integración Slack — $(date -u)\"
    }
  }]"
'
```

En máximo 30s debe aparecer el mensaje en `#aion-alerts`.

### Paso 6 — Diagnóstico de las 37 alertas actualmente firing

```bash
ssh aion-vps '
  curl -s http://127.0.0.1:9090/api/v1/alerts | python3 -c "
import json, sys, collections
alerts = json.load(sys.stdin)[\"data\"][\"alerts\"]
by_name = collections.Counter(a[\"labels\"][\"alertname\"] for a in alerts)
for name, count in by_name.most_common():
    print(f\"{count:>3}× {name}\")
"
'
```

Para cada una, investigar:
- **PostgresDown** (falso positivo): `docker logs postgres-exporter --tail 30 | grep -iE "error|auth"` → probablemente credenciales del exporter incorrectas.
- **PM2AppDown** (falso positivo probable): el PM2 exporter reporta apps que ya fueron eliminadas o renombradas. Revisar `curl http://127.0.0.1:9209/metrics | grep pm2_status`.

## Checklist

- [ ] Slack webhook creado y URL copiada.
- [ ] SMTP credentials en SendGrid/SES creadas.
- [ ] `alertmanager.yml` actualizado sin `placeholder`.
- [ ] `amtool check-config` OK.
- [ ] `curl -X POST /-/reload` OK.
- [ ] Alerta de prueba llegó a #aion-alerts.
- [ ] Las 37 alertas pre-existentes investigadas (false positives corregidos o silenciadas justificadamente).
