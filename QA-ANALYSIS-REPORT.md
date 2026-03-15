# AION Vision Hub — Análisis QA Integral
# Central de Monitoreo Remoto All-in-One

**Fecha:** 2026-03-15
**Dominio:** https://aionseg.co
**Estado actual:** 89% certificado (71/80 tests)
**Objetivo:** 100% — Sistema completo de central de seguridad

---

## RESUMEN EJECUTIVO

AION Vision Hub es una plataforma de videovigilancia empresarial con arquitectura sólida (React 18 + Fastify 5 + PostgreSQL/Supabase + MediaMTX). El sistema tiene **27 rutas API, 38 tablas de base de datos, 23 páginas frontend y 25 archivos de test**.

Sin embargo, para funcionar como una **central de monitoreo remoto profesional all-in-one**, se identificaron **14 áreas críticas** que requieren desarrollo adicional, estimando **~30-50 tablas nuevas** y **15-20 triggers/funciones de automatización**.

---

## ESTADO ACTUAL POR MÓDULO

| Módulo | Frontend | Backend | DB | Estado |
|--------|----------|---------|-----|--------|
| Dashboard | ✅ Completo | ✅ API | ✅ | LISTO |
| Live View (Cámaras) | ✅ Completo | ✅ Streams | ✅ | LISTO (falta cámaras) |
| Eventos | ✅ Completo | ✅ CRUD+Stats | ✅ | LISTO |
| Incidentes | ⚠️ Parcial | ✅ CRUD+Evidence | ✅ | FALTA: SLA, escalación |
| Dispositivos | ✅ Completo | ✅ CRUD+Test | ✅ | LISTO |
| Sitios | ✅ Completo | ✅ CRUD | ✅ 22 sitios | LISTO |
| Control de Acceso | ⚠️ Parcial | ✅ People+Vehicles | ✅ | FALTA: automatización |
| Intercomunicación | ⚠️ Parcial | ✅ SIP+Fanvil | ✅ | FALTA: UI completa |
| Domótica | ⚠️ Parcial | ✅ eWeLink | ✅ | FALTA: reglas automáticas |
| WhatsApp | 🔴 Esqueleto | ✅ Completo | ✅ | FALTA: UI funcional |
| Email | ✅ Config | ✅ Resend/SMTP | ✅ | LISTO |
| AI/Chat | ✅ Completo | ✅ OpenAI+Claude | ✅ | LISTO |
| Voz/TTS | ✅ Config | ✅ ElevenLabs | ✅ | LISTO |
| Reportes | ⚠️ Parcial | ✅ Generate+Export | ✅ | FALTA: programación |
| Auditoría | ✅ Completo | ✅ Logs+Stats | ✅ | LISTO |
| Usuarios/Roles | ✅ Completo | ✅ RBAC | ✅ | LISTO |
| Multi-tenancy | ✅ Completo | ✅ RLS | ✅ 31 tablas | LISTO |

---

## BRECHAS CRÍTICAS IDENTIFICADAS

### 🔴 PRIORIDAD 1 — CRÍTICO (Funcionalidad central faltante)

#### 1. Sistema de Alertas en Tiempo Real
**Estado:** NO IMPLEMENTADO
**Impacto:** Sin esto, no es una central de monitoreo funcional

**Necesario:**
- Motor de reglas de alerta (evento → condición → acción)
- Políticas de escalación (operador → supervisor → gerente)
- Supresión de alertas (evitar spam)
- Sistema de acknowledgment (acusar recibo)
- Notificaciones push (navegador + móvil)
- Integración con PagerDuty/OpsGenie

**Tablas necesarias:**
```sql
alert_rules (id, tenant_id, name, conditions, actions, severity, enabled)
alert_escalation_policies (id, tenant_id, name, levels, timeout_minutes)
alert_escalation_levels (id, policy_id, level, notify_roles, notify_users)
alert_instances (id, rule_id, event_id, status, acknowledged_by, acknowledged_at)
alert_suppressions (id, tenant_id, rule_id, start_time, end_time, reason)
notification_channels (id, tenant_id, type, config, enabled)
notification_log (id, channel_id, recipient, status, sent_at, error)
```

