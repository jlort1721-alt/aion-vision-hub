# Runbook · AION Reverse Connect Gateway

**Audiencia:** SRE / técnicos de plataforma.
**Objetivo:** resolver los incidentes operativos más comunes sin despertar a Isabella a las 3 AM.

---

## Inventario rápido

- **VPS:** AWS `t3.xlarge`, São Paulo (`sa-east-1`), IP pública `18.230.40.6`.
- **Proceso:** `aion-reverse-gateway` en PM2.
- **Puertos:** `7660/tcp` (Hik sig), `7661/tcp+udp` (Hik stream), `7681/tcp` (Dahua), `9464/tcp` (metrics, loopback+nginx), `50551/tcp` (gRPC, loopback), `51551/tcp` (crypto bridge, loopback).
- **Base de datos:** `postgres://aion:...@127.0.0.1:5432/aion`, schema `reverse`.
- **Cache:** Redis `127.0.0.1:6379` DB 3.
- **Media:** go2rtc en `http://127.0.0.1:1984` (compartido con el resto de AION; el gateway solo toca streams con prefijo `rv_`).

---

## Comandos de diagnóstico

```bash
# ¿Está vivo?
pm2 list | grep reverse
curl -fsS http://127.0.0.1:9464/health | jq

# ¿Cuántas sesiones?
psql $AION_PG_DSN -c "SELECT vendor, state, count(*) FROM reverse.sessions JOIN reverse.devices ON devices.id=sessions.device_pk GROUP BY 1,2"

# Últimos 200 eventos del log
pm2 logs aion-reverse-gateway --lines 200

# Métricas importantes
curl -s http://127.0.0.1:9464/metrics | grep -E 'aion_reverse_(sessions_online|errors_total|login_latency)'

# ¿Hay streams huérfanos en go2rtc?
curl -s http://127.0.0.1:1984/api/streams | jq 'keys[] | select(startswith("rv_"))'
```

---

## Incidentes

### I-01 — El gateway no arranca

**Síntomas:** PM2 muestra `errored`, `pm2 logs` repite el mismo error.

**Diagnóstico:**
```bash
pm2 logs aion-reverse-gateway --err --lines 100
```

Errores típicos y su causa:

| Error en log                           | Causa                                  | Acción                                                    |
|----------------------------------------|----------------------------------------|-----------------------------------------------------------|
| `KEK load failed`                      | archivo KEK faltante o con permisos    | `ls -l /etc/aion/reverse/kek.key` — debe ser `0400`       |
| `postgres connect failed`              | Postgres caído o DSN equivocado        | `systemctl status postgresql` y revisa `gateway.toml`     |
| `redis connect failed`                 | Redis caído o DB no accesible          | `redis-cli ping`                                          |
| `go2rtc unreachable`                   | go2rtc caído                           | `pm2 restart go2rtc`                                      |
| `bind: address already in use :7681`   | otro proceso ocupa el puerto           | `ss -tlnp | grep 7681` y decide                           |
| `cannot load libdhnetsdk.so`           | LD_LIBRARY_PATH mal configurado        | Revisa `env.LD_LIBRARY_PATH` en ecosystem file            |

**Escalamiento:** si ninguna coincide, copia las últimas 50 líneas y ábrele tarea en el canal `#aion-alerts`.

---

### I-02 — Un sitio concreto no conecta

**Síntomas:** la sesión de un sitio específico aparece como `disconnected` o nunca aparece.

**Triaje:**
1. Pregunta al técnico: ¿el equipo tiene luces encendidas e Internet? Si no, caso cerrado desde la central.
2. ¿Aparece en `reverse.devices`?
   ```sql
   SELECT * FROM reverse.devices
   WHERE device_id = 'SITE03-XVR01';
   ```
   - **No existe** → el equipo nunca ha llegado al VPS. Revisa su config de Auto Register / ISUP apuntando a `18.230.40.6`.
   - **Existe y status=pending_approval** → apruébalo desde la UI.
   - **Existe y status=blocked** → fue bloqueado a propósito; si hay que reactivar, usa el endpoint unblock (coordinar con Isabella).
   - **Existe y status=approved pero sin sesión activa** → sigue al paso 3.
3. Verifica heartbeats recientes:
   ```sql
   SELECT last_seen_at, now() - last_seen_at AS silence
   FROM reverse.devices WHERE device_id = 'SITE03-XVR01';
   ```
   - Si `silence < 2min`: el equipo está tocando pero falla el login. Mira logs del gateway: `pm2 logs | grep SITE03-XVR01`.
   - Si `silence > 10min`: el equipo no está llegando. Problema de red en el sitio o credenciales rotadas sin actualizar en AION.
4. Si el login falla repetidamente, las credenciales cambiaron en el sitio; **bloquea y re-aprueba** con las nuevas credenciales.

---

### I-03 — Todos los sitios caen a la vez

**Síntomas:** la métrica `aion_reverse_sessions_online` cae a 0 o casi 0 en un pico.

