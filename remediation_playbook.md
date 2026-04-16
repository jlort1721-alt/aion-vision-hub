# Playbook de Remediacion — Auditoría ISUP/Platform Access

**Fecha:** 2026-04-13
**VPS:** ubuntu@18.230.40.6 (clave: clave-demo-aion.pem)
**Prioridad:** Las secciones estan ordenadas por impacto descendente.

---

## A. Estabilizar Backend API (F05) — URGENTE

### Diagnostico

```bash
# Ver ultimas 500 lineas de logs del API
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 \
  "pm2 logs aionseg-api --lines 500 --nostream 2>&1 | grep -iE 'error|exception|ENOMEM|killed|heap|fatal|crash' | tail -50"

# Ver memoria y OOM kills
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 \
  "sudo dmesg | grep -i 'oom\|killed process' | tail -20"

# Ver patron de restarts
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 \
  "pm2 show aionseg-api | grep -E 'restart|uptime|memory|status'"
```

### Correccion

Si es memory leak:
```bash
# Aumentar limite de memoria y habilitar GC logging
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 \
  "pm2 stop aionseg-api && pm2 start aionseg-api --node-args='--max-old-space-size=512 --expose-gc' && pm2 save"
```

Si son excepciones no manejadas, revisar los logs completos y corregir en codigo.

---

## B. Identificar IPs Hikvision Desconocidas (F13) — ALTO

### Objetivo
Mapear las 3 IPs no identificadas a dispositivos del manifiesto (PPNVR001, PEDVR001, u otros).

### Paso 1: Consultar cada IP via hik_pull

```bash
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 << 'SCRIPT'
echo "=== Probando hik-181.143.16.170 ==="
timeout 8 /usr/local/bin/hik_pull 181.143.16.170 8000 admin Clave.seg2023 1 1 > /dev/null 2>&1 && echo "OK port 8000" || echo "FAIL port 8000"
timeout 8 /usr/local/bin/hik_pull 181.143.16.170 8010 admin Clave.seg2023 1 1 > /dev/null 2>&1 && echo "OK port 8010" || echo "FAIL port 8010"

echo "=== Probando hik-200.58.214.114 ==="
timeout 8 /usr/local/bin/hik_pull 200.58.214.114 8000 admin Clave.seg2023 1 1 > /dev/null 2>&1 && echo "OK port 8000" || echo "FAIL port 8000"
timeout 8 /usr/local/bin/hik_pull 200.58.214.114 8010 admin Clave.seg2023 1 1 > /dev/null 2>&1 && echo "OK port 8010" || echo "FAIL port 8010"

echo "=== Probando hik-181.205.249.130 ==="
timeout 8 /usr/local/bin/hik_pull 181.205.249.130 8000 admin Clave.seg2023 1 1 > /dev/null 2>&1 && echo "OK port 8000" || echo "FAIL port 8000"
timeout 8 /usr/local/bin/hik_pull 181.205.249.130 8010 admin Clave.seg2023 1 1 > /dev/null 2>&1 && echo "OK port 8010" || echo "FAIL port 8010"
SCRIPT
```

### Paso 2: Una vez identificado, crear snap process

```bash
# Ejemplo para PEDVR001 si resulta ser 181.143.16.170 en puerto 8000
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 \
  "pm2 start /usr/local/bin/hik_batch_snap.sh --name snap-pe-dvr \
   -- pe-dvr-ch 181.143.16.170 8000 admin Clave.seg2023 1 4 1 && pm2 save"
```

---

## C. Configurar LBXVR001 — Lubeck (F07) — ALTO

### Paso 1: Obtener serial IMOU del XVR

Requiere acceso local al dispositivo o acceso remoto via la app IMOU Life:
- Abrir IMOU Life > dispositivo Lubeck > Configuracion > Info del dispositivo > Numero de serie
- O acceder al XVR via web: `http://192.168.1.125` > Sistema > Info > Serial

### Paso 2: Generar URLs IMOU P2P HLS

```bash
# Reemplazar SERIAL_NUMBER con el serial real
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 << 'SCRIPT'
SERIAL="INSERTAR_SERIAL_AQUI"
CHANNELS=8

# Generar bloque YAML para go2rtc
for i in $(seq 0 $((CHANNELS-1))); do
  echo "  da-lubeck-ch${i}: dvrip://admin:Clave.seg2023@${SERIAL}"
done
SCRIPT
```

