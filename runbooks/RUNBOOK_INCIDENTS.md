# 🚨 AION — Runbook de Incidentes

> Qué hacer cuando la plataforma se cae a las 3am.

Este runbook está escrito asumiendo que el on-call está medio dormido, con poca paciencia y necesita resolver el incidente en menos de 15 minutos. Cada sección va con: **síntoma → diagnóstico (1 comando) → acción (otro comando) → verificación → escalación**.

---

## 📞 Información de contacto rápido

| Rol | Quién | Canal | Cuándo despertar |
|---|---|---|---|
| **On-call primario** | Isabella | WhatsApp +57 304 590 8976 (voz) / US number para SMS | siempre que dure >15min |
| **Backup técnico** | (definir) | Slack #aion-incidents | si Isabella no responde 5min |
| **Cliente afectado** | Admins de cada conjunto | WhatsApp Business | solo si downtime >30min |
| **Anthropic API** | status.anthropic.com | — | si falla `/api/agent/*` con 5xx persistente |
| **Twilio** | status.twilio.com | — | si falla WhatsApp/voz |
| **Supabase / VPS** | proveedor cloud | dashboard | si VPS unreachable |

---

## 🧭 Triage en 60 segundos

Cuando suena la alerta, primero responde estas 4 preguntas en orden:

1. **¿Está aionseg.co arriba?**
   ```bash
   curl -fsS -o /dev/null -w 'HTTP %{http_code} %{time_total}s\n' https://aionseg.co/api/health
   ```
   - 200 → la plataforma vive. Salta a §B (problema parcial).
   - timeout / 5xx / connection refused → §A (caída total).

2. **¿Cuántas URLs están caídas?**
   - Abre Grafana `https://metrics.aionseg.co/d/aion-overview`
   - Mira el panel "URLs UP / Total (70)"
   - 70/70 → falsa alarma o servicio interno
   - 60-69 → degradación por sección
   - <60 → outage mayor

3. **¿Qué disparó la alerta?**
   - Lee el body del WhatsApp/Slack: `alertname`, `severity`, `summary`, `runbook` link.
   - Salta al runbook específico (links abajo).

4. **¿Hay deploy reciente?**
   ```bash
   ssh aion@vps.aionseg.co "ls -t /opt/aion/snapshots/*.json | head -3"
   ```
   - Si hay deploy en las últimas 30min y la alerta empezó después → §R (rollback inmediato).

---

## 📑 Índice por alerta

| Alerta | Sección | Tiempo objetivo |
|---|---|---|
| `AionPublicUrlDown` (api/health caído) | §A1 | 5 min |
| `AionAuthedUrlDown` | §A2 | 10 min |
| `AionWholeSectionDown` | §A3 | 5 min |
| `VisionHubServicesDegraded` | §B1 | 10 min |
| `VisionHubServicesCritical` | §B2 | 5 min |
| `Pm2AppErrored` | §C1 | 5 min |
| `Pm2AppRestartLoop` | §C2 | 10 min |
| `NodeDiskFull` | §D1 | 15 min |
| `NodeMemoryPressure` | §D2 | 10 min |
| `PostgresDown` | §E1 | 5 min |
| `PostgresConnectionsHigh` | §E2 | 10 min |
| `PostgresRlsDisabled` | §E3 | 30 min |
| `AsteriskDown` | §F1 | 10 min |
| `TwilioWebhookFailures` | §F2 | 15 min |
| `AiCostSpike` | §G1 | 30 min |
| `ModelRouterFallbackHigh` | §G2 | 15 min |
| `AionTLSExpiringSoon` | §H1 | mismo día |

---

## A. URL availability

### A1 — `api/health` caído (caída total)

**Síntoma**: probe de `/api/health` retorna no-200 por >2min.

