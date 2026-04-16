# TOOL HANDLERS MATRIX — AION Agent — 2026-04-15

## Resumen

- **Total handlers:** 45 (en 22 archivos de `backend/apps/backend-api/src/modules/mcp-bridge/tools/`)
- **Discrepancia vs esperado:** +17 (usuario estimaba 28; real son 45 agrupando tools especializados)
- **Registro central:** `toolRegistry` (Map) en `index.ts` líneas 63-90
- **Cobertura de tests:** **0%** — ningún handler tiene test asociado (hallazgo crítico)

## Distribución por modelo recomendado (routing)

| Modelo | Handlers | Razón |
|---|---|---|
| **Opus** | 8 | Decisiones irreversibles, compliance, PTZ, apertura física |
| **Sonnet** | 11 | Reportes, resúmenes narrativos, análisis de anomalías, SLA |
| **Haiku** | 26 | Queries, listados, ACKs, búsquedas |

## Handlers por categoría (resumen)

| Archivo | Handlers | Rol | Modelos |
|---|---|---|---|
| `db-read.ts` | 5 | query_events, query_incidents, query_devices, get_site_status, get_dashboard_summary | Haiku |
| `event-action-tools.ts` | 3 | acknowledge_event, bulk_acknowledge_events, dismiss_event | Haiku |
| `alert-tools.ts` | 2 | query_alert_instances, acknowledge_alert | Haiku |
| `incident-server.ts` | 4 | create_incident, update_incident_status, add_incident_comment, get_incident_timeline | Sonnet + Haiku |
| `device-command.ts` | 4 | open_gate, trigger_relay, reboot_device, get_device_status | **Opus** + Haiku |
| `notification-server.ts` | 3 | send_alert, send_email, query_notification_history | Haiku |
| `report-server.ts` | 3 | generate_report, get_report_templates, get_kpi_snapshot | Sonnet + Haiku |
| `ewelink-tools.ts` | 3 | list_ewelink_devices, toggle_ewelink_device, get_ewelink_device_status | **Opus** + Haiku |
| `access-control-tools.ts` | 3 | search_people, search_vehicles, get_access_stats | Haiku |
| `emergency-tools.ts` | 3 | list_emergency_protocols, list_emergency_contacts, activate_emergency_protocol | **Opus** + Haiku |
| `anomaly-tools.ts` | 2 | detect_anomalies, get_baseline_stats | Sonnet + Haiku |
| `operations-tools.ts` | 3 | get_current_shift, check_patrol_compliance, get_sla_metrics | Sonnet + Haiku |
| `compliance-training-tools.ts` | 4 | get_compliance_status, query_certifications, query_retention_policies, audit_compliance_template | **Opus** + Sonnet |
| `visitor-tools.ts` | 3 | search_visitors, register_visitor, check_visitor_blacklist | **Opus** + Haiku |
| `management-tools.ts` | 3 | query_contracts, manage_key_inventory, get_revenue_summary | Haiku |
| `knowledge-tools.ts` | 2 | search_knowledge, add_knowledge_entry | Haiku |
| `automation-query-tools.ts` | 3 | query_automation_rules, toggle_automation_rule, get_rule_execution_history | Haiku |
| `ai-summary-tools.ts` | 2 | generate_incident_summary, generate_shift_summary | **Opus** + Sonnet |
| `hikvision-isapi-tools.ts` | 5 | test_hikvision_devices, get_hikvision_device_info, get_hikvision_channels, get_hikvision_hdd_status, hikvision_ptz_control | **Opus** + Sonnet + Haiku |
| `camera-stream-tools.ts` | 3 | list_cameras, get_stream_status, get_go2rtc_summary | Haiku |
| `remote-access-tools.ts` | 3 | get_site_access_map, get_port_forwarding_guide, test_remote_connectivity | Sonnet + Haiku |
| `system-health-tools.ts` | 2 | check_system_health, get_table_counts | Haiku |

## Handlers críticos a testear primero (Opus tier)

1. `open_gate` — apertura física
2. `trigger_relay` — activación sirenas/luces
3. `reboot_device` — reinicio DVR/NVR
4. `activate_emergency_protocol` — disparo de protocolos
5. `audit_compliance_template` — auditoría Ley 1581
6. `hikvision_ptz_control` — control físico PTZ
7. `generate_incident_summary` — narrativa con IA
8. `check_visitor_blacklist` — bloqueo de acceso

Todos estos deben tener test unitario + test de auditoría (verificar que escriben en `audit_logs`).

## Acciones pendientes

1. **Test coverage 0% → 80%** (meta del CLAUDE.md): escribir vitest tests por handler. Prioridad Opus → Sonnet → Haiku.
2. **Validación Zod uniforme**: estandarizar input schemas en todos los handlers.
3. **Routing efectivo**: implementar `@aion/model-router` que use `tools/routing-rules.ts` para decidir modelo por handler. Hoy el routing depende del caller.
4. **Audit enhancement**: agregar `duration_ms` y `tokens_used` en `agent_tool_logs` (tabla vacía según DB_AUDIT).
5. **Documentar intención por handler**: comment line explicando por qué Opus/Sonnet/Haiku.
