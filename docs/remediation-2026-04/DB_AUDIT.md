# DB AUDIT — aionseg_prod — 2026-04-15

**Servidor:** PostgreSQL 16.13 (Ubuntu 24.04) en VPS 18.230.40.6
**Base:** `aionseg_prod`, propietario `postgres`
**Conexiones activas:** 28
**Total tablas public:** **158**

## Resumen por severidad

| Severidad | # hallazgos |
|---|---|
| CRÍTICO | 0 |
| ALTO | 2 |
| MEDIO | 4 |
| BAJO | 1 |

## Hallazgos

### DB-001 [ALTO] 48 tablas vacías — posibles features no implementados

Tablas con 0 filas (muchas son tablas del documento de revisión FX-NNN que aún NO están activas en runtime):

```
access_events, access_points, agent_learning, agent_tool_logs, ai_detection_zones,
ai_vision_detections, alarm_verifications, call_sessions, camera_events, camera_snapshots,
certifications, clip_exports, clips, device_health_log, domotic_actions,
domotic_scene_executions, domotics_audit_logs, event_log, face_enrollments,
floor_plan_positions, floor_plans, incident_notes, intercom_calls, invoices,
iot_scene_actions, iot_scenes, iot_schedules, key_logs, knowledge_uploads,
live_view_layouts, lpr_events, mcp_connectors, monitoring_layouts, motion_events,
network_configs, notification_rules, paging_broadcasts, playback_requests,
push_subscriptions, reboot_tasks, resident_reports, site_cctv_description,
stream_health, stream_sessions, system_credentials, video_search_index,
wa_conversations, wa_messages
```

**Cruce con hallazgos FX:**
- `iot_scenes`, `iot_scene_actions`, `iot_schedules` → FX-064, FX-065 (Domóticos)
- `live_view_layouts`, `monitoring_layouts` → FX-021 (64 cámaras, persistencia de layouts)
- `clip_exports`, `clips`, `playback_requests` → FX-033 (exportación), FX-030 (timeline)
- `intercom_calls`, `call_sessions` → FX-082, FX-083 (citofonía, historial)
- `alarm_verifications`, `notification_rules` → FX-042, FX-043 (alertas)
- `incident_notes` → FX-045, FX-046 (incidentes + novedades técnicas)
- `access_events` → FX-025, FX-075 (visitantes, auditoría)
- `floor_plans`, `floor_plan_positions` → planos de sitio (FX-052)
- `key_logs` → FX-115 (gestión de llaves)
- `push_subscriptions` → notificaciones (FX-012)
- `mcp_connectors` → FX-MCP bloque 1.3
- `face_enrollments` → face-recognition (implementado en PM2 pero sin datos)
- `wa_conversations`, `wa_messages` → WhatsApp (Twilio)

**Remediación:** Cada tabla vacía es un feature a implementar como parte de Fase 2 (FX-NNN). Documentado en `FX_TABLE_MAP.md`.

### DB-002 [ALTO] 32 FKs sin índice en columna referenciante

Riesgo: DELETE/UPDATE en tabla padre lentos, JOINs sin usar índice.

Tabla | Columnas sin índice
---|---
access_logs | vehicle_id
ai_sessions | tenant_id
alert_instances | escalation_policy_id
biometric_records | tenant_id
cctv_equipment | tenant_id
database_records | section_id
devices | group_id
domotic_devices | section_id
emergency_activations | protocol_id, site_id
incidents | site_id
intercom_calls | device_id, section_id
intercom_devices | section_id
intercoms | tenant_id
patrol_logs | checkpoint_id
playback_requests | device_id, tenant_id
reboot_tasks | section_id
sections | site_id
site_administrators | tenant_id
system_credentials | tenant_id
zone_coordinators | tenant_id
agent_knowledge | site_id
agent_learning | knowledge_id
resident_sessions | resident_id, site_id
ai_vision_detections | rule_id
biomarkers | tenant_id
iot_scene_actions | scene_id
incident_notes | incident_id
site_admins | site_id
site_equipment_inventory | site_id
sirens | site_id
camera_detections | reviewed_by
reverse.gb28181_devices | device_pk

**Remediación:** Migración `migrations/030_fk_indices.sql` creando 32 índices idempotentes (`CREATE INDEX IF NOT EXISTS`).

### DB-003 [MEDIO] 2 tablas sin RLS

- `audit_log` → OK (tabla administrativa, acceso restringido a superusuario)
- `schema_migrations` → OK (catálogo de drizzle/node-pg-migrate)

No requiere acción.

### DB-004 [MEDIO] Tabla `audit_logs` (con s) vs `audit_log` (sin s) — duplicación

`audit_logs` tiene 1275 filas con RLS. `audit_log` existe con 82 filas sin RLS. Probable duplicación histórica de esquema.

**Remediación:** Verificar que el código escribe sólo a `audit_logs`, migrar registros históricos de `audit_log` y deprecar. Asignar a `MIGRACION_PENDIENTE.md`.

### DB-005 [MEDIO] Dos tablas paralelas: `intercom_devices` vs `intercoms`

`intercom_devices` (29 filas) y `intercoms` (28 filas) conviven. Ambas con RLS pero sin claro delimitador.

**Remediación:** Auditar código para ver cuál es la activa. Deprecar la otra.

Similar: `site_administrators` (37) vs `site_admins` (28) — duplicación evidente (FX-073 bloque H).

### DB-006 [MEDIO] 156/158 tablas con RLS habilitado

Estado bueno (98.7% coverage). Las 2 sin RLS son administrativas.

### DB-007 [BAJO] Migraciones aplicadas

Última migración: `029_audit_triggers` (2026-04-15 00:45). Tabla `schema_migrations` funcional con columnas `version, name, checksum, executed_at, duration_ms`.

Migraciones recientes visibles: 025 `enable_rls_global`, 026 `policies_residential`, 027 `policies_operational`, 028 `policies_audit_compliance`, 029 `audit_triggers`.

## Tamaño de datos (top 10)

| Tabla | Filas | Tamaño |
|---|---|---|
| visual_patrol_logs | 31603 | 6816 kB |
| camera_detections | 3740 | 1912 kB |
| automation_executions | 2129 | 1488 kB |
| residents | 1824 | 1160 kB |
| access_people | 1823 | 1224 kB |
| biometric_records | 1410 | 368 kB |
| audit_logs | 1275 | 1008 kB |
| access_vehicles | 972 | 312 kB |
| vehicles | 971 | 352 kB |
| refresh_tokens | 831 | 488 kB |

Sin tablas sobredimensionadas. BD total estimada < 100 MB.

## Políticas RLS aplicadas (patrón)

Las tablas operacionales siguen patrón uniforme de 4 políticas:
- `api_service_read` (SELECT)
- `api_service_write` (INSERT)
- `api_service_update` (UPDATE)
- `admin_full_access` (ALL)

Más algunas con aislamiento por tenant/usuario (`aic_user_isolation`, `access_events_tenant_read`, `automation_tenant_read/write`).

## Acciones inmediatas

1. Generar migración `030_fk_indices.sql` (DB-002).
2. Crear `MIGRACION_PENDIENTE.md` con tablas duplicadas (DB-004, DB-005).
3. Implementar features en tablas vacías como parte de Fase 2 FX-NNN.
