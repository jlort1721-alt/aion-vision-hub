# Plan de Acción — Próximos Pasos AION 2026-04-19

**Generado:** 2026-04-19
**Prioridad:** de crítico → importante → mejora

---

## 🔴 P0 — Hacer HOY (bloqueantes)

### 1. Mover API keys OpenClaw a vault

**Por qué:** API keys de OpenAI + Anthropic en `/etc/systemd/system/openclaw.service` en texto plano = riesgo si hay backup snapshot.

**Cómo:**
```bash
ssh aion-vps

# 1. Crear vault (si no existe)
sudo mkdir -p /etc/aion/secrets
sudo chmod 700 /etc/aion/secrets

# 2. Escribir env file
sudo tee /etc/aion/secrets/openclaw.env <<'EOF'
OPENAI_API_KEY=<NUEVA_KEY_ROTADA>
ANTHROPIC_API_KEY=<NUEVA_KEY_ROTADA>
OPENCLAW_GATEWAY_TOKEN=<token_existente>
CLAUDE_MODEL=claude-opus-4-7
EOF
sudo chmod 600 /etc/aion/secrets/openclaw.env

# 3. Override systemd unit
sudo systemctl edit openclaw.service
# En el editor, pegar:
#   [Service]
#   Environment=
#   EnvironmentFile=/etc/aion/secrets/openclaw.env

# 4. Reload + restart
sudo systemctl daemon-reload
sudo systemctl restart openclaw

# 5. Verify
sudo systemctl status openclaw --no-pager | head -15
sudo journalctl -u openclaw --since "1 min ago" | tail -5
```

**Tiempo estimado:** 15 min.

---

### 2. Reactivar live view Hikvision (cooldown DVRs)

**Por qué:** 22 Hikvision en lockout temporal, 0 snap workers activos (excepto portal-plaza).

**Cómo:**

```bash
ssh aion-vps

# Esperar mínimo 2-4 horas desde ahora (2026-04-19 02:00 UTC) sin
# ejecutar tests masivos de HCNetSDK.

# Luego reactivar gradualmente:
# Fase 1 (4h después):
pm2 start snap-ss-dvr snap-se-dvr1
sleep 600  # 10 min observar

# Fase 2 (si Fase 1 generan JPG):
pm2 start snap-tl-dvr snap-tl-nvr

# Fase 3:
pm2 start snap-pq-dvr snap-pq-nvr snap-ag-dvr snap-ag-dvr1 snap-ar-dvr
sleep 600

# Fase 4:
pm2 start snap-br-lpr1 snap-br-lpr2 snap-rtsp snap-dahua

# Validar JPGs se generan
find /var/www/aionseg/frontend/snapshots -name "*.jpg" -mmin -2 | wc -l
```

**Tiempo: 4h espera + 15 min reactivación.**

---

### 3. Log rotation para openclaw

**Por qué:** `event-bridge.log` 2.2 MB/día, crecerá a GB sin rotación.

**Cómo:**
```bash
ssh aion-vps
sudo tee /etc/logrotate.d/openclaw <<'EOF'
/home/openclaw/.openclaw/*.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
    copytruncate
    su openclaw openclaw
}
EOF
sudo logrotate -f /etc/logrotate.d/openclaw  # test immediato
```

**Tiempo: 5 min.**

---

## 🟡 P1 — Hacer esta semana

### 4. Refrescar URLs Imou Cloud (Dahua)

**Por qué:** 10 de 13 Dahua no sirven video porque URLs HLS Imou expiraron.

**Opción A: registro cuenta dev Imou (recomendado)**
1. Ir a https://open.imoulife.com/
2. Registrar cuenta dev del cliente/operador
3. Obtener `app_id` + `app_secret`
4. Asociar los 13 seriales del cliente a esa cuenta
5. Configurar en `/etc/aion/secrets/imou.env`:
   ```
   IMOU_APP_ID=...
   IMOU_APP_SECRET=...
   IMOU_ACCESS_TOKEN=...
   ```
6. Restart `imou-live-server` PM2 worker

**Opción B: usar cuenta Imou existente del cliente**
- Login al móvil DMSS con cuenta del cliente
- Verificar que los 13 seriales aparezcan "Online"
- Configurar credenciales en VPS

**Tiempo: 1-2 horas (depende de respuesta Imou).**

### 5. Configurar webhooks Slack + Twilio rotación

Ya hay runbooks en:
- `aion/docs/runbooks/alertmanager-webhooks-setup.md` (Slack)
- `aion/docs/runbooks/twilio-credential-rotation.md` (Twilio)

**Tiempo: 30 min por cada uno.**

### 6. VPS_SSH_KEY en GitHub Secrets

