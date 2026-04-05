# AION SECURITY PLATFORM
## Manual de Administrador — Clave Seguridad CTA

**Versión:** 2.0 | **Fecha:** Abril 2026 | **Clasificación:** Confidencial
**Plataforma:** https://aionseg.co | **Soporte:** soporte@aionseg.co

---

# PARTE I — DESCRIPCIÓN DE LA PLATAFORMA

## 1. ¿Qué es AION?

AION es una plataforma integral de gestión de seguridad electrónica diseñada específicamente para empresas de monitoreo y vigilancia en Colombia. Centraliza en un solo panel la videovigilancia, el control de acceso, la domótica, la telefonía IP, la inteligencia artificial y la automatización operativa de múltiples sedes residenciales y comerciales.

**Desarrollada para Clave Seguridad CTA**, empresa de monitoreo con sede en Medellín que administra la seguridad de conjuntos residenciales, edificios de oficinas, hospitales y hoteles en Antioquia.

## 2. Cifras actuales de la plataforma

| Componente | Cantidad |
|------------|----------|
| Sedes monitoreadas | 25 |
| Cámaras de videovigilancia | 328 |
| Dispositivos IoT (eWeLink) | 86 (sirenas, puertas, relés, luces) |
| Residentes registrados | 1,823 |
| Vehículos registrados | 971 |
| Registros biométricos | 1,410 |
| Extensiones telefónicas SIP | 81 |
| Herramientas IA (MCP Tools) | 83 |
| Reglas de automatización | 34 |
| Reglas de alerta | 5 |
| Protocolos de emergencia | 3 |
| Definiciones SLA | 3 |
| Artículos base de conocimiento | 11 |
| Skills operativos | 26 |
| Contratos activos | 2 |

## 3. Arquitectura técnica

```
┌─────────────────────────────────────────────────────────┐
│                    CAPA DE USUARIO                       │
│  Navegador Web (Chrome/Edge) → https://aionseg.co       │
│  Softphone SIP → Asterisk PBX                            │
│  Telegram Bot → @aion_monitor_bot                        │
│  WhatsApp → Twilio/Meta Cloud                            │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS / WSS / WebRTC
┌────────────────────▼────────────────────────────────────┐
│                  CAPA DE PRESENTACIÓN                     │
│  Nginx (reverse proxy, SSL, headers de seguridad)        │
│  Cloudflare (CDN, DDoS protection)                       │
│  Frontend React 18 (SPA, 22+ rutas)                      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   CAPA DE SERVICIOS                      │
│  Backend Fastify (Node.js) → 70 módulos, 44+ endpoints  │
│  n8n Automation Engine → 67 workflows planificados       │
│  go2rtc → 328 streams WebRTC/RTSP/HLS                    │
│  Asterisk PBX → 81 extensiones PJSIP                     │
│  InsightFace CPU → reconocimiento facial                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                   CAPA DE DATOS                          │
│  PostgreSQL 16 → 91 tablas, 9,400+ registros             │
│  Redis → cache, pub/sub, sesiones                        │
│  MQTT (Mosquitto) → mensajería IoT                       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                 CAPA DE INTEGRACIÓN                      │
│  Hikvision ISAPI → 7 DVR/NVR directos                    │
│  IMOU Cloud → 88 cámaras Dahua (P2P)                     │
│  eWeLink API → 86 dispositivos IoT                       │
│  OpenAI GPT → análisis IA                                │
│  Resend → email transaccional                            │
│  Twilio / Meta → WhatsApp                                │
│  Telegram Bot API                                        │
└─────────────────────────────────────────────────────────┘
```

## 4. Seguridad de la plataforma

| Medida | Implementación |
|--------|---------------|
| Cifrado en tránsito | TLS 1.2/1.3 (SSL válido hasta Jun 2026) |
| Autenticación | JWT con refresh token (rotación automática) |
| Autorización | RBAC por roles (super_admin, tenant_admin, operator, auditor) |
| Headers HTTP | HSTS, X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy, Permissions-Policy |
| Base de datos | PostgreSQL solo en localhost, sin acceso externo |
| Cache | Redis con password, solo localhost |
| Backups | pg_dump automático diario a las 3:00 AM |
| Auditoría | Todos los accesos registrados en audit_logs |
| Datos personales | Cumplimiento Ley 1581 de 2012 (habeas data) |

---

# PARTE II — MANUAL DE USUARIO ADMINISTRADOR

## 5. Acceso a la plataforma

### 5.1 Primer ingreso

1. Abrir navegador (Chrome o Edge recomendado)
2. Ir a **https://aionseg.co**
3. Ingresar credenciales:
   - Email: el asignado por el administrador
   - Password: el proporcionado