**Primera hipótesis — red del VPS:**
```bash
# ¿El VPS tiene Internet?
curl -fsS https://aws.amazon.com >/dev/null && echo UP || echo DOWN

# ¿Están vivos los puertos?
ss -tlnp | grep -E '7660|7661|7681'
```

**Segunda hipótesis — el proceso murió:**
```bash
pm2 list | grep reverse
# si está 'stopped' o 'errored':
pm2 restart aion-reverse-gateway
```

**Tercera hipótesis — Postgres o Redis:**
```bash
systemctl status postgresql
redis-cli ping
```

**Cuarta hipótesis — Security Group de AWS:**
```bash
aws ec2 describe-security-groups --group-ids $AION_AWS_SG_ID --region sa-east-1 \
  | jq '.SecurityGroups[].IpPermissions[] | select(.FromPort==7660 or .FromPort==7661 or .FromPort==7681)'
```
Si faltan reglas: `sudo ./ops/firewall/reverse-ports.sh open`.

**Si nada de lo anterior:** `pm2 restart aion-reverse-gateway`. Documenta en `#aion-alerts` y espera 60s; las sesiones reconectan.

---

### I-04 — Streams `rv_*` huérfanos en go2rtc

**Síntomas:** `curl http://127.0.0.1:1984/api/streams` muestra streams `rv_*` que no corresponden a ninguna sesión activa.

**Por qué pasa:** caída abrupta del gateway (`kill -9`) que no pudo limpiar.

**Limpieza automática:**
```bash
# Diff: streams rv_ en go2rtc vs. sesiones activas en el gateway
psql $AION_PG_DSN -At -c "
  SELECT go2rtc_name FROM reverse.streams
  WHERE stopped_at IS NULL" | sort > /tmp/should.txt

curl -s http://127.0.0.1:1984/api/streams | jq -r 'keys[] | select(startswith("rv_"))' | sort > /tmp/are.txt

comm -23 /tmp/are.txt /tmp/should.txt > /tmp/orphans.txt
while read -r name; do
  curl -X DELETE "http://127.0.0.1:1984/api/streams?src=$name"
done < /tmp/orphans.txt
```

**Prevención:** el script `ops/cleanup/orphan-streams.sh` corre por cron cada hora (ver §Programaciones).

---

### I-05 — Cobertura de grabación incompleta

**Síntomas:** usuario reporta que un segmento de video de ayer no existe.

**Causas posibles:**
1. La sesión estuvo `disconnected` durante ese periodo — consulta `reverse.sessions` por ventana de tiempo.
2. El stream `rv_*` existía pero no estaba siendo consumido por un recorder.
3. Capacidad de disco de go2rtc rebalsada — `df -h /var/lib/go2rtc`.

---

## Programaciones (cron)

```cron
# /etc/cron.d/aion-reverse
# Limpieza de streams huérfanos
15 * * * *  aion-reverse  /opt/aion/services/reverse-gateway/ops/cleanup/orphan-streams.sh

# Backup diario del schema reverse (además del backup global de AION)
0 3 * * *   aion-reverse  pg_dump "$AION_PG_DSN" --schema=reverse -Fc -f /backup/reverse-$(date +\%Y\%m\%d).dump

# Rotación: conservar 14 días
5 3 * * *   aion-reverse  find /backup -name 'reverse-*.dump' -mtime +14 -delete
```

---

## Alertas Prometheus recomendadas

```yaml
groups:
  - name: aion-reverse
    rules:
      - alert: ReverseGatewayDown
        expr: up{job="aion-reverse-gateway"} == 0
        for: 2m
        annotations:
          summary: "Gateway de reverse-connect caído"

      - alert: ReverseSessionsLow
        expr: sum(aion_reverse_sessions_online) < 20
        for: 10m
        annotations:
          summary: "Menos de 20 sitios reportando (esperado ~22)"

      - alert: ReverseErrorsSpiking
        expr: rate(aion_reverse_errors_total[5m]) > 1
        for: 5m

      - alert: ReverseHeartbeatsStalled
        expr: rate(aion_reverse_heartbeats_total[5m]) < 0.1
        for: 5m
```

---

## Rollback total

Si algo sale muy mal y hay que dar marcha atrás al reverse-gateway entero **sin tocar el resto de AION**:

```bash
# 1. Parar el proceso
pm2 stop aion-reverse-gateway && pm2 delete aion-reverse-gateway && pm2 save

# 2. Quitar reglas de firewall
sudo /opt/aion/services/reverse-gateway/ops/firewall/reverse-ports.sh close

# 3. (Opcional) Limpiar datos
psql $AION_PG_DSN -c "DROP SCHEMA reverse CASCADE"

# 4. Revertir en git
cd /opt/aion && git checkout main && git pull

# 5. Confirmar que AION sigue funcionando
curl -fsS https://aionseg.co/api/health | jq
```

**Los procesos `aion-api`, `aion-agent`, `aion-web`, `go2rtc` nunca se tocaron**, así que este rollback NO afecta al resto de la plataforma. Las 16 cámaras Hikvision que ya estaban integradas vía ISAPI siguen funcionando exactamente igual.

---

**Autor:** plataforma AION · v1.1.0 · Abril 2026.