Para CI/CD en los 3 repos:
1. En tu máquina: `cat ~/.ssh/clave-demo-aion.pem` (copiar contenido completo)
2. GitHub → `aion-vision-hub` → Settings → Secrets → Actions → New secret
3. Name: `VPS_SSH_KEY`, value: pegar pem completo
4. Repetir para `aion-platform` y `aionseg-platform`

**Tiempo: 10 min.**

### 7. Implementar skill `device-audit`

Crear `.claude/skills/device-audit/` para diagnóstico SDK rápido de 41 devices.

**Tiempo: 2 horas dev.**

---

## 🟢 P2 — Hacer este mes

### 8. Implementar MCPs clave

Según roadmap en `2026-04-19-skills-mcp-roadmap.md`:
- `go2rtc-mcp`
- `pm2-mcp`
- `hikvision-isapi-mcp`
- `prometheus-mcp` + `loki-mcp`

**Tiempo: ~8 horas dev combinado.**

### 9. Grafana exporter para OpenClaw

Custom exporter que lee `/home/openclaw/devops/reports/*.json` y expone a Prometheus:
- `openclaw_iteration_count`
- `openclaw_health_errors`
- `openclaw_pm2_restarts`
- `openclaw_plan_pending`
- `openclaw_plan_executed`

Luego dashboard Grafana con timeline + alertas.

**Tiempo: 4 horas dev.**

### 10. WireGuard peer en sitio del cliente

**Impacto alto:** cuando hay peer, los 13 Dahua pasan de P2P incompatible a LAN enrutable → NetSDK enterprise funciona 100%.

**Requisitos:**
- Raspberry Pi 4 / mini PC ($50-100) con WireGuard
- Instalar en sitio del cliente, conectar a LAN
- Config peer apuntando a VPS (`10.100.0.1/24`)

**Tiempo: 1-2h una vez llega el hardware.**

---

## 🔵 P3 — Roadmap largo plazo

### 11. Frigate NVR (IA video analytics)

Fase 4 del contrato. Requiere decisión: VPS vs edge server del cliente.

### 12. Keycloak SSO

Fase 3 contrato. Cuando tengan 3+ servicios con auth propio (Grafana, Node-RED, MinIO, etc.), Keycloak centraliza.

### 13. Leosac access control

Fase 7 contrato. Requiere hardware controlador físico (~$200-500).

### 14. dh-p2p PTCP fix

Open source PoC que se clonó. El handshake PTCP está incompleto. 1-2 días dev Python lo completaría y daría alternativa a Imou Cloud.

### 15. Reemplazar devices Imou consumer por Dahua enterprise

Si escala el negocio, migrar los 13 Dahua consumer a Dahua DSS/IVSS enterprise (5-10× costo hardware pero NetSDK funciona 100% sin VPN).

---

## ✅ Checklist priorizado

Marcar conforme se completa:

```
[ ] P0.1  Mover API keys OpenClaw a vault
[ ] P0.2  Esperar 4h + reactivar snap workers gradualmente
[ ] P0.3  Log rotation openclaw

[ ] P1.1  Registrar Imou Open Platform dev account
[ ] P1.2  Slack webhook en alertmanager
[ ] P1.3  Rotar Twilio Auth Token
[ ] P1.4  VPS_SSH_KEY en 3 GitHub repos
[ ] P1.5  Skill device-audit implementado

[ ] P2.1  go2rtc-mcp implementado
[ ] P2.2  pm2-mcp implementado
[ ] P2.3  hikvision-isapi-mcp implementado
[ ] P2.4  prometheus/loki MCPs
[ ] P2.5  Grafana exporter OpenClaw
[ ] P2.6  WireGuard peer sitio cliente

[ ] P3.1  Evaluar Frigate NVR (edge o VPS)
[ ] P3.2  Keycloak SSO (cuando haya >3 servicios)
[ ] P3.3  Leosac access control (requiere hardware)
[ ] P3.4  dh-p2p PTCP fix
```

---

## Notas finales

- **No re-ejecutar pruebas SDK masivas** hasta confirmar cooldown DVRs (espera 2-4h desde 2026-04-19 02:00 UTC).
- **El sistema está al 85% operativo.** El déficit principal es live view Hikvision (recuperable con tiempo de reposo) + Dahua Imou (requiere cuenta Imou Open Platform).
- **OpenClaw funciona bien** pero requiere fix de seguridad API keys.
- **Backend, DB, endpoints, event bus, access doors, PTZ executor, frontend** todos operativos.
- **SDKs instalados** en VPS (no solo local): HCNetSDK v6.1.9 + Dahua NetSDK C/C++ v3.060 + Dahua NetSDK Python 2.0.0.1.
- **3 remotes git sincronizados** en `cf778dc`.