4. Clic en **"Iniciar Sesión"**

### 5.2 Roles y permisos

| Rol | Accesos | Para quién |
|-----|---------|------------|
| **super_admin** | Todo el sistema sin restricciones | Administrador principal de Clave Seguridad |
| **tenant_admin** | Gestión de sedes, usuarios, reportes, configuración | Coordinadores de zona |
| **operator** | Monitoreo, eventos, incidentes, turnos, patrullas | Operadores de la central |
| **auditor** | Solo lectura + logs de auditoría | Auditores externos, supervisores SIC |

### 5.3 Cambio de contraseña

El administrador puede cambiar contraseñas desde **Configuración → Usuarios → Editar**.

---

## 6. Panel de Control (Dashboard)

**Ruta:** `/dashboard`

El dashboard presenta un resumen ejecutivo en tiempo real de toda la operación:

### Indicadores principales:
- **Eventos últimas 24h** — total de eventos de seguridad por severidad (crítico, alto, medio, bajo)
- **Incidentes activos** — incidentes abiertos que requieren atención
- **Dispositivos** — conteo de dispositivos online vs offline
- **Alertas activas** — reglas de alerta disparadas
- **Cumplimiento SLA** — porcentaje de cumplimiento de tiempos de respuesta
- **Cumplimiento de rondas** — rondas completadas vs programadas
- **Asistencia de turnos** — operadores que marcaron asistencia

### Acciones desde el dashboard:
- Clic en cualquier indicador para ir al módulo detallado
- Los datos se actualizan automáticamente cada 30 segundos
- Los gráficos muestran tendencias de 7 y 30 días

---

## 7. Videovigilancia

### 7.1 Vista en Vivo (`/live`)

Muestra las 328 cámaras organizadas por sede en una grilla configurable.

**Funciones:**
- **Grid 2x2, 3x3, 4x4:** Seleccionar cuántas cámaras ver simultáneamente
- **Filtro por sede:** Seleccionar una sede para ver solo sus cámaras
- **Pantalla completa:** Doble clic en cualquier cámara
- **PTZ:** Para cámaras con pan-tilt-zoom, aparecen controles direccionales
- **Snapshot:** Capturar imagen estática de la cámara

**Tecnología:** WebRTC vía go2rtc — latencia inferior a 1 segundo.

**Capacidad confirmada:** 12 operadores simultáneos, cada uno con grid 4x4 (16 cámaras).

### 7.2 Cámaras por sede (`/cameras`)

Lista completa de las 328 cámaras con:
- Nombre de la cámara
- Sede asignada
- Estado (online/offline)
- Marca (Hikvision/Dahua)
- Canal
- Última actividad

### 7.3 Distribución por sede

| Sede | Cámaras | Marca |
|------|---------|-------|
| Altagracia | 33 | Hikvision |
| Los Pisquines P.H. | 32 | Hikvision |
| Torre Lucia | 24 | Hikvision |
| Propiedad Terrabamba | 21 | Dahua/IMOU |
| Portalegre | 20 | Hikvision |
| Alborada 9-10 | 19 | Dahua/IMOU |
| Brescia | 17 | Dahua/IMOU |
| San Nicolás | 17 | Hikvision |
| Terrazzino | 18 | Dahua/IMOU |
| San Sebastián | 16 | Hikvision |
| Hospital San Jerónimo | 16 | Dahua/IMOU |
| Edificio La Palencia | 16 | Dahua/IMOU |
| Altos del Rosario | 16 | Dahua/IMOU |
| Patio Bonito | 12 | Dahua/IMOU |
| Senderos de Calasanz | 12 | Hikvision |
| Danubios | 9 | Dahua/IMOU |
| Quintas de Santa María | 8 | Dahua/IMOU |
| Santa Ana de los Caballeros | 7 | Dahua/IMOU |

---

## 8. Eventos y Alertas

### 8.1 Eventos (`/events`)

Registro centralizado de todos los eventos de seguridad de todas las sedes.

**Campos:**
- Tipo de evento (movimiento, intrusión, sabotaje, acceso, sistema)
- Severidad (critical, high, medium, low, info)
- Sede y dispositivo de origen
- Fecha y hora
- Estado (new, acknowledged, resolved, dismissed)

**Acciones:**
- **Reconocer:** Marcar que el operador vio el evento
- **Resolver:** Marcar como resuelto con nota
- **Descartar:** Marcar como falsa alarma
- **Filtrar:** Por sede, severidad, tipo, fecha
- **Búsqueda:** Texto libre en título y descripción

