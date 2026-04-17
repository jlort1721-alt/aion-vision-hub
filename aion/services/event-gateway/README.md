# event-gateway (lite)

Puente entre `pg_notify` (triggers `aion_event` en tablas `events`, `incidents`, `alert_instances`) y MQTT (`aion/events/#`).

**Alcance lite:** solo es **consumidor** de PostgreSQL. No escribe a la DB, no reemplaza el WebSocket actual, no toca los workers Hik/Dahua.

## Contrato

| Entrada | Salida |
|---|---|
| `LISTEN aion_event` en `aionseg_prod` | Publica canonical event v1 a `aion/events/<category>/<source_type>` |
| Payload PG: `{table, op, tenant_id, row}` | Payload MQTT: schema `canonical-event-v1.json` |

## Endpoints

- `GET /health` → liveness
- `GET /ready` → readiness (MQTT conectado + PG listener activo)
- `GET /metrics-lite` → `{published, failed, mqtt_ready, pg_connected}`

## Variables de entorno

Ver `.env.example`.

## Despliegue

```bash
docker compose -f infra/compose/event-gateway.yml up -d
```

## Tests (TODO Fase 2 completa)

- Unit: `canonical.build_canonical()` para cada tabla origen.
- Integration: testcontainers con PG+Mosquitto.