#### 2. WebSocket para Dashboard en Tiempo Real
**Estado:** Paquete instalado (@fastify/websocket) pero NO implementado
**Impacto:** Dashboard no se actualiza en vivo

**Necesario:**
- Streaming de eventos en tiempo real
- Estado de cámaras online/offline
- Actualizaciones de incidentes en vivo
- Sincronización entre múltiples operadores
- Rooms basados en sitio/tenant
- Heartbeat y reconexión automática

#### 3. Gestión de Turnos y Guardias
**Estado:** NO EXISTE
**Impacto:** No se puede asignar responsables ni cubrir horarios

**Necesario:**
```sql
shifts (id, tenant_id, site_id, name, start_time, end_time, days_of_week)
shift_assignments (id, shift_id, user_id, date, status, check_in, check_out)
guard_tours (id, tenant_id, site_id, name, checkpoints, frequency)
guard_tour_logs (id, tour_id, user_id, checkpoint_id, timestamp, status, notes)
```

**Automatizaciones:**
- Recordatorio de inicio de turno (15 min antes)
- Alerta si guardia no hace check-in
- Rotación automática de turnos
- Reporte de asistencia

#### 4. Gestión de SLAs (Acuerdos de Nivel de Servicio)
**Estado:** NO EXISTE
**Impacto:** No se puede medir calidad del servicio

**Necesario:**
```sql
sla_definitions (id, tenant_id, name, response_time_minutes, resolution_time_minutes, severity)
sla_tracking (id, incident_id, sla_id, response_deadline, resolution_deadline, breached, breach_time)
```

**Automatizaciones:**
- Temporizador de respuesta por incidente
- Alerta pre-breach (80% del tiempo)
- Alerta de breach
- Escalación automática en breach
- Dashboard de cumplimiento SLA

---

### 🟠 PRIORIDAD 2 — ALTA (Funcionalidades profesionales)

#### 5. Protocolos de Emergencia
**Estado:** NO EXISTE
**Impacto:** Sin procedimientos estandarizados ante emergencias

**Necesario:**
```sql
emergency_protocols (id, tenant_id, name, type, steps, contacts, auto_actions)
emergency_activations (id, protocol_id, activated_by, site_id, status, timeline)
emergency_contacts (id, tenant_id, name, phone, role, priority, available_hours)
```

**Tipos de protocolo:**
- Intrusión confirmada → llamar policía + activar alarma + grabar evidencia
- Incendio → llamar bomberos + activar evacuación + notificar residentes
- Emergencia médica → llamar ambulancia + abrir accesos
- Pánico → verificar cámaras + contactar guardia + escalar

#### 6. Gestión de Visitantes
**Estado:** Access control existe pero sin flujo de visitantes
**Impacto:** No hay pre-registro ni autorización automatizada

**Necesario:**
```sql
visitor_requests (id, tenant_id, site_id, visitor_name, host_unit, scheduled_at, status, qr_code)
visitor_logs (id, request_id, entry_time, exit_time, vehicle_plate, guard_id)
visitor_blacklist (id, tenant_id, name, document_id, reason, added_by)
```

**Automatizaciones:**
- Pre-registro por WhatsApp/email
- Generación de QR para acceso
- Notificación al residente cuando llega visitante
- Verificación contra blacklist
- Registro fotográfico automático

#### 7. Rondas de Vigilancia (Patrol Management)
**Estado:** NO EXISTE
**Impacto:** No se puede verificar que guardias cumplan recorridos

**Necesario:**
- Definición de checkpoints por sitio
- Rutas de patrullaje con horarios
- Check-in en cada checkpoint (QR/NFC/GPS)
- Alertas de checkpoint perdido
- Reportes de cumplimiento

#### 8. Motor de Automatización / Reglas
**Estado:** NO EXISTE (la pieza más transformadora)
**Impacto:** Todo proceso es manual