### 8.2 Alertas (`/alerts`)

Reglas automáticas que generan notificaciones cuando se cumplen condiciones.

**Reglas configuradas:**

| Regla | Descripción |
|-------|-------------|
| Movimiento en zona restringida | Detecta movimiento fuera de horario en zonas sensibles |
| Manipulación de cámara | Alerta cuando una cámara es tapada o movida |
| Puerta forzada | Sensor de puerta abierta sin autorización |
| Evento crítico sin resolver > 30 min | Escala eventos críticos no atendidos |
| Dispositivo offline > 10 min | Alerta cuando un dispositivo pierde conexión |

### 8.3 Incidentes (`/incidents`)

Gestión completa del ciclo de vida de incidentes de seguridad.

**Estados:** Abierto → En progreso → Resuelto → Cerrado

**Cada incidente incluye:**
- Título y descripción
- Prioridad (critical, high, medium, low)
- Sede afectada
- Línea de tiempo con comentarios
- Eventos relacionados
- Operador asignado
- Tiempo de respuesta vs SLA

---

## 9. Control de Acceso

### 9.1 Residentes (`/residents`)

Base de datos de 1,823 residentes con:
- Nombre completo
- Documento de identidad
- Torre y apartamento
- Teléfono de contacto
- Estado (activo/inactivo)
- Sede

**Búsqueda:** Por nombre, documento, apartamento o teléfono.

### 9.2 Vehículos (`/vehicles`)

971 vehículos registrados con:
- Placa
- Marca y modelo
- Color
- Propietario (vinculado a residente)
- Torre y apartamento
- Estado

**Búsqueda:** Por placa (parcial o completa), marca, o propietario.

### 9.3 Registros biométricos

1,410 registros biométricos vinculados a residentes para verificación de identidad.

### 9.4 Visitantes (`/visitors`)

Registro de visitantes con:
- Nombre y documento
- A quién visita
- Propósito de la visita
- Hora de entrada y salida
- Foto (opcional)
- Pre-registro (para visitantes esperados)

### 9.5 Consignas

Instrucciones especiales por unidad/apartamento. Ejemplos reales:
- "NATALIA ANDREA HIGUITA" — Apto 202
- "CAMILO RODRIGUEZ" — Apto 301
- "GUSTAVO CARDONA AUTORIZADO PARA HACER REMODELACIONES" — Apto 301

Las consignas aparecen automáticamente cuando el guardia busca el apartamento.

---

## 10. Domótica (`/domotics`)

Control de 86 dispositivos IoT eWeLink distribuidos en las sedes:

**Tipos de dispositivos:**
- **Sirenas:** Activación manual o automática por protocolo de emergencia
- **Puertas:** Apertura remota de puertas peatonales y vehiculares
- **Relés:** Control de iluminación y equipos
- **Luces:** Encendido/apagado programable
- **Cerraduras:** Control de cerraduras eléctricas

**Acciones desde la plataforma:**
- Toggle ON/OFF para cualquier dispositivo
- Activar sirena por duración (ej: 10 segundos)
- Pulse de puerta (abrir 3 segundos y cerrar automáticamente)
- Ver estado online/offline en tiempo real
- Historial de activaciones

---

## 11. Operaciones

### 11.1 Turnos (`/shifts`)

Gestión de turnos de operadores con:
- 3 turnos: Diurno (06:00-14:00), Vespertino (14:00-22:00), Nocturno (22:00-06:00)
- Asignación de operadores por turno y sede
- Control de asistencia
- Minuta automática al cambio de turno

### 11.2 Rondas/Patrullas (`/patrols`)

2 rutas de patrullaje configuradas con checkpoints.

**Flujo:**
1. Operador inicia ronda desde la app
2. Escanea código QR en cada checkpoint
3. Sistema registra hora y ubicación
4. Si omite un checkpoint → alerta automática
5. Al finalizar → reporte de cumplimiento

### 11.3 Automatización (`/automation`)

34 reglas de automatización configuradas:

**Emergencias:**
- Emergencia Incendio — activar sirenas + evacuación
- Emergencia Médica — notificar sin sirena
- Emergencia Lockdown — cerrar todas las puertas

**Operativas:**
- Auto-reconocer eventos informativos
- Modo normal diurno (06:00) / Modo asistido nocturno (22:00)
- Minuta automática al cambio de turno
- Reporte diario de accesos por sede

**Seguridad:**
- LPR placa desconocida → alerta
- Rostro no reconocido → alerta
- Escalar críticos sin atención > 15 min
- Cámara imagen oscura o tapada
- Dispositivo sin recuperar post-reinicio