**Diagnóstico**:
```bash
ssh aion@vps.aionseg.co "
  pm2 list | head -25
  curl -fsS -o /dev/null -w 'local api: %{http_code}\n' http://127.0.0.1:3000/api/health || echo 'blue down'
  curl -fsS -o /dev/null -w 'local api: %{http_code}\n' http://127.0.0.1:3001/api/health || echo 'green down'
  systemctl status nginx --no-pager | head -5
"
```

**Posibles causas y acciones**:

- **PM2 api app errored** → `pm2 restart aion-api-blue aion-api-green && pm2 logs aion-api-blue --lines 50 --nostream`
- **Nginx down** → `sudo systemctl restart nginx && sudo nginx -t`
- **Ambos colores caídos** → §C1 (hard restart toda la cadena)
- **VPS unreachable** desde tu portátil pero pings funcionan desde otro punto → DNS/firewall → revisa Cloudflare dashboard
- **Deploy reciente roto** → §R (rollback)

**Verificación**:
```bash
curl -fsS https://aionseg.co/api/health | jq
# debe retornar {"status":"healthy", ...}
```

**Escalar**: si en 10 min no resuelves, despierta backup técnico.

---

### A2 — Una URL autenticada caída

**Síntoma**: una URL específica del set de 64 retorna no-2xx.

**Diagnóstico**:
```bash
# Ver qué URL exactamente
URL="<la-url-del-alert>"
curl -fsS -o /dev/null -w 'HTTP %{http_code}\n' "$URL"
ssh aion@vps.aionseg.co "tail -100 /var/log/nginx/aionseg.co.error.log | grep -i $(basename $URL)"
```

**Acciones**:
- 404 → ruta no existe en el frontend → revisa último deploy, `pm2 logs aion-frontend-blue`
- 500 → bug en backend → `pm2 logs aion-api-blue --err --lines 100`
- 502/504 → backend timeout → revisa `/api/health` del servicio específico
- 403 → JWT QA expirado → re-genera bearer en blackbox, ver §H2

**Si NO puedes resolver en 10min**: marca la URL como "known issue" en Slack y deja la alerta inhibida 1h:
```bash
curl -X POST http://localhost:9093/api/v2/silences \
  -H 'Content-Type: application/json' \
  -d '{"matchers":[{"name":"instance","value":"<URL>","isRegex":false}],
       "startsAt":"'$(date -u +%FT%TZ)'",
       "endsAt":"'$(date -u -d '+1 hour' +%FT%TZ)'",
       "createdBy":"oncall","comment":"investigating"}'
```

---

### A3 — Sección entera caída (>50% URLs de un grupo)

**Síntoma**: alerta `AionWholeSectionDown` con `group=video` (o el que sea).

**Diagnóstico rápido por grupo**:

| Grupo | Servicio probable | Comando |
|---|---|---|
| `public` | Nginx o frontend | `pm2 restart aion-frontend-blue` |
| `video` | Vision Hub | §B (siguiente sección) |
| `events` / `access` | API o DB | §A1 + `psql -c 'SELECT now()'` |
| `comms` | Asterisk o Twilio | §F |
| `intel` | Agent o model-router | `pm2 restart aion-agent-blue aion-model-router-blue` |
| `admin` / `management` / `advanced` | Frontend o API | §A1 |

---

## B. Vision Hub

### B1 — Servicios degradados (<95% sanos)

**Síntoma**: `VisionHubServicesDegraded` — algunos DVRs no responden.

**Diagnóstico**:
```bash
ssh aion@vps.aionseg.co "
  curl -s http://127.0.0.1:3030/api/vision-hub/health | jq '.services[] | select(.status!=\"healthy\")'
"
```

**Acciones**:
- Si son **2-3 servicios específicos** → revisar conectividad al sitio:
  ```bash
  # Para cada DVR caído, prueba el puerto ISAPI
  nc -zv <dvr-ip> 8010   # Hikvision
  nc -zv <dvr-ip> 80     # Dahua
  ```