**Necesario:**
```sql
automation_rules (id, tenant_id, name, trigger_type, trigger_conditions, actions, enabled, priority)
automation_actions (id, rule_id, action_type, config, delay_seconds, order)
automation_logs (id, rule_id, trigger_event, actions_executed, status, error)
```

**Ejemplos de reglas:**
- SI evento.tipo = "movimiento" Y hora ENTRE 23:00-06:00 → crear alerta crítica + enviar WhatsApp
- SI dispositivo.offline > 5 minutos → escalar a supervisor + crear ticket
- SI visitante en blacklist detectado → alerta máxima + grabar video + notificar policía
- SI temperatura sensor > 45°C → activar protocolo incendio
- SI no hay check-in de guardia en 30 min → llamar guardia + escalar

#### 9. Reportes Programados y Analítica
**Estado:** Backend genera reportes pero no hay programación
**Impacto:** Informes se generan solo manualmente

**Necesario:**
```sql
scheduled_reports (id, tenant_id, name, type, schedule_cron, recipients, format, last_run)
report_templates (id, tenant_id, name, sections, filters, charts)
```

**Tipos de reporte automático:**
- Reporte diario de novedades (6 AM)
- Reporte semanal de incidentes
- Reporte mensual de SLA
- Reporte de rondas de vigilancia
- Reporte de control de acceso

#### 10. Facturación y Gestión de Clientes
**Estado:** NO EXISTE
**Impacto:** No se puede cobrar servicios ni gestionar contratos

**Necesario:**
```sql
contracts (id, tenant_id, client_id, start_date, end_date, monthly_fee, services, status)
invoices (id, contract_id, period, amount, status, payment_date, due_date)
service_packages (id, name, description, price, features, cameras_limit, sites_limit)
```

---

### 🟡 PRIORIDAD 3 — MEDIA (Mejoras avanzadas)

#### 11. Cumplimiento Normativo
- Templates de compliance (ISO 27001, SOC2, GDPR equivalente colombiano - Ley 1581)
- Exportación de evidencia para auditorías
- Retención de datos configurable por regulación
- Consentimiento de datos personales (Habeas Data)

#### 12. Inteligencia Artificial Avanzada
- Detección de personas/vehículos por IA en streams
- Reconocimiento de placas vehiculares (LPR)
- Detección de anomalías en patrones de acceso
- Predicción de incidentes basada en históricos
- Análisis de sentimiento en comunicaciones

#### 13. Gestión de Llaves y Accesos Físicos
```sql
key_management (id, tenant_id, site_id, key_name, location, assigned_to, status)
key_logs (id, key_id, action, user_id, timestamp, notes)
```

#### 14. Capacitación y Certificaciones del Personal
```sql
training_programs (id, tenant_id, name, content, duration, required_for_roles)
certifications (id, user_id, program_id, issued_at, expires_at, status)
```

---

## ANÁLISIS DE SEGURIDAD

### ✅ Implementado Correctamente
| Aspecto | Detalle |
|---------|---------|
| JWT Auth | HS256, 24h expiry, 32-char min secret |
| RBAC | 5 roles con verificación por ruta |
| RLS | 31 tablas con Row Level Security |
| Cifrado | AES-256-GCM para credenciales |
| Rate Limiting | Nginx (30r/s API, 5r/m auth) + Fastify (200/60s) |
| CORS | Validación por origen configurado |
| Headers | HSTS, X-Frame, X-Content-Type, CSP |
| Webhook | HMAC-SHA256 + protección contra replay |
| Audit | Logging completo con contexto tenant/user |
| Firewall | UFW + fail2ban (3 jails) |
| SSL | Cloudflare edge (A+) + origin cert |

### 🔴 Gaps de Seguridad
| Gap | Riesgo | Recomendación |
|-----|--------|---------------|
| Sin 2FA/MFA | Alto | Implementar TOTP con QR |
| Sin revocación de tokens | Alto | Redis para blacklist de JWT |
| Credenciales en .env plaintext | Medio | Vault/KMS para secretos |
| Sin cifrado en reposo DB | Medio | Cifrar campos sensibles en JSONB |
| Sin detección de fuerza bruta | Medio | Contador de intentos fallidos |
| Sin gestión de sesiones | Medio | Listar/revocar sesiones activas |
| Sin API keys | Medio | Para integraciones M2M |
| Logs de auditoría sin retención | Bajo | Política de 90 días + archivo |