**Compliance:**
- Reporte trimestral SIC Ley 1581
- Certificación próxima a vencer
- Contrato próximo a vencer
- Llave no devuelta > 24h

**Visitantes:**
- Verificación completa de visitante MCP
- Visitante check-in QR automático
- Visitante recurrente > 3/semana

---

## 12. Asistente de Inteligencia Artificial (`/ai-assistant`)

### 12.1 Capacidades

El asistente IA puede ejecutar **83 herramientas** divididas en categorías:

**Consultas (lectura):**
- Buscar residentes y vehículos por nombre, placa o documento
- Consultar estado de cualquier sede, dispositivo o cámara
- Ver eventos, incidentes, alertas activas
- Obtener resumen del dashboard
- Consultar turno actual y cumplimiento de rondas
- Ver contratos, llaves, certificaciones
- Buscar en la base de conocimiento

**Acciones (escritura):**
- Crear incidentes
- Abrir/cerrar puertas (eWeLink y Hikvision)
- Activar/desactivar sirenas
- Encender/apagar dispositivos
- Controlar PTZ de cámaras
- Reiniciar dispositivos remotamente
- Enviar alertas por email, WhatsApp, Telegram
- Registrar visitantes
- Asignar y devolver llaves
- Activar protocolos de emergencia

**Análisis:**
- Generar resumen de incidentes con IA
- Generar resumen de turno
- Detectar anomalías
- Calcular KPIs y analytics

### 12.2 Ejemplos de uso

```
Operador:  "¿Cuántas cámaras hay en Torre Lucia?"
IA:        Ejecuta list_cameras con filtro por sede → "Torre Lucia tiene 24 cámaras, todas online."

Operador:  "Busca al residente LÓPEZ del apto 301"
IA:        Ejecuta search_people → muestra datos del residente

Operador:  "Abre la puerta de la sede Brescia"
IA:        Ejecuta open_ewelink_door → "Puerta de Brescia abierta por 3 segundos."

Operador:  "Crea un incidente: intrusión detectada en San Nicolás"
IA:        Ejecuta create_incident → incidente creado con prioridad crítica
```

---

## 13. Intercomunicación (`/intercom`)

28 dispositivos de intercomunicación configurados para comunicación bidireccional entre la central y las sedes.

**Extensiones de la central (Asterisk PBX):**
- 099: Central AION (línea principal)
- 100-102: Operadores de monitoreo
- 103-104: Supervisores
- 105-106: Coordinadores de zona
- 107: Administradora
- 108-109: Técnicos
- 110: Gerencia
- 111: Emergencias
- 112: Puesto Móvil
- 200-220: Recepción/portería de cada sede
- 300-301: Intercomunicación Torre Lucia (peatonal/vehicular)
- 400-441: Puestos de guardia (2 por sede)

**Para marcar desde la central:**
- Marcar extensión de la sede (ej: 200 para Torre Lucia)
- El teléfono de portería suena
- Comunicación bidireccional completa

---

## 14. Datos Operativos

### 14.1 Administradores de sede (`/operational-data`)

37 administradores de sede registrados con contacto para cada conjunto residencial.

### 14.2 Inventario de puertas

36 puertas documentadas con tipo (peatonal, vehicular, emergencia), estado del sensor y última revisión.

### 14.3 Información de ascensores

10 ascensores con datos de capacidad, última revisión y empresa de mantenimiento.

### 14.4 Pruebas de sirena

15 pruebas de sirena registradas con fecha, resultado y operador.

### 14.5 Reinicios de equipo

10 reinicios programados y ejecutados de DVRs y switches.

### 14.6 Horarios de guardia

17 horarios de guardia por sede con turno, operador asignado y días de la semana.

---

## 15. Cumplimiento y Legal

### 15.1 Plantillas de cumplimiento

| Plantilla | Uso |
|-----------|-----|
| Autorización Habeas Data (Ley 1581 de 2012) | Formato de autorización para tratamiento de datos personales |
| Auditoría Mensual de Seguridad | Checklist de verificación mensual de todos los sistemas |
| Revisión de Incidentes de Seguridad | Formato para análisis post-incidente |

### 15.2 Protocolos de emergencia

| Protocolo | Prioridad | Acciones |
|-----------|-----------|----------|
| Protocolo de Incendio | 1 (máxima) | Sirenas + evacuación + bomberos |
| Protocolo de Emergencia Médica | 2 | Notificar sin sirena + línea 123 |
| Protocolo de Brecha de Seguridad | 1 (máxima) | Lockdown + cerrar puertas + policía |

### 15.3 SLA (Acuerdos de Nivel de Servicio)

