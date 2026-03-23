# Clave Seguridad — Referencia API

> Documentación completa de todos los endpoints REST
> Versión 1.0 — Base URL: `https://tu-dominio.com/api/v1`
> Documentación interactiva Swagger: `https://tu-dominio.com/docs`

---

## Autenticación

Todas las rutas (excepto `/health` y webhooks) requieren JWT:

```
Authorization: Bearer <token>
```

### Obtener Token

```http
POST /auth/login
Content-Type: application/json

{
  "supabaseToken": "<token-de-supabase>"
}

→ 200 OK
{
  "accessToken": "eyJ...",
  "refreshToken": "abc123...",
  "expiresIn": 86400
}
```

### Renovar Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "abc123..."
}

→ 200 OK
{
  "accessToken": "eyJ...",
  "refreshToken": "def456...",
  "expiresIn": 86400
}
```

---

## Respuestas Estándar

### Éxito

```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 100, "page": 1, "perPage": 20, "totalPages": 5 }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descripción del error",
    "details": [{ "field": "email", "message": "required" }]
  }
}
```

### Códigos HTTP

| Código | Significado |
|--------|------------|
| 200 | OK |
| 201 | Creado |
| 400 | Error de validación |
| 401 | No autenticado |
| 403 | Sin permisos |
| 404 | No encontrado |
| 429 | Rate limit excedido |
| 500 | Error interno |

---

## Paginación

Todos los endpoints de lista aceptan:

| Param | Default | Descripción |
|-------|---------|-------------|
| `page` | 1 | Página actual |
| `limit` | 20 | Items por página (max 100) |

---

## Endpoints por Módulo

### Health

| Método | Ruta | Auth | Descripción |
|--------|------|:----:|-------------|
| GET | `/health` | No | Estado del sistema |

### Dispositivos

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/devices` | viewer | Listar dispositivos |
| POST | `/devices` | operator | Crear dispositivo |
| GET | `/devices/:id` | viewer | Obtener dispositivo |
| PATCH | `/devices/:id` | operator | Actualizar dispositivo |
| DELETE | `/devices/:id` | admin | Eliminar dispositivo |
| GET | `/devices/:id/health` | operator | Health check TCP |
| POST | `/devices/:id/test` | operator | Test de conectividad |

**Filtros GET /devices**: `?status=online&brand=hikvision&siteId=uuid&search=texto&page=1&limit=20`

### Sitios

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/sites` | viewer | Listar sitios |
| POST | `/sites` | operator | Crear sitio |
| GET | `/sites/:id` | viewer | Obtener sitio |
| PATCH | `/sites/:id` | operator | Actualizar sitio |
| DELETE | `/sites/:id` | admin | Eliminar sitio |
| GET | `/sites/:id/devices` | viewer | Dispositivos del sitio |
| GET | `/sites/:id/health` | operator | Health check del sitio |

### Eventos

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/events` | viewer | Listar eventos |
| POST | `/events` | operator | Crear evento |
| GET | `/events/:id` | viewer | Obtener evento |
| PATCH | `/events/:id/status` | operator | Cambiar estado |
| PATCH | `/events/:id/assign` | operator | Asignar a usuario |
| GET | `/events/stats` | viewer | Estadísticas |

**Filtros**: `?severity=critical&status=new&deviceId=uuid&from=date&to=date`

### Incidentes

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/incidents` | viewer | Listar incidentes |
| POST | `/incidents` | operator | Crear incidente |
| GET | `/incidents/:id` | viewer | Obtener incidente |
| PATCH | `/incidents/:id` | operator | Actualizar incidente |
| POST | `/incidents/:id/evidence` | operator | Agregar evidencia |
| POST | `/incidents/:id/comments` | operator | Agregar comentario |

### Alertas

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/alerts/rules` | viewer | Listar reglas |
| POST | `/alerts/rules` | admin | Crear regla |
| PATCH | `/alerts/rules/:id` | admin | Actualizar regla |
| DELETE | `/alerts/rules/:id` | admin | Eliminar regla |
| GET | `/alerts/instances` | viewer | Alertas activas |
| PATCH | `/alerts/instances/:id/acknowledge` | operator | Reconocer alerta |
| PATCH | `/alerts/instances/:id/resolve` | operator | Resolver alerta |
| GET | `/alerts/instances/stats` | viewer | Estadísticas |
| GET | `/alerts/escalation-policies` | viewer | Políticas de escalamiento |
| POST | `/alerts/escalation-policies` | admin | Crear política |
| GET | `/alerts/notification-channels` | viewer | Canales de notificación |
| POST | `/alerts/notification-channels` | admin | Crear canal |
| GET | `/alerts/notifications` | viewer | Historial de notificaciones |