### Paso 3: Agregar a go2rtc.yaml

```bash
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 << 'SCRIPT'
SERIAL="INSERTAR_SERIAL_AQUI"
# Backup config actual
sudo cp /etc/go2rtc/go2rtc.yaml /etc/go2rtc/go2rtc.yaml.bak.$(date +%Y%m%d)

# Agregar streams (ejemplo para 8 canales)
# NOTA: Las URLs IMOU HLS requieren generacion via API IMOU.
# Alternativa: usar dvrip:// scheme de go2rtc si P2P DVRIP esta habilitado
for i in $(seq 0 7); do
  sudo tee -a /etc/go2rtc/go2rtc.yaml << EOF
  da-lubeck-ch${i}: http://cmgw-online-vg.imoulife.com:8888/LCO/${SERIAL}/${i}/0/TIMESTAMP/TOKEN.m3u8?source=open
EOF
done

# Reiniciar go2rtc
sudo systemctl restart go2rtc || sudo kill -HUP $(pgrep go2rtc)
SCRIPT
```

### Paso 4: Verificar

```bash
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 \
  "curl -s http://127.0.0.1:1984/api/streams | jq 'keys | map(select(startswith(\"da-lubeck\")))'"
```

---

## D. Configurar DNXVR002 — Danubios Puesto (F08) — ALTO

### Problema
DNXVR002 (serial AH0306CPAZ5EA1A) tiene credenciales distintas (CLAVE/Clave.seg2023) y no tiene streams IMOU P2P dedicados.

### Paso 1: Verificar si el serial esta en IMOU

```bash
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 \
  "curl -s http://127.0.0.1:1984/api/streams | jq 'to_entries | map(select(.value.producers[]?.url | contains(\"AH0306CPAZ5EA1A\"))) | .[].key'"
```

### Paso 2: Si no existe, generar URLs IMOU para DNXVR002

Necesita acceso a la cuenta IMOU donde esta registrado el dispositivo para generar los tokens HLS. 

Alternativa via go2rtc DVRIP P2P:
```bash
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 << 'SCRIPT'
# Backup
sudo cp /etc/go2rtc/go2rtc.yaml /etc/go2rtc/go2rtc.yaml.bak.$(date +%Y%m%d)

# Agregar streams DVRIP P2P para Danubios Puesto (8 canales)
for i in $(seq 0 7); do
  echo "  da-danubios2-ch${i}: dvrip://CLAVE:Clave.seg2023@AH0306CPAZ5EA1A" | sudo tee -a /etc/go2rtc/go2rtc.yaml
done

# Reiniciar go2rtc
sudo kill -HUP $(pgrep go2rtc)
SCRIPT
```

### Paso 3: Verificar

```bash
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 \
  "sleep 5 && curl -s http://127.0.0.1:1984/api/streams | jq 'to_entries | map(select(.key | startswith(\"da-danubios2\"))) | length'"
```

---

## E. Resolver PPNVR001 — Portal Plaza (F10) — MEDIO

### Diagnostico Remoto

```bash
# Si se conoce la IP publica del sitio, probar conectividad
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 \
  "ping -c 3 -W 5 IP_PORTAL_PLAZA 2>&1 || echo 'No responde'"
```

### Accion Requerida
- **Requiere visita tecnica** al sitio para:
  1. Verificar estado del router/modem (encendido, con internet)
  2. Verificar estado del NVR (encendido, configuracion ISUP intacta)
  3. Verificar NAT port-forwarding si se usara hik_pull
  4. Si hay internet, verificar que la configuracion EHome apunte a 18.230.40.6:7660
- Contactar ISP si hay corte de servicio

---

## F. Agregar Regla UFW para UDP 7661 (F06) — MEDIO

### Solo ejecutar si se decide desplegar el Go reverse-gateway

```bash
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 \
  "sudo ufw allow 7661/udp comment 'Hikvision ISUP media stream' && sudo ufw status numbered | grep 7661"
```

---

## G. Proteger Credenciales (F04) — MEDIO

### Paso 1: Mover credenciales hik_pull a archivo de configuracion

