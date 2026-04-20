# Rotación del Bearer Token del webhook WhatsApp Alertmanager

**Motivo:** el Alertmanager en `/opt/aion/observability/alertmanager/alertmanager.yml` tiene un `credentials:` Bearer hardcoded en el receiver `oncall-all-channels` apuntando a `http://aion-comms:3300/api/alerts/whatsapp-oncall`. Ese token es el dispositivo de autenticación del webhook interno que dispara mensajes WhatsApp en incidentes críticos.

El token actual apareció en el transcript de Claude durante la Fase 2 inicial — ya debe considerarse comprometido y rotarse.

---

## 1. Localizar el token y el servicio que lo consume

```bash
ssh aion-vps

# Token en alertmanager.yml (redactado automáticamente)
sudo grep -A2 "whatsapp-oncall" /opt/aion/observability/alertmanager/alertmanager.yml | \
  sed -E 's|(credentials:\s*).*|\1<REDACTED>|'

# Servicio que atiende /api/alerts/whatsapp-oncall
docker ps --format 'table {{.Names}}\t{{.Ports}}' | grep aion-comms
# → aion-comms listens on :3300 normalmente, dentro de la red docker
```

El servicio `aion-comms` corre en docker-compose bajo `/opt/aion/services/comms/` o similar. Contiene la integración WhatsApp + Twilio.

## 2. Identificar el proveedor WhatsApp

```bash
sudo grep -rE "graph\.facebook\.com|api\.twilio\.com|api\.gupshup\.io" \
  /opt/aion/services/ /opt/aion/app/ 2>/dev/null | head -5
```

- **Meta WhatsApp Business API** (`graph.facebook.com`): usa System User Access Token
- **Twilio WhatsApp**: usa `Account SID` + `Auth Token` o API Key SID/Secret
- **Gupshup / 360dialog / otro**: API key de proveedor

En AION (inferido del `alertmanager.yml` que llama webhook interno, no directo al proveedor), **el Bearer NO es el token del proveedor** — es el auth interno entre Alertmanager y `aion-comms`. El token del proveedor vive dentro de `aion-comms` (probablemente en `TWILIO_AUTH_TOKEN` del `.env` que ya migramos al vault en B.2).

**Entonces la rotación tiene dos capas:**
- **Capa 1 (interno):** rotar el Bearer entre Alertmanager y aion-comms. Requiere editar 2 lugares.
- **Capa 2 (provider):** rotar `TWILIO_AUTH_TOKEN` / equivalente. Requiere panel del proveedor.

---

## 3. Capa 1 — rotar el Bearer interno

### 3.1 Generar nuevo token

```bash
NEW=$(openssl rand -hex 32)
echo $NEW
# Copiar para usar abajo; no commitear.
```

### 3.2 Actualizar el lado receptor (aion-comms)

Inspeccionar cómo valida el token (ejemplo típico):

```bash
# Encontrar el lugar donde se valida
sudo grep -rE "ALERT_WEBHOOK_SECRET|OnCallWebhookToken|Bearer" \
  /opt/aion/services/comms/ 2>/dev/null | head -10
```

Si el secret vive en un `.env` del servicio:
```bash
sudo sudoedit /opt/aion/services/comms/.env
# Actualizar ALERT_WEBHOOK_SECRET=$NEW
sudo docker compose -f /opt/aion/services/comms/docker-compose.yml up -d --force-recreate aion-comms
```

Si vive en el vault (preferido tras B.2 pattern):
```bash
sudo sudoedit /etc/aion/secrets/aion-comms.env
# Actualizar ALERT_WEBHOOK_SECRET=$NEW
sudo docker restart aion-comms
```

### 3.3 Actualizar el lado emisor (Alertmanager)

```bash
sudo sudoedit /opt/aion/observability/alertmanager/alertmanager.yml
# En el receiver `oncall-all-channels` → webhook_configs → http_config
# → authorization → credentials: '<NEW_TOKEN>'
sudo docker exec alertmanager kill -HUP 1
# O: sudo docker restart alertmanager
```

### 3.4 Validar