### Intercom / VoIP

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/intercom/devices` | viewer | Listar citófonos |
| POST | `/intercom/devices` | operator | Registrar citófono |
| POST | `/intercom/door/open` | operator | Abrir puerta (relay) |
| POST | `/intercom/sessions/initiate` | operator | Iniciar llamada |
| POST | `/intercom/sessions/inbound` | system | Llamada entrante |
| PATCH | `/intercom/sessions/:id` | operator | Actualizar sesión |
| POST | `/intercom/sessions/:id/end` | operator | Finalizar llamada |
| POST | `/intercom/sessions/:id/handoff` | operator | Escalar a humano |
| GET | `/intercom/sessions/stats` | viewer | Estadísticas |
| GET | `/intercom/voip/config` | admin | Config SIP |
| PATCH | `/intercom/voip/config` | admin | Actualizar SIP |
| GET | `/intercom/voip/health` | operator | Estado SIP |
| POST | `/intercom/voip/test` | admin | Test SIP |

### WhatsApp

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/whatsapp/config` | admin | Obtener config |
| PUT | `/whatsapp/config` | admin | Guardar config |
| POST | `/whatsapp/messages` | operator | Enviar mensaje |
| POST | `/whatsapp/messages/quick-reply` | operator | Respuesta rápida |
| GET | `/whatsapp/conversations` | operator | Listar chats |
| GET | `/whatsapp/conversations/:id/messages` | operator | Historial |
| POST | `/whatsapp/conversations/handoff` | operator | Escalar |
| POST | `/whatsapp/conversations/close` | operator | Cerrar |
| GET | `/whatsapp/templates` | operator | Listar plantillas |
| POST | `/whatsapp/templates/sync` | admin | Sincronizar |
| GET/POST | `/webhooks/whatsapp` | No | Webhook Meta |

### Email

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| POST | `/email/send` | operator | Enviar email genérico |
| POST | `/email/test` | admin | Probar configuración |
| POST | `/email/event-alert` | system | Alerta de evento |
| POST | `/email/incident-report` | operator | Reporte de incidente |
| POST | `/email/periodic-report` | system | Reporte periódico |
| GET | `/email/logs` | admin | Historial de envíos |

### Voz / TTS

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| POST | `/voice/synthesize` | operator | Sintetizar texto |
| POST | `/voice/greetings/generate` | operator | Generar saludo |
| GET | `/voice/voices` | operator | Listar voces |
| GET | `/voice/config` | admin | Obtener config |
| PATCH | `/voice/config` | admin | Actualizar config |
| GET | `/voice/health` | operator | Estado del proveedor |

### eWeLink / Sonoff

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| POST | `/ewelink/login` | admin | Autenticar |
| POST | `/ewelink/logout` | admin | Cerrar sesión |
| GET | `/ewelink/devices` | operator | Listar dispositivos |
| GET | `/ewelink/devices/:id/state` | operator | Estado del dispositivo |
| POST | `/ewelink/devices/control` | operator | Controlar dispositivo |
| POST | `/ewelink/devices/batch` | operator | Control batch |
| GET | `/ewelink/health` | operator | Estado de conexión |

### IA / Asistente

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| POST | `/ai/chat` | operator | Chat con IA |
| POST | `/ai/chat/stream` | operator | Chat streaming (SSE) |
| GET | `/ai/usage` | admin | Uso de tokens |
| GET | `/ai/shift-summary` | operator | Resumen de turno |

### Control de Acceso

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/access-control/people` | viewer | Listar personas |
| POST | `/access-control/people` | operator | Crear persona |
| PATCH | `/access-control/people/:id` | operator | Actualizar persona |
| DELETE | `/access-control/people/:id` | admin | Eliminar persona |
| GET | `/access-control/vehicles` | viewer | Listar vehículos |
| POST | `/access-control/vehicles` | operator | Crear vehículo |
| GET | `/access-control/logs` | viewer | Bitácora de accesos |
| POST | `/access-control/logs` | operator | Registrar acceso |

### Visitantes

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/visitors` | viewer | Listar visitantes |
| POST | `/visitors` | operator | Crear visitante |
| GET | `/visitors/passes` | viewer | Listar pases |
| POST | `/visitors/passes` | operator | Crear pase |
| PATCH | `/visitors/passes/:id/check-in` | operator | Check-in |
| PATCH | `/visitors/passes/:id/check-out` | operator | Check-out |
| PATCH | `/visitors/passes/:id/revoke` | operator | Revocar pase |
| POST | `/visitors/validate-qr` | operator | Validar QR |
| GET | `/visitors/stats` | viewer | Estadísticas |

### Patrullas

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/patrols/routes` | viewer | Listar rutas |
| POST | `/patrols/routes` | admin | Crear ruta |
| PATCH | `/patrols/routes/:id` | admin | Actualizar ruta |
| GET | `/patrols/checkpoints/:routeId` | viewer | Checkpoints de ruta |
| POST | `/patrols/checkpoints` | admin | Crear checkpoint |
| GET | `/patrols/logs` | viewer | Registros de patrulla |
| GET | `/patrols/stats` | viewer | Estadísticas |

### Automatización

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/automation/rules` | viewer | Listar reglas |
| POST | `/automation/rules` | admin | Crear regla |
| PATCH | `/automation/rules/:id` | admin | Actualizar regla |
| DELETE | `/automation/rules/:id` | admin | Eliminar regla |
| GET | `/automation/executions` | viewer | Historial |
| GET | `/automation/stats` | viewer | Estadísticas |