```bash
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 << 'SCRIPT'
# Crear archivo de credenciales protegido
sudo tee /etc/aion/hik_credentials.conf << 'EOF'
# Credenciales Hikvision — NO commitear a git
# Formato: SITIO|WAN_IP|PORT|USER|PASS|CH_START|CH_COUNT|INTERVAL
ss-dvr|186.97.106.252|8000|admin|Clave.seg2023|1|16|1
ag-dvr|181.205.175.18|8030|admin|Clave.seg2023|1|24|1
ag-dvr1|181.205.175.18|8010|admin|Clave.seg2023|1|1|1
pq-dvr|181.205.202.122|8020|admin|Clave.seg2023|1|16|1
pq-nvr|181.205.202.122|8010|admin|Clave.seg2023|33|16|1
tl-dvr|181.205.215.210|8010|admin|seg12345|1|16|1
tl-nvr|181.205.215.210|8020|admin|Clave.seg2023|33|8|1
br-lpr|186.97.104.202|8030|admin|Clave.seg2023|1|1|3
br-lpr2|186.97.104.202|8020|admin|Clave.seg2023|1|1|3
se-dvr1|38.9.217.12|8030|admin|Clave.seg2023|1|8|1
ar-dvr|190.159.37.188|8010|admin|Clave.seg2023|1|16|1
EOF
sudo chmod 600 /etc/aion/hik_credentials.conf
sudo chown ubuntu:ubuntu /etc/aion/hik_credentials.conf
SCRIPT
```

### Paso 2: Crear wrapper que lee credenciales del archivo

```bash
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 << 'SCRIPT'
cat > /usr/local/bin/hik_batch_snap_secure.sh << 'WRAPPER'
#!/bin/bash
PREFIX=$1
CRED_FILE="/etc/aion/hik_credentials.conf"
LINE=$(grep "^${PREFIX}|" "$CRED_FILE" | head -1)
if [ -z "$LINE" ]; then echo "No credentials for $PREFIX"; exit 1; fi
IFS='|' read -r _ IP PORT USER PASS CH_START CH_COUNT INTERVAL <<< "$LINE"
exec /usr/local/bin/hik_batch_snap.sh "$PREFIX-ch" "$IP" "$PORT" "$USER" "$PASS" "$CH_START" "$CH_COUNT" "$INTERVAL"
WRAPPER
chmod +x /usr/local/bin/hik_batch_snap_secure.sh
SCRIPT
```

### Paso 3: Migrar snap processes (hacer uno por uno para validar)

```bash
# Ejemplo para snap-ss-dvr
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 \
  "pm2 delete snap-ss-dvr && pm2 start /usr/local/bin/hik_batch_snap_secure.sh --name snap-ss-dvr -- ss-dvr && pm2 save"
```

---

## H. Renovacion de Tokens IMOU P2P (F12) — MEDIO

### Diagnostico: Verificar si tokens actuales siguen funcionando

```bash
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 << 'SCRIPT'
# Probar primer stream de cada sitio Dahua
for prefix in da-alborada-ch0 da-hospital-ch0 da-terrabamba-ch0 da-terrazzino-ch0 da-quintas-ch0 da-danubios-ch0 da-pbonito-ch0 da-brescia-ch0; do
  URL=$(curl -s http://127.0.0.1:1984/api/streams | jq -r ".\"${prefix}\".producers[0].url // \"none\"")
  if [ "$URL" != "none" ]; then
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$URL" 2>/dev/null)
    echo "$prefix: HTTP $STATUS"
  else
    echo "$prefix: NO PRODUCER"
  fi
done
SCRIPT
```

### Si tokens expiraron
Requiere regenerar tokens via API IMOU o la app IMOU Life. Alternativa: usar `dvrip://` scheme de go2rtc que no requiere tokens (usa P2P DVRIP directo).

```bash
# Ejemplo: migrar da-hospital a DVRIP P2P (no requiere tokens)
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 << 'SCRIPT'
SERIAL="AE01C60PAZA4D94"
for i in $(seq 0 15); do
  curl -s -X PUT "http://127.0.0.1:1984/api/streams?name=da-hospital-ch${i}&src=dvrip://admin:Clave.seg2023@${SERIAL}?channel=${i}&subtype=1"
done
SCRIPT
```