- Si **todo el bridge HCNetSDK** está caído → reinicia el contenedor:
  ```bash
  docker restart aion-hcnet-bridge
  sleep 15
  curl -fsS http://127.0.0.1:9099/health
  ```
- Si **go2rtc tiene <200 streams** → reinicia:
  ```bash
  docker restart go2rtc
  sleep 20
  curl -s http://127.0.0.1:1984/api/streams | jq 'length'
  ```

**Verificación**: Vision Hub debe volver a 23/23 o muy cerca.

---

### B2 — Vision Hub crítico (<70% sanos)

**Síntoma**: alerta `VisionHubServicesCritical` — la mayoría de cámaras invisibles.

**Acción inmediata**: hard reset de todo el stack de video.
```bash
ssh aion@vps.aionseg.co bash <<'EOF'
  set -e
  # 1. Snapshot de logs antes de reiniciar
  mkdir -p /opt/aion/snapshots/vision-incident-$(date +%s)
  cd /opt/aion/snapshots/vision-incident-$(date +%s)
  pm2 logs aion-vision-hub-blue --lines 500 --nostream > pm2.log 2>&1
  docker logs go2rtc            --tail 500 > go2rtc.log 2>&1
  docker logs aion-hcnet-bridge --tail 500 > hcnet.log  2>&1

  # 2. Restart en orden
  docker restart go2rtc
  sleep 5
  docker restart aion-hcnet-bridge
  sleep 10
  pm2 restart aion-vision-hub-blue aion-vision-hub-green
  sleep 15

  # 3. Verificar
  curl -s http://127.0.0.1:3030/api/vision-hub/health | jq '.summary'
EOF
```

**Si después de esto sigue caído**: probablemente es un problema de red al conjunto residencial. Comunicarte con Isabella para revisar VPN/WireGuard del sitio afectado.

---

## C. Procesos PM2

### C1 — App en estado errored

**Síntoma**: `Pm2AppErrored` para `aion-api-blue` (o cualquiera).

**Diagnóstico**:
```bash
ssh aion@vps.aionseg.co "
  pm2 describe <app-name> | head -40
  pm2 logs <app-name> --err --lines 100 --nostream
"
```

**Causas comunes**:
- **Out of memory** → ver §D2
- **Module not found** post-deploy → `cd /opt/aion && pnpm install --frozen-lockfile`
- **DB connection refused** → ver §E1
- **Port already in use** → `lsof -i :<port>` + `kill <pid>`
- **Config inválida** → comparar `ecosystem.config.js` contra snapshot

**Recuperación**:
```bash
pm2 restart <app-name> --update-env
# si reinicio limpio no funciona:
pm2 delete <app-name>
pm2 start /opt/aion/ecosystem.config.js --only <app-name> --env production
pm2 save
```

---

### C2 — Restart loop

**Síntoma**: `Pm2AppRestartLoop` — la app reinicia >0.5 veces/min por 5min.

**Acción**: detener el loop antes de seguir diagnosticando (consume CPU y llena logs).
```bash
pm2 stop <app-name>
# revisa logs SIN restart pressure
pm2 logs <app-name> --err --lines 200 --nostream | tail -100
```

Identifica el error raíz y arregla. Si necesitas más tiempo:
- Si solo es UN color: deja el otro corriendo y trabaja en el dañado.
- Si son ambos colores: usa el blue-green para drenar tráfico al menos malo:
  ```bash
  ln -sfn /etc/nginx/aion-upstreams/<color-bueno>.conf /etc/nginx/conf.d/aion-upstream.conf
  nginx -s reload
  ```

---

## D. Recursos del sistema

### D1 — Disco lleno (<10% libre)

**Diagnóstico**:
```bash
ssh aion@vps.aionseg.co "df -h / && du -sh /var/log/* /opt/aion/snapshots/* 2>/dev/null | sort -h | tail -20"
```