| SLA | Tiempo de respuesta | Tiempo de resolución |
|-----|--------------------|--------------------|
| Respuesta a eventos críticos | 5 minutos | 60 minutos |
| Resolución de incidentes | 15 minutos | 120 minutos |
| Disponibilidad de dispositivos | 30 minutos | 240 minutos |

---

## 16. Reportes y Análisis (`/reports`, `/analytics`)

**Tipos de reportes disponibles:**
- Reporte diario de eventos por sede
- Reporte semanal de incidentes
- Reporte mensual de cumplimiento SLA
- Reporte de acceso por sede
- Reporte trimestral SIC Ley 1581
- Reporte de rondas y patrullas
- Reporte de disponibilidad de dispositivos
- Reporte de uso del asistente IA

**Analytics incluye:**
- Eventos por severidad (gráfico de barras)
- Tendencia de incidentes (línea temporal)
- Mapa de calor por hora del día
- Distribución por sede
- KPIs: MTTA (tiempo medio de reconocimiento), MTTR (tiempo medio de resolución)

---

## 17. Base de Conocimiento (`/knowledge-base`)

11 artículos organizados por categoría:

**SOPs (Procedimientos Operativos Estándar):**
- Protocolo de apertura de puerta
- Protocolo de emergencia — incendio
- Protocolo de ronda de vigilancia
- Protocolo de entrega de turno
- Control de acceso vehicular
- Activación de sirena

**Manuales de dispositivos:**
- Hikvision DVR — Reinicio remoto
- Dahua XVR — Acceso por serial

**Patrones del sistema:**
- Dispositivo offline frecuente
- Pico de eventos en horario nocturno

---

## 18. Gestión de Contratos (`/contracts`)

2 contratos activos:

| Cliente | Estado |
|---------|--------|
| Conjunto Residencial Torre Lucia P.H. | Activo |
| Edificio San Nicolás Oficinas | Activo |

Cada contrato incluye: vigencia, valor mensual, servicios incluidos, contacto del cliente.

---

## 19. Administración del Sistema

### 19.1 Usuarios (`/admin`)

Gestión de usuarios con:
- Crear, editar, desactivar usuarios
- Asignar roles (super_admin, tenant_admin, operator, auditor)
- Reset de contraseña
- Ver último acceso

### 19.2 Feature Flags

10 módulos con control de activación individual:

| Módulo | Estado |
|--------|--------|
| AI Assistant | Activo |
| Access Control | Activo |
| Domotic Control | Activo |
| Email Notifications | Activo |
| Live View | Activo |
| MCP Connectors | Activo |
| Reports | Activo |
| Video Playback | Activo |
| Voice Intercom | Activo |
| WhatsApp Notifications | Activo |

### 19.3 Logs de Auditoría (`/audit`)

Registro completo de todas las acciones realizadas en el sistema:
- Quién hizo qué, cuándo y desde dónde
- Filtrable por usuario, acción, módulo y fecha
- Exportable para auditorías externas
- 426+ registros de auditoría

---

# PARTE III — FASES DE DESARROLLO Y TESTING

## 20. Estado actual: v2.0 (Abril 2026)

### Fase 1: Fundación (Completada — Ene-Feb 2026)

| Componente | Estado |
|------------|--------|
| Backend API (Fastify, 70 módulos) | ✅ Completado |
| Frontend React (22+ rutas) | ✅ Completado |
| Auth JWT con refresh tokens | ✅ Completado |
| PostgreSQL (91 tablas) | ✅ Completado |
| Redis cache + pub/sub | ✅ Completado |
| Migración de datos (residentes, vehículos, biométricos) | ✅ Completado |
| Despliegue AWS (VPS t3.xlarge) | ✅ Completado |
| SSL/TLS + Cloudflare | ✅ Completado |

### Fase 2: Videovigilancia (Completada — Feb-Mar 2026)

| Componente | Estado |
|------------|--------|
| go2rtc (328 streams WebRTC) | ✅ Completado |
| Hikvision ISAPI (7 DVR directos) | ✅ Completado |
| IMOU Cloud P2P (88 cámaras Dahua) | ✅ Completado |
| Vista en vivo multi-grid | ✅ Completado |
| Snapshot de cámaras | ✅ Completado |
| Control PTZ | ✅ Completado |

### Fase 3: IoT + Domótica (Completada — Mar 2026)

| Componente | Estado |
|------------|--------|
| eWeLink API (86 dispositivos) | ✅ Completado |
| Control de sirenas con temporización | ✅ Completado |
| Apertura de puertas (pulso 3s) | ✅ Completado |
| Control de relés e iluminación | ✅ Completado |