### Reportes

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/reports` | viewer | Listar reportes |
| POST | `/reports` | operator | Generar reporte |
| GET | `/reports/:id/export` | viewer | Descargar reporte |

### Reportes Programados

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/scheduled-reports` | viewer | Listar programados |
| POST | `/scheduled-reports` | admin | Crear programado |
| PATCH | `/scheduled-reports/:id` | admin | Actualizar |
| DELETE | `/scheduled-reports/:id` | admin | Eliminar |

### Auditoría

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/audit` | auditor | Listar logs |

**Filtros**: `?action=create&userId=uuid&from=date&to=date&search=texto`

### Tenants

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/tenants` | admin | Listar tenants |
| POST | `/tenants` | super_admin | Crear tenant |
| PATCH | `/tenants/:id` | admin | Actualizar tenant |

### Usuarios

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/users` | admin | Listar usuarios |
| PATCH | `/users/:id` | admin | Actualizar usuario |

### Roles

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/roles/permissions` | admin | Permisos por módulo |
| PUT | `/roles/permissions` | admin | Actualizar permisos |

### Backup

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/backup/status` | admin | Estado de backups |
| POST | `/backup/trigger` | admin | Ejecutar backup |
| GET | `/backup/list` | admin | Listar backups |

### Push Notifications

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/push/vapid-public-key` | viewer | Clave VAPID |
| POST | `/push/subscribe` | viewer | Suscribir |
| POST | `/push/unsubscribe` | viewer | Desuscribir |
| POST | `/push/send` | admin | Enviar push |

### Turnos

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/shifts` | viewer | Listar turnos |
| POST | `/shifts` | admin | Crear turno |
| GET | `/shifts/assignments` | viewer | Asignaciones |
| POST | `/shifts/assignments` | admin | Asignar operador |

### SLA

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/sla/definitions` | viewer | Definiciones SLA |
| POST | `/sla/definitions` | admin | Crear definición |
| GET | `/sla/tracking` | viewer | Seguimiento |
| GET | `/sla/stats` | viewer | Estadísticas |

### Emergencias

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/emergency/protocols` | viewer | Listar protocolos |
| POST | `/emergency/protocols` | admin | Crear protocolo |
| GET | `/emergency/contacts` | viewer | Contactos |
| POST | `/emergency/contacts` | admin | Crear contacto |
| POST | `/emergency/activations` | operator | Activar protocolo |
| PATCH | `/emergency/activations/:id` | operator | Cerrar activación |

### Contratos

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/contracts` | viewer | Listar contratos |
| POST | `/contracts` | admin | Crear contrato |
| GET | `/contracts/invoices` | viewer | Listar facturas |
| POST | `/contracts/invoices` | admin | Crear factura |
| POST | `/contracts/invoices/:id/pay` | admin | Marcar pagada |

### Llaves

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/keys` | viewer | Listar llaves |
| POST | `/keys` | admin | Crear llave |
| POST | `/keys/:id/assign` | operator | Asignar |
| POST | `/keys/:id/return` | operator | Devolver |
| GET | `/keys/stats` | viewer | Estadísticas |

### Cumplimiento

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/compliance/templates` | viewer | Plantillas |
| POST | `/compliance/templates` | admin | Crear plantilla |
| GET | `/compliance/retention` | admin | Políticas retención |

### Capacitación

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/training/programs` | viewer | Programas |
| POST | `/training/programs` | admin | Crear programa |
| GET | `/training/certifications` | viewer | Certificaciones |
| POST | `/training/certifications` | admin | Registrar certificación |
| GET | `/training/certifications/expiring` | admin | Próximas a vencer |

### Domóticos

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/domotics/devices` | viewer | Listar dispositivos |
| POST | `/domotics/devices` | operator | Crear dispositivo |
| PATCH | `/domotics/devices/:id` | operator | Actualizar |
| DELETE | `/domotics/devices/:id` | admin | Eliminar |
| POST | `/domotics/devices/:id/action` | operator | Ejecutar acción |
| GET | `/domotics/devices/:id/actions` | viewer | Acciones disponibles |

### Streams

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| POST | `/streams/register` | operator | Registrar stream |
| GET | `/streams/:id/url` | viewer | Obtener URL de stream |

### Integraciones

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/integrations` | admin | Listar integraciones |
| POST | `/integrations` | admin | Crear integración |
| PATCH | `/integrations/:id` | admin | Actualizar |
| DELETE | `/integrations/:id` | admin | Eliminar |
| POST | `/integrations/:id/test` | admin | Probar conectividad |

### MCP Bridge

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/mcp/tools` | operator | Herramientas disponibles |
| GET | `/mcp/connectors` | admin | Conectores MCP |
| POST | `/mcp/execute` | operator | Ejecutar herramienta |

### Operaciones / Analytics

| Método | Ruta | Rol Mínimo | Descripción |
|--------|------|:----------:|-------------|
| GET | `/operations/dashboard` | viewer | Métricas consolidadas |
| GET | `/analytics/kpi` | viewer | KPI snapshots |

---

*Referencia API — Clave Seguridad v1.0 — Marzo 2026*