```bash
# 1. Forzar disparo de alerta sintética
amtool --alertmanager.url=http://127.0.0.1:9093 alert add \
  alertname=SyntheticWhatsappTest \
  severity=critical \
  group=test \
  summary="rotation test — ignore"

# 2. Ver que aion-comms recibió con 200 y la firma bien
docker logs --tail 20 aion-comms 2>&1 | grep -iE "alerts/whatsapp-oncall|bearer|401|403|200"
# Esperado: 200

# 3. Resolver la alerta sintética
amtool --alertmanager.url=http://127.0.0.1:9093 alert add \
  alertname=SyntheticWhatsappTest severity=critical group=test \
  --end=$(date -u +%Y-%m-%dT%H:%M:%SZ)
```

---

## 4. Capa 2 — rotar token del proveedor WhatsApp

### 4.1 Si es Twilio

1. https://console.twilio.com/ → Account → Keys & Tokens
2. **Auth Token:** click "Request a secondary auth token" → después "Promote" → el secundario se vuelve primario → el viejo muere
3. En VPS:
   ```bash
   sudo sudoedit /etc/aion/secrets/backend-api.env
   # Actualizar TWILIO_AUTH_TOKEN=<NEW>
   pm2 reload aionseg-api --update-env
   ```
4. Si aion-comms también usa Twilio:
   ```bash
   sudo sudoedit /etc/aion/secrets/aion-comms.env   # si existe
   docker restart aion-comms
   ```
5. Verificar:
   ```bash
   curl -sS -u "$TWILIO_ACCOUNT_SID:$NEW_AUTH" https://api.twilio.com/2010-04-01/Accounts.json | jq '.code // .sid'
   # Esperado: el SID, no un error
   ```

### 4.2 Si es Meta WhatsApp Business API

1. https://business.facebook.com/ → Settings → System Users → seleccionar el que usa AION
2. Generate New Token → permisos `whatsapp_business_messaging` + `whatsapp_business_management`
3. Copiar
4. VPS: actualizar `META_WHATSAPP_TOKEN=<NEW>` en el vault correspondiente
5. Reiniciar aion-comms

### 4.3 Si es Gupshup u otro

Consultar panel del proveedor, regenerar API Key, actualizar vault, reiniciar servicio.

---

## 5. Notas de seguridad

- **NUNCA** revocar el token viejo del proveedor antes de confirmar que el nuevo funciona con una alerta de prueba (§3.4). Tener ventana de overlap mínima de 5 min.
- **Siempre** truncar logs posteriores a la rotación que puedan contener el token viejo:
  ```bash
  sudo truncate -s 0 /opt/aion/logs/aion-comms.log
  sudo journalctl --vacuum-time=1h --unit=aion-comms
  ```
- **Cadencia recomendada:** rotar el Bearer interno cada 6 meses o ante incidente; el token del proveedor según política del proveedor (Twilio recomienda trimestral).

---

## 6. Pendiente: migrar el Bearer al vault

Actualmente el token está embebido en `alertmanager.yml` (en texto plano, 644 readable por docker user). Ideal:

1. Crear `/etc/aion/secrets/alertmanager-webhooks.env`:
   ```
   WHATSAPP_ONCALL_TOKEN=<token>
   ```
   perms `640 root:docker` (o UID del contenedor alertmanager).

2. Modificar `alertmanager.yml` para leer desde env:
   ```yaml
   authorization:
     type: Bearer
     credentials_file: /etc/alertmanager/webhooks.env.WHATSAPP_ONCALL_TOKEN
   ```
   O usar el patrón de sustitución de variables si el wrapper docker lo soporta.

3. Bind-mount del vault dentro del contenedor en `docker-compose.yml`:
   ```yaml
   volumes:
     - /etc/aion/secrets/alertmanager-webhooks.env:/etc/alertmanager/webhooks.env:ro
   ```

Esto queda para un runbook separado. Por ahora, con el token rotado + log truncado, se considera aceptable.

---

## 7. Acciones necesarias del operador

Este runbook está **preparado pero NO ejecutado** porque requiere:
- Credenciales del panel del proveedor WhatsApp (§4)
- Decisión sobre si el Bearer interno (§3) se rota ahora o se pospone
- Confirmación del servicio `aion-comms` y su `.env` (§2 — no se inspeccionó durante Fase B para no abrir otra área de credenciales sin aprobación)

Cuando el operador dé luz verde, un ciclo B de Claude Code puede ejecutar §3 (rotación interna) en ~15 min. La §4 (provider) requiere el operador porque hay que hacer UI clicks en consolas externas.