### Fase 4: Inteligencia Artificial (Completada — Mar 2026)

| Componente | Estado |
|------------|--------|
| 83 MCP Tools | ✅ Completado |
| Asistente IA con acceso a toda la plataforma | ✅ Completado |
| Generación de resúmenes con IA | ✅ Completado |
| Detección de anomalías | ✅ Completado |

### Fase 5: Automatización + PBX (Completada — Mar-Abr 2026)

| Componente | Estado |
|------------|--------|
| 34 reglas de automatización | ✅ Completado |
| Asterisk PBX (81 extensiones) | ✅ Completado |
| n8n engine (corriendo, listo para workflows) | ✅ Completado |
| 9 webhooks n8n funcionales | ✅ Completado |
| Reconocimiento facial (InsightFace) | ✅ Completado |
| 6 security headers HTTP | ✅ Completado |

---

## 21. Plan de pruebas (Testing)

### 21.1 Pruebas de infraestructura

| Test | Método | Resultado esperado | Frecuencia |
|------|--------|-------------------|------------|
| Health check API | `GET /health/ready` | HTTP 200, status: ok | Cada 2 min (automático) |
| Conectividad PostgreSQL | Query `SELECT 1` | Respuesta < 10ms | Cada 5 min |
| Redis ping | `redis-cli ping` | PONG | Cada 5 min |
| go2rtc streams | `GET /api/streams` | 328 streams registrados | Cada 10 min |
| Certificado SSL | openssl s_client | Válido, no expirado | Diario |
| Espacio en disco | `df -h` | > 20% libre | Diario |
| RAM disponible | `free -h` | > 2GB disponible | Cada 5 min |
| PM2 procesos | `pm2 list` | 5/5 online, 0 restarts | Cada 5 min |

### 21.2 Pruebas de endpoints

| Grupo | Endpoints | Método de prueba |
|-------|-----------|-----------------|
| Autenticación | login, me, refresh | POST + validar JWT |
| Cámaras | cameras, cameras/by-site | GET + verificar count = 328 |
| Eventos | events, events con filtros | GET + crear + reconocer |
| Incidentes | incidents CRUD | Crear, actualizar, cerrar |
| Dispositivos | devices, domotics | GET + toggle device |
| Operacional | residents, vehicles, consignas | GET + búsqueda |
| IA | ai/chat, mcp/tools | POST mensaje + verificar tools = 83 |
| Webhooks n8n | 9 endpoints | POST con test payload |
| Auditoría | audit/logs | GET con super_admin |

### 21.3 Pruebas de video

| Test | Procedimiento | Resultado esperado |
|------|--------------|-------------------|
| WebRTC stream | Abrir vista en vivo, seleccionar cámara | Video < 1s latencia |
| Multi-grid | Abrir grid 4x4 | 16 cámaras simultáneas sin freeze |
| Cambio de sede | Filtrar por sede | Solo cámaras de esa sede |
| PTZ | Enviar comando dirección | Cámara se mueve |
| Multi-usuario | 12 operadores simultáneos | Sin degradación |

### 21.4 Pruebas de seguridad

| Test | Procedimiento | Resultado esperado |
|------|--------------|-------------------|
| SQL injection | Enviar `'; DROP TABLE--` en búsqueda | Error controlado, no inyección |
| XSS | Enviar `<script>alert(1)</script>` | Escape correcto |
| Auth bypass | Request sin JWT | HTTP 401 |
| Role bypass | Operador intenta acceder a /audit | HTTP 403 |
| Rate limiting | 100+ requests/segundo | Rate limit activo |
| Headers | Verificar 6 security headers | Todos presentes |

### 21.5 Pruebas de rendimiento

| Métrica | Valor medido | Aceptable |
|---------|-------------|-----------|
| Login rate | 900 req/seg | > 100 |
| API throughput | 12-48 req/seg/endpoint | > 10 |
| WebRTC conexión | < 2 segundos | < 5 |
| Dashboard carga | < 3 segundos | < 5 |
| Búsqueda residente | < 500ms | < 2000ms |
| Usuarios simultáneos | 12 operadores | >= 12 |
| RAM bajo carga | ~400MB | < 2GB |

---

## 22. Procedimiento de pruebas para nuevos despliegues

### Pre-despliegue:
1. Crear backup: `pg_dump -U postgres aionseg_prod | gzip > backup-pre-deploy.sql.gz`
2. Verificar estado actual: `pm2 list`, `curl localhost:3001/health/ready`