**Acciones inmediatas** (recuperar 1-5GB rápido):
```bash
# 1. Comprimir logs viejos
sudo find /var/log -name "*.log" -mtime +7 ! -name "*.gz" -exec gzip {} \;

# 2. Borrar logs PM2 antiguos
pm2 flush

# 3. Borrar snapshots viejos (>14 días)
find /opt/aion/snapshots -mindepth 1 -mtime +14 -delete

# 4. Docker prune
docker system prune -af --volumes --filter "until=168h"

# 5. Backups DB viejos
find /opt/aion/snapshots -name "*.dump" -mtime +30 -delete
```

**Si nada funciona**: ampliar disco vía proveedor cloud (típicamente 5-10 min).

---

### D2 — Memoria saturada (>92%)

**Diagnóstico**:
```bash
ssh aion@vps.aionseg.co "
  free -h
  pm2 list | head -25
  ps aux --sort=-rss | head -15
"
```

**Acciones**:
1. Identifica el hog (suele ser `aion-agent` o `aion-vision-hub`).
2. Restart con límite reducido temporalmente:
   ```bash
   pm2 restart <app> --max-memory-restart 1G
   ```
3. Si Postgres está usando demasiado, reduce `shared_buffers` temporalmente o reinicia conexiones idle:
   ```bash
   psql -U aion -d aion -c "
     SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE state='idle' AND state_change < now() - interval '10 minutes';
   "
   ```
4. Si esto se repite cada semana: bug de memory leak → abrir issue en el repo afectado.

---

## E. PostgreSQL

### E1 — Postgres down

**Síntoma**: `pg_up == 0` durante >1min. La plataforma está prácticamente inservible.

**Diagnóstico**:
```bash
ssh aion@vps.aionseg.co "
  systemctl status postgresql --no-pager
  tail -50 /var/log/postgresql/postgresql-16-main.log
"
```

**Acciones**:
- **Crash**: `sudo systemctl restart postgresql` → si arranca, revisa logs por causa raíz.
- **Disco lleno** → §D1 primero.
- **Corrupción** → recuperar desde último `pg_dump`:
  ```bash
  ssh aion@vps.aionseg.co "
    LATEST=\$(ls -t /opt/aion/snapshots/*.dump | head -1)
    echo \"Restoring from: \$LATEST\"
    sudo systemctl stop postgresql
    sudo -u postgres pg_restore -C -d postgres \$LATEST
    sudo systemctl start postgresql
  "
  ```
- **Si nada funciona**: failover a réplica si existe; si no, restaurar full y notificar pérdida de datos al cliente.

---

### E2 — Conexiones agotadas

**Síntoma**: `PostgresConnectionsHigh` >85% de max_connections.

**Diagnóstico**:
```bash
psql -U aion -d aion -c "
  SELECT application_name, state, count(*)
  FROM pg_stat_activity
  WHERE datname='aion'
  GROUP BY 1, 2 ORDER BY 3 DESC;
"
```

**Acción**: matar idle connections viejas:
```bash
psql -U aion -d aion -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname='aion'
    AND state='idle'
    AND state_change < now() - interval '5 minutes';
"
```

**Si una app tiene leak de pool**: bajar `PG_POOL_MAX` en `ecosystem.config.js` y `pm2 reload`.

---

### E3 — Tablas sin RLS detectadas

**Síntoma**: `aion_pg_tables_without_rls > 0` — VIOLACIÓN de compliance.

**Esto NO es 3am-emergencia operativa**, pero SÍ es legal/compliance crítico. Resolver el mismo día.

**Diagnóstico**:
```bash
psql -U aion -d aion -c "
  SELECT tablename FROM pg_tables
  WHERE schemaname='public'
    AND rowsecurity=false
    AND tablename<>'schema_migrations';
"
```

**Acción**: re-aplicar la migración 001:
```bash
/opt/aion/db/scripts/migrate.sh --env production --rollback 000
/opt/aion/db/scripts/migrate.sh --env production --apply
```