---

## I. Limpiar Registros Espurios (F11) — BAJO

### Filtrar IPs AWS del platform-server

```bash
ssh -i ~/Downloads/clave-demo-aion.pem ubuntu@18.230.40.6 << 'SCRIPT'
# Leer JSON, eliminar entradas con IPs 3.x.x.x, guardar
python3 -c "
import json
with open('/var/www/aionseg/uploads/registered-devices.json') as f:
    devices = json.load(f)
cleaned = {k:v for k,v in devices.items() if not v.get('ip','').startswith('3.')}
removed = len(devices) - len(cleaned)
with open('/var/www/aionseg/uploads/registered-devices.json','w') as f:
    json.dump(cleaned, f, indent=2, default=str)
print(f'Removed {removed} spurious entries. {len(cleaned)} remaining.')
"
SCRIPT
```

### Mejorar platform-server para rechazar IPs no colombianas

Agregar whitelist de rangos de IP colombianos o blacklist de rangos AWS/cloud en `device-platform-server.py`.

---

## J. Decision Arquitectonica: Reverse-Gateway vs Workarounds (F01-F03)

### Opcion A: Desplegar el Go Reverse-Gateway

**Esfuerzo estimado:** 2-3 dias

1. Compilar el binario Go con las dependencias SDK (CGo + Hikvision HCNetSDK + Dahua NetSDK):
   ```bash
   cd reverse-gateway && CGO_ENABLED=1 go build -o bin/gateway ./cmd/gateway/
   ```
2. Instalar SDKs de Hikvision y Dahua en `/opt/aion/services/reverse-gateway/sdks/`
3. Crear usuario `aion-reverse` y directorios
4. Ejecutar migracion SQL: `reverse-gateway/migrations/001_reverse_schema.sql`
5. Generar KEK: `./bin/keygen > /etc/aion/reverse/kek.bin`
6. Configurar `gateway.toml` con DSN de PostgreSQL y Redis
7. Registrar en PM2 via `ecosystem.reverse.config.js`
8. Agregar regla UFW: `sudo ufw allow 7661/udp`
9. Aprobar cada dispositivo en `reverse.devices` con credenciales cifradas
10. Detener `platform-server` Python
11. Migrar streaming de hik_pull/IMOU a reverse-channel

**Pros:** Arquitectura limpia, sesiones SDK reales, credenciales cifradas, health checks, failover de rutas, audit log
**Contras:** Requiere SDKs propietarios (CGo), complejidad operacional, riesgo de regresion

### Opcion B: Mantener Workarounds y Oficializarlos

**Esfuerzo estimado:** 1 dia

1. Documentar hik_pull + IMOU P2P como arquitectura oficial
2. Implementar wrapper seguro para credenciales (seccion G)
3. Implementar renovacion automatica de tokens IMOU
4. Mejorar platform-server.py para extraer device IDs reales
5. Eliminar o archivar el directorio `reverse-gateway/` del repo
6. Actualizar CLAUDE.md y documentacion

**Pros:** Menor riesgo, ya funciona, menor complejidad
**Contras:** Dependencia de NAT (Hikvision) y cloud IMOU (Dahua), credenciales expuestas sin KEK

### Recomendacion

**Opcion B a corto plazo** (estabilizar lo que funciona) + **Opcion A como roadmap** para Q3 2026.

---

## Checklist de Verificacion Post-Remediacion

- [ ] `aionseg-api` con 0 restarts en 24h
- [ ] 3 IPs Hikvision desconocidas mapeadas a dispositivos
- [ ] LBXVR001 con streams en go2rtc (da-lubeck-ch*)
- [ ] DNXVR002 con streams separados (da-danubios2-ch*)
- [ ] Credenciales hik_pull movidas a archivo protegido
- [ ] Tokens IMOU verificados como funcionales
- [ ] Registros espurios AWS eliminados
- [ ] PPNVR001 — visita tecnica programada o descartada
- [ ] PEDVR001 — snap process configurado con IP correcta
- [ ] Regla UFW 7661/udp agregada (si aplica)

---

*Generado por AION Audit Collector v1.0.0 — 2026-04-13*
*Archivos relacionados: audit_data.json | audit_report.md*