### Post-despliegue:
1. Verificar health: `curl localhost:3001/health/ready`
2. Verificar login: `curl -X POST localhost:3001/auth/login ...`
3. Verificar cámaras: `curl localhost:1984/api/streams | python3 -c "import sys,json; print(len(json.load(sys.stdin)))"`
4. Verificar MCP tools: `curl localhost:3001/mcp/tools | python3 -c "..."`
5. Abrir frontend: `https://aionseg.co` → verificar carga
6. Probar vista en vivo: abrir una cámara
7. Probar búsqueda: buscar un residente
8. Verificar logs: `pm2 logs aionseg-api --lines 20`

---

# PARTE IV — ROADMAP: PRÓXIMOS 2 MESES (Abril-Mayo 2026)

## 23. Mes 1 (Abril 2026): Automatización + Notificaciones

### Semana 1-2: Workflows n8n fundamentales

| # | Workflow | Prioridad |
|---|----------|-----------|
| 1 | Health Monitor (cada 2 min) | Crítica |
| 2 | Device Monitor (cada 5 min) | Crítica |
| 3 | Daily Report (7 AM) | Alta |
| 4 | Incident Auto-Classify | Alta |
| 5 | Camera Offline Alert | Alta |
| 6 | Shift Change Summary | Media |
| 7 | Visitor Pre-register Notification | Media |
| 8 | Escalation Timer (> 30 min) | Alta |
| 9 | Patrol Compliance Check | Media |
| 10 | Equipment Restart Monitor | Media |

### Semana 2-3: Telegram + WhatsApp

| Entregable | Descripción |
|-----------|-------------|
| Bot de Telegram | Comandos: /estado, /buscar, /incidente, /camaras |
| WhatsApp Sandbox | Alertas de seguridad + notificaciones de visitantes |
| Notificaciones push | Alertas críticas al navegador del operador |

### Semana 3-4: Protocolos de emergencia automatizados

| Protocolo | Automatización |
|-----------|---------------|
| Incendio | Trigger → activar sirenas → crear incidente → notificar bomberos → enviar Telegram |
| Intrusión | Trigger → lockdown puertas → snapshot cámaras → crear incidente → alertar policía |
| Médica | Trigger → crear incidente → notificar 123 → enviar WhatsApp administrador |
| Falla eléctrica | Trigger → verificar UPS → alertar técnico → registro de evento |

**Resultado al final del Mes 1:**
- 20+ workflows n8n activos
- Notificaciones Telegram + WhatsApp funcionando
- Protocolos de emergencia automatizados de punta a punta
- Monitoreo proactivo 24/7 (sin necesidad de estar mirando la pantalla)

---

## 24. Mes 2 (Mayo 2026): Expansion + Enterprise

### Semana 5-6: Telefonía y acceso físico

| Entregable | Descripción |
|-----------|-------------|
| 5 teléfonos Fanvil (central) | Extensiones 099-102, 107 conectadas a Asterisk |
| Softphone operadores | App en celular con extensiones 103-112 |
| IVR completo | Llamada entrante → menú de opciones → transferir a sede |
| HikConnect Cloud | Acceso cloud a las 5 sedes Hikvision restantes |

### Semana 6-7: LPR + QR Visitors

| Entregable | Descripción |
|-----------|-------------|
| LPR auto-gate | Placa reconocida por cámara → verificar en DB → abrir puerta automáticamente |
| Visitor QR flow | Pre-registro → QR generado → guardia escanea → check-in automático |
| Face recognition alerts | Rostro no reconocido en zona restringida → alerta |

### Semana 7-8: Reportes avanzados + compliance

| Entregable | Descripción |
|-----------|-------------|
| Reportes programados | Envío automático diario/semanal/mensual por email |
| Dashboard nocturno | Pantalla de monitoreo optimizada para turno noche |
| Reporte para copropiedad | PDF automático para la asamblea del conjunto |
| Registro SIC RNBD | 5 bases de datos registradas ante la SIC |
| Política de datos | Publicada en aionseg.co/politica-datos |

**Resultado al final del Mes 2:**
- 50+ workflows n8n activos
- Telefonía IP operativa (central + sedes principales)
- LPR auto-gate en al menos 2 sedes
- Visitor QR flow completo
- Compliance Ley 1581 completo
- Reportes automáticos para copropiedades

---

# PARTE V — CAPACIDADES DE EXPANSIÓN

## 25. Escalabilidad técnica

### 25.1 Capacidad actual vs máxima

| Recurso | Actual | Máximo en VPS actual | Con upgrade |
|---------|--------|---------------------|-------------|
| Cámaras | 328 | ~500 | ~2,000 (cluster) |
| Dispositivos IoT | 86 | ~200 | ~1,000 |
| Sedes | 25 | ~50 | ~200 |
| Operadores simultáneos | 12 | ~20 | ~100 |
| Extensiones PBX | 81 | ~200 | ~500 |
| Registros DB | 9,400 | ~100,000 | ~10,000,000 |