Si falla porque alguien hizo `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` manualmente → buscar el responsable en `audit_log` y revertir.

---

## F. Comunicaciones

### F1 — Asterisk down (sin voz/SIP)

**Diagnóstico**:
```bash
ssh aion@vps.aionseg.co "
  systemctl status asterisk --no-pager
  asterisk -rx 'core show channels'
  asterisk -rx 'sip show registry'
"
```

**Acciones**:
- `sudo systemctl restart asterisk`
- Si no arranca, revisar `/var/log/asterisk/messages` por errores de config.
- Verificar puertos UDP 5060, 10000-20000 (RTP) abiertos.

**Mientras se arregla**: las llamadas de emergencia siguen pasando por Twilio voice si el frontend usa el fallback WebRTC → Twilio.

---

### F2 — Twilio webhooks fallando

**Síntoma**: errores >0.1/s en endpoints `/api/twilio/*`.

**Diagnóstico**:
```bash
# 1. Anthropic Twilio status
curl -s https://status.twilio.com/api/v2/status.json | jq

# 2. Logs locales
pm2 logs aion-comms-blue --err --lines 50 --nostream | grep -i twilio
```

**Si Twilio está OK pero los webhooks fallan localmente**:
- Token de Twilio expirado → rotar en Console y actualizar `.env`.
- Validación de firma fallando → `nginx` puede estar quitando el header `X-Twilio-Signature`. Verificar:
  ```bash
  curl -fsS https://aionseg.co/api/twilio/test-signature
  ```

---

## G. AI / Model Router

### G1 — Spike de costo IA (>$5/h)

**No es una emergencia técnica**, es una emergencia de presupuesto.

**Diagnóstico**:
```bash
psql -U aion -d aion -c "
  SELECT model, count(*), round(sum(cost_usd)::numeric, 2) AS usd
  FROM ai_usage
  WHERE created_at > now() - interval '1 hour'
  GROUP BY 1 ORDER BY 3 DESC;
"
```

**Acciones**:
- Si un modelo Opus/Sonnet está liderando el costo cuando debería ser Haiku → bug en model-router. Forzar Haiku temporalmente:
  ```bash
  ssh aion@vps.aionseg.co "
    pm2 set aion-model-router:DEFAULT_MODEL claude-haiku-4-5-20251001
    pm2 set aion-model-router:FORCE_DEFAULT true
    pm2 restart aion-model-router-blue aion-model-router-green
  "
  ```
- Si algún tool handler entró en loop → identificar y deshabilitarlo:
  ```bash
  psql -c "
    SELECT tool_name, count(*) FROM ai_usage
    WHERE created_at > now() - interval '15 min'
    GROUP BY 1 ORDER BY 2 DESC LIMIT 5;
  "
  ```

---

### G2 — Model router fallback alto

**Síntoma**: el router está cayendo a fallback (probablemente porque el modelo primario no responde).

**Diagnóstico**:
```bash
curl -s https://status.anthropic.com/api/v2/status.json | jq '.status'
pm2 logs aion-model-router-blue --err --lines 50 --nostream
```

**Acción**: si la API de Anthropic está degradada, no hay nada que hacer en nuestro lado. Bajar `--max-tokens` o desactivar features no críticos para reducir presión:
```bash
pm2 set aion-agent:NON_ESSENTIAL_FEATURES_DISABLED true
pm2 restart aion-agent-blue aion-agent-green
```

---

## H. Seguridad / TLS

### H1 — TLS expirando en <14 días

```bash
ssh aion@vps.aionseg.co "
  sudo certbot renew --dry-run
  sudo certbot renew
  sudo nginx -s reload
"
```

Verificar:
```bash
echo | openssl s_client -connect aionseg.co:443 2>/dev/null \
  | openssl x509 -noout -dates
```

---

### H2 — Token QA bot expirado (probes auth fallan)

