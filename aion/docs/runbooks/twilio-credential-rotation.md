# Runbook — Rotación de credenciales Twilio

**Propietario:** Isabella
**Frecuencia:** cada 90 días + inmediatamente si se sospecha compromiso
**Impacto:** ventana <5 min sin envío WhatsApp/SMS si se hace mal; 0 si se hace en orden

## Cuándo ejecutar

- Cada 90 días (calendario).
- Si el token aparece en git history (`git log --all -p | grep -i auth_token`).
- Si Twilio reporta uso anómalo.
- Tras salida de personal con acceso al `.env`.

## Variables afectadas

En `/var/www/aionseg/backend/apps/backend-api/.env`:

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=<a rotar>
TWILIO_MESSAGING_SERVICE_SID=MG...   # opcional
TWILIO_WHATSAPP_FROM=+57...          # no cambia
```

## Procedimiento

### 1. Rotación en Twilio Console

1. Ir a <https://console.twilio.com/> → Account → API keys & tokens.
2. En la sección **Auth Token**, click "View" → copiar el token **actual** (por si revert).
3. Click **Request a secondary Auth Token** (Twilio da 24h con ambos activos).
4. Copiar el nuevo secondary token.

### 2. Pre-check antes de rotar en VPS

```bash
ssh aion-vps '
  # Contador de webhooks que usa Auth Token para validar firmas
  sudo grep -rE "(AUTH_TOKEN|authToken)" /var/www/aionseg/backend/dist/ 2>/dev/null | wc -l
  # Último envío exitoso
  pm2 logs n8n-automations --nostream --lines 50 | grep -i twilio | tail -5
'
```

### 3. Aplicar nuevo token en VPS

```bash
ssh aion-vps '
  # Backup
  sudo cp /var/www/aionseg/backend/apps/backend-api/.env \
    /var/backups/aion/.env.pre-twilio-rotation-$(date +%Y%m%d-%H%M%S)

  # Editar (mantiene perms 600)
  sudo -u ubuntu nano /var/www/aionseg/backend/apps/backend-api/.env
  # Reemplazar TWILIO_AUTH_TOKEN=<nuevo valor>

  # Reload cluster SIN downtime (cluster mode x4)
  pm2 reload aionseg-api

  # Validar
  curl -s https://aionseg.co/api/health
  pm2 logs aionseg-api --nostream --lines 10 | grep -iE "twilio|auth" | tail -5
'
```

### 4. Probar envío WhatsApp/SMS

```bash
curl -X POST https://aionseg.co/api/twilio/test-whatsapp \
  -H "Authorization: Bearer <jwt-admin>" \
  -H "Content-Type: application/json" \
  -d '{"to":"+57300...","body":"rotation test"}'
```

### 5. Promover a Primary en Twilio

**Solo después de confirmar envío OK (paso 4):**

1. Console → Auth Tokens → **Promote to primary** (el secondary pasa a primary).
2. **Delete the old primary token** (ventana 24h cierra).

### 6. Rotar también

Revisar si tras la rotación es necesario actualizar:
- **n8n credentials** → `Settings → Credentials → Twilio account` → actualizar token.
- **Webhooks de Twilio** configurados en <https://console.twilio.com/us1/develop/phone-numbers> → *Messaging webhook URL* apunta a `https://aionseg.co/webhooks/twilio`. No cambia la URL, solo el token usado para validar firmas.
- **GitHub Secrets** si hay CI que usa Twilio API.

### 7. Post-rotación

- Commit en el repo: NO COMMITEAR EL TOKEN. Si hay `.env.example`, verificar que tiene solo placeholders.
- Actualizar calendario para próxima rotación (+90 días).

## Rollback

Si algo falla en paso 4:

```bash
ssh aion-vps '
  # Restaurar backup
  sudo cp /var/backups/aion/.env.pre-twilio-rotation-* \
    /var/www/aionseg/backend/apps/backend-api/.env
  pm2 reload aionseg-api
'
# En Twilio Console: el token primary original sigue activo 24h, así que no hay pérdida.
```

## Checklist de cierre

- [ ] Nuevo token desplegado en VPS `.env`.
- [ ] `pm2 reload aionseg-api` completó los 4 instances.
- [ ] Prueba WhatsApp envió OK.
- [ ] Primary token rotado en Twilio Console.
- [ ] Token antiguo eliminado.
- [ ] Calendario actualizado (+90 días).
- [ ] Git log escaneado para asegurar que no se commiteó.