---

## ANÁLISIS FRONTEND (23 Páginas, 13,033 LOC)

### Páginas Completamente Funcionales
- Dashboard, Live View, Events, Sites, Devices
- Settings (9 secciones), AI Assistant, Reports, Audit Logs
- Users, Login, Profile

### Páginas con Gaps
| Página | Estado | Faltante |
|--------|--------|----------|
| Incidents | 70% | SLA tracking, escalation UI, assignment workflows |
| Intercom | 60% | Call history UI, door control panel completo |
| Domotics | 50% | Reglas de automatización UI, scheduling |
| Access Control | 60% | Visitor flow UI, QR generation, blacklist |
| WhatsApp | 20% | Solo tabs, sin conversaciones funcionales |

### Mejoras UX Necesarias
- Modo oscuro: configurado pero sin verificar
- Notificaciones push en navegador
- Sonido de alerta configurable
- Atajos de teclado para operadores
- Tour guiado para nuevos usuarios

---

## ANÁLISIS BASE DE DATOS (38 Tablas)

### Tablas Existentes: 38
- Core: tenants, profiles, userRoles, sites, sections
- Seguridad: devices, events, incidents, auditLogs
- Acceso: accessPeople, accessVehicles, accessLogs
- Comunicación: waConversations, waMessages, waTemplates
- Domótica: domoticDevices, domoticActions
- Intercom: intercomDevices, intercomCalls, callSessions, voipConfig
- AI: aiSessions, mcpConnectors
- Sistema: reports, integrations, databaseRecords, rebootTasks

### Tablas Nuevas Necesarias: ~35-45
**Alertas (7):** alert_rules, alert_escalation_policies, alert_escalation_levels, alert_instances, alert_suppressions, notification_channels, notification_log

**Turnos (4):** shifts, shift_assignments, guard_tours, guard_tour_logs

**SLA (2):** sla_definitions, sla_tracking

**Emergencias (3):** emergency_protocols, emergency_activations, emergency_contacts

**Visitantes (3):** visitor_requests, visitor_logs, visitor_blacklist

**Automatización (3):** automation_rules, automation_actions, automation_logs

**Reportes (2):** scheduled_reports, report_templates

**Comercial (3):** contracts, invoices, service_packages

**Llaves (2):** key_management, key_logs

**Capacitación (2):** training_programs, certifications

**Rondas (3):** patrol_routes, patrol_checkpoints, patrol_logs

**Vehículos (2):** vehicle_tracking, parking_management

---

## AUTOMATIZACIONES NECESARIAS (Triggers/Functions/Cron)

### Triggers PostgreSQL
| # | Trigger | Tabla | Acción |
|---|---------|-------|--------|
| 1 | on_event_created | events | Evaluar reglas de alerta → crear alert_instance |
| 2 | on_alert_unacknowledged | alert_instances | Después de timeout → escalar al siguiente nivel |
| 3 | on_incident_created | incidents | Iniciar temporizador SLA |
| 4 | on_sla_breach | sla_tracking | Escalar + notificar + registrar breach |
| 5 | on_device_offline | devices | Crear alerta + intentar reconexión |
| 6 | on_visitor_entry | visitor_logs | Verificar blacklist + notificar residente |
| 7 | on_shift_no_checkin | shift_assignments | Alertar supervisor después de 15 min |
| 8 | on_patrol_checkpoint_missed | patrol_logs | Alertar si checkpoint no registrado |
| 9 | on_emergency_activated | emergency_activations | Ejecutar acciones automáticas del protocolo |
| 10 | on_access_denied | accessLogs | Si 3+ denegaciones → crear alerta |