### 25.2 Cómo escalar

**Nivel 1 — Más sedes (sin cambiar infraestructura):**
1. Agregar cámaras al go2rtc.yaml
2. Sincronizar con la DB
3. Agregar dispositivos eWeLink
4. Crear extensiones Asterisk
5. **Costo adicional:** $0 (dentro de la capacidad actual)

**Nivel 2 — Más capacidad (upgrade VPS):**
1. Cambiar a instancia t3.2xlarge (8 CPU, 32GB RAM)
2. Agregar disco SSD (500GB → 1TB)
3. **Costo adicional:** ~$80/mes

**Nivel 3 — Multi-tenant (múltiples empresas):**
1. Activar funcionalidad multi-tenant (ya diseñada en la DB con tenant_id)
2. Cada empresa de seguridad tiene su propio espacio aislado
3. Dashboard de super-admin para gestionar todos los tenants
4. **Costo adicional:** desarrollo + infra ~$200/mes

**Nivel 4 — Cluster (alta disponibilidad):**
1. Load balancer + múltiples instancias de API
2. PostgreSQL con réplica read-only
3. Redis Cluster
4. go2rtc distribuido por región
5. **Costo adicional:** ~$500/mes

### 25.3 Nuevas integraciones planificadas

| Integración | Complejidad | Beneficio |
|-------------|-------------|-----------|
| **ZKTeco** (biométricos) | Media | Lectores de huella/facial en cada sede |
| **VPN WireGuard** por sede | Baja | Acceso directo a la LAN de cada sede |
| **Google Coral TPU** | Media | Detección de objetos en edge (armas, paquetes abandonados) |
| **Dahua Smart PSS** | Alta | Control centralizado de cámaras Dahua sin IMOU |
| **Genetec / Milestone** | Alta | Integración con VMS enterprise |
| **Central de alarmas AJAX** | Media | Sensores inalámbricos (humo, movimiento, inundación) |
| **Control de ascensores** | Alta | Restricción de pisos por residente |
| **Aplicación móvil nativa** | Alta | App para guardias con GPS, chat, reportes |

### 25.4 Cómo completar la expansión

**Para agregar una nueva sede completa:**

```
1. INFRAESTRUCTURA (1 día por sede)
   ├── Instalar DVR/NVR Hikvision o Dahua
   ├── Configurar cámaras IP
   ├── Instalar dispositivos eWeLink (sirena, puerta, relé)
   ├── Configurar acceso RTSP (port forward o HikConnect)
   └── Instalar intercomunicador SIP

2. PLATAFORMA (30 minutos por sede)
   ├── Crear sede en AION (POST /sites)
   ├── Agregar cámaras (POST /cameras + go2rtc.yaml)
   ├── Vincular dispositivos eWeLink
   ├── Crear extensión Asterisk
   ├── Importar residentes y vehículos
   └── Configurar consignas

3. OPERACIÓN (1 hora)
   ├── Capacitar al guardia de la sede
   ├── Verificar video en vivo
   ├── Probar apertura de puerta remota
   ├── Probar sirena
   └── Configurar ronda de patrullaje
```

---

## 26. Proyección a 6 meses (Octubre 2026)

| Métrica | Actual (Abr) | 2 meses (Jun) | 6 meses (Oct) |
|---------|-------------|---------------|---------------|
| Sedes | 25 | 30 | 50 |
| Cámaras | 328 | 400 | 700 |
| Dispositivos IoT | 86 | 120 | 200 |
| Residentes | 1,823 | 2,500 | 5,000 |
| Vehículos | 971 | 1,300 | 2,500 |
| Operadores | 3 | 5 | 10 |
| Workflows n8n | 0 | 50 | 67 |
| Contratos | 2 | 5 | 12 |
| Revenue mensual | - | - | Objetivo: $15M COP |

---

## 27. Soporte y contacto

| Canal | Detalle |
|-------|---------|
| Plataforma web | https://aionseg.co |
| Email soporte | soporte@aionseg.co |
| Teléfono central | Extensión 099 (Central AION) |
| Bot Telegram | @aion_monitor_bot (en configuración) |
| Documentación técnica | Este manual |
| Logs de auditoría | https://aionseg.co/audit |

---

*Este manual es confidencial y propiedad de Clave Seguridad CTA. Su distribución no autorizada está prohibida.*

*Generado automáticamente por AION Platform v2.0 — Abril 2026*