```bash
ssh aion@vps.aionseg.co "
  cd /opt/aion/qa
  NEW_TOKEN=\$(curl -s -X POST https://aionseg.co/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{\"email\":\"qa-bot@aionseg.co\",\"password\":\"'\"\$AION_QA_PASS\"'\"}' | jq -r .token)

  echo \"QA_BOT_BEARER=\$NEW_TOKEN\" | sudo tee /opt/aion/observability/.bearer
  docker restart blackbox
"
```

---

## R. Rollback de deploy

**Cuándo usar**: alertas dispararon en los 30min siguientes a un deploy y ninguna otra causa explica el fallo.

```bash
ssh aion@vps.aionseg.co "/opt/aion/scripts/rollback.sh"
```

El rollback toma <15s (cambio atómico de symlink nginx + revivir el color anterior). Después:
```bash
# Verificar
curl -fsS https://aionseg.co/api/health | jq

# Documentar
echo "$(date): rollback ejecutado por $(whoami) — razón: ..." \
  >> /opt/aion/snapshots/rollback-log.txt
```

**No olvides**: arreglar el bug en una rama y re-deployar más tarde con calma.

---

## 📝 Post-incidente (obligatorio)

Después de cada incidente, en menos de 24 horas:

1. **Crear post-mortem** en `/opt/aion/runbooks/postmortems/YYYY-MM-DD-titulo.md` con plantilla:
   ```markdown
   # Post-mortem: <título>
   - Inicio: HH:MM (detección) / HH:MM (impacto real)
   - Duración: Xmin
   - Servicios afectados:
   - Usuarios afectados:
   - Causa raíz:
   - Cómo se detectó:
   - Cómo se resolvió:
   - Por qué no se detectó antes:
   - Acciones de prevención (con owner y fecha):
   ```

2. **Si la alerta no existía o era ruidosa** → ajustar `aion-alerts.yml`.

3. **Si el runbook no ayudó** → editarlo. El próximo on-call no debería sufrir lo mismo.

4. **Si el incidente fue causado por deploy** → mejorar el smoke test que debería haberlo atrapado.

---

## 🧰 Comandos que SIEMPRE debes tener a mano

```bash
# Estado general en una mirada
ssh aion@vps.aionseg.co "
  echo '--- PM2 ---' && pm2 list | head -25
  echo '--- DISK ---' && df -h /
  echo '--- LOAD ---' && uptime
  echo '--- API ---' && curl -fsS http://127.0.0.1:3000/api/health | jq -c
  echo '--- DB ---' && psql -U aion -d aion -Atc 'SELECT now()'
  echo '--- COLOR ---' && basename \$(readlink -f /etc/nginx/conf.d/aion-upstream.conf) .conf
"

# Tail unificado de logs críticos
ssh aion@vps.aionseg.co "
  tail -F /var/log/nginx/aionseg.co.error.log \
          /var/log/aion/aion-api-blue.err.log \
          /var/log/aion/aion-vision-hub-blue.err.log
"

# Silenciar una alerta ruidosa por 1 hora
amtool silence add alertname=<name> --duration=1h --comment="investigando" --author="oncall"
```

---

## ⚖️ Decisión: ¿despertar al humano?

| Situación | Despertar a Isabella (3am) |
|---|---|
| 1 URL caída, plataforma sigue arriba | NO. Silencia 1h, resuelve en horario. |
| Sección entera caída | SÍ |
| Vision Hub <70% | SÍ |
| Postgres down | SÍ inmediato |
| Cliente reportó por WhatsApp | SÍ |
| TLS expira mañana | NO. Renueva tú. |
| Costo IA disparado | NO si tú puedes contenerlo. SÍ si supera $50/h. |
| Algo que no entiendes | SÍ. Mejor despertar que dañar más. |

---

**Última actualización**: este runbook se versiona en git. Cuando lo edites, abre PR con los aprendizajes del post-mortem.