### Cron Jobs (Backend)
| # | Job | Frecuencia | Acción |
|---|-----|-----------|--------|
| 1 | generate_daily_report | 6:00 AM diario | Generar y enviar reporte de novedades |
| 2 | check_device_health | Cada 5 min | Ping dispositivos → actualizar estado |
| 3 | check_sla_deadlines | Cada 1 min | Verificar SLAs próximos a vencer |
| 4 | archive_old_logs | Diario 2 AM | Mover logs > 90 días a archivo |
| 5 | check_shift_compliance | Cada 15 min | Verificar check-ins de turno |
| 6 | sync_camera_status | Cada 30 seg | Estado de streams MediaMTX |
| 7 | generate_invoices | Mensual día 1 | Generar facturas por contrato |
| 8 | check_cert_expiry | Semanal | Verificar expiración de certificados |
| 9 | cleanup_stale_sessions | Cada hora | Limpiar sesiones WebSocket inactivas |
| 10 | send_scheduled_reports | Según cron | Ejecutar reportes programados |

---

## PLAN DE IMPLEMENTACIÓN RECOMENDADO

### FASE 1 — Semanas 1-2: Fundamentos Críticos
1. ✅ WebSocket para tiempo real (usar @fastify/websocket ya instalado)
2. ✅ Motor de alertas básico (evento → regla → notificación)
3. ✅ Políticas de escalación (3 niveles)
4. ✅ 2FA con TOTP
5. ✅ Índices de base de datos (performance)

### FASE 2 — Semanas 3-4: Operaciones
6. Gestión de turnos y guardias
7. SLA tracking con temporizadores
8. Protocolos de emergencia
9. Rondas de vigilancia (checkpoints)
10. Reportes programados diarios/semanales

### FASE 3 — Mes 2: Automatización
11. Motor de reglas de automatización completo
12. Gestión de visitantes con QR
13. WhatsApp funcional (conversaciones en UI)
14. Notificaciones push (navegador + móvil)
15. Analítica avanzada y KPIs

### FASE 4 — Mes 3: Comercial y Compliance
16. Contratos y facturación
17. Gestión de llaves
18. Cumplimiento normativo (Ley 1581)
19. Capacitación del personal
20. IA avanzada (detección de objetos, LPR)

---

## MÉTRICAS DE COMPLETITUD

| Área | Actual | Con Fase 1 | Con Fase 2 | Con Fase 3 | Con Fase 4 |
|------|--------|-----------|-----------|-----------|-----------|
| Videovigilancia | 85% | 90% | 92% | 95% | 98% |
| Control de Acceso | 60% | 65% | 75% | 90% | 95% |
| Alertas/Escalación | 10% | 70% | 85% | 95% | 98% |
| Comunicaciones | 50% | 55% | 65% | 85% | 95% |
| Automatización | 5% | 25% | 50% | 85% | 95% |
| Operaciones | 40% | 50% | 80% | 90% | 95% |
| Reportes | 30% | 35% | 70% | 85% | 95% |
| Comercial | 0% | 0% | 10% | 30% | 80% |
| Compliance | 20% | 30% | 40% | 60% | 85% |
| **TOTAL** | **33%** | **47%** | **63%** | **79%** | **93%** |

---

## CONCLUSIÓN

AION Vision Hub tiene una **arquitectura sólida y bien diseñada** que sirve como base excelente para una central de monitoreo profesional. Los módulos core (autenticación, multi-tenancy, dispositivos, eventos, auditoría) están **listos para producción**.

Para convertirlo en un **sistema all-in-one de central de seguridad**, las prioridades inmediatas son:

1. **WebSocket + Alertas en tiempo real** — Sin esto, no es una central de monitoreo funcional
2. **Motor de automatización** — La pieza más transformadora del sistema
3. **Gestión de turnos/guardias** — Core de cualquier central de seguridad
4. **SLA tracking** — Diferenciador profesional vs. amateur

El esfuerzo estimado para llegar al 93% es de **~3-4 meses de desarrollo intensivo**, con la Fase 1 entregando valor inmediato en las primeras 2 semanas.

---

**Generado:** 2026-03-15
**Analistas:** Claude Opus 4.6 (3 agentes paralelos: Frontend, Backend, DB/Automatización)
