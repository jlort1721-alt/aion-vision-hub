# Runbook — Pipeline de alarmas

## Arquitectura

```
DVR Hikvision (ISAPI)
  ↓ HTTP POST
POST http://18.230.40.6:7660/isapi/event  (public route, no JWT)
  ↓ parse + INSERT
isapi_events (PG)
  ↓ trigger notify_row_change()
pg_notify aion_event
  ↓ LISTEN
event-gateway (container Python)
  ↓ canonical event v1
MQTT aion/events/<category>/aion_db
  ↓ subscribe (futuro)
Frontend WebSocket / access-orchestrator / Node-RED / etc
```

## Verificar que los pushes están llegando

```bash
ssh aion-vps 'sudo -u postgres psql aionseg_prod -c "
SELECT event_type, count(*), max(created_at)
FROM isapi_events
WHERE created_at > NOW() - INTERVAL '\''1 hour'\''
GROUP BY event_type;"'
```

Si la tabla está vacía en últimas horas → DVRs no están enviando. Revisar:

1. **Webhook configurado en el DVR?**
   ```bash
   curl --digest -u admin:<pass> \
     "http://<dvr_ip>:<port>/ISAPI/Event/notification/httpHosts"
   ```
   Debe devolver XML con `<url>http://18.230.40.6:7660/isapi/event</url>`.

2. **Motion detection habilitada?**
   ```bash
   curl --digest -u admin:<pass> \
     "http://<dvr_ip>:<port>/ISAPI/System/Video/inputs/channels/1/motionDetection"
   ```
   Debe tener `<enabled>true</enabled>`.

3. **Evento linkage a HTTP?**
   En el XML anterior debe aparecer:
   ```xml
   <EventTriggerNotificationList>
     <EventTriggerNotification>
       <notificationMethod>HTTP</notificationMethod>
   ```

4. **Re-aplicar configuración remota:**
   ```bash
   ssh aion-vps
   cd /tmp
   sudo -E bash /Users/ADMIN/Documents/open-view-hub-main/aion/scripts/configure-hikvision-remote.sh
   ```

## Ver flujo E2E funcionando

```bash
# Terminal 1: subscribe MQTT
ssh aion-vps
source /opt/aion-docker/mosquitto-credentials.env
mosquitto_sub -h 127.0.0.1 -u aionseg_api -P "$MQTT_PASS_AIONSEG_API" -t "aion/events/#" -v

# Terminal 2: POST test
curl -X POST -H "Content-Type: application/xml" \
  -d '<EventNotificationAlert><eventType>motion</eventType><channelID>5</channelID><ipAddress>200.58.214.114</ipAddress></EventNotificationAlert>' \
  https://aionseg.co/api/isapi/event
# → {"ok":true}

# Terminal 1 debe mostrar mensaje MQTT aion/events/system/aion_db con canonical v1.
```

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| POST 401 | JWT middleware está bloqueando | Verificar que `/isapi/event` esté en PUBLIC_ROUTES en `plugins/auth.ts` |
| POST 415 `FST_ERR_CTP_INVALID_MEDIA_TYPE` | Parser XML no registrado | El módulo `isapi-ingest` registra el parser automáticamente |
| POST 500 `row violates row-level security` | RLS bloqueando INSERT | Migración 040 debe estar aplicada |
| INSERT OK pero MQTT no recibe | event-gateway down | `docker restart aion-event-gateway` |
| MQTT recibe pero frontend no | Suscriptor WS no conectado | Ver DevTools Network tab |
