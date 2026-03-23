# Clave Seguridad — Manual de Administrador

> Guía completa para administradores de plataforma y tenant
> Versión 1.0 — Marzo 2026

---

## Tabla de Contenidos

1. [Roles y Responsabilidades](#1-roles-y-responsabilidades)
2. [Gestión de Usuarios](#2-gestión-de-usuarios)
3. [Permisos por Módulo](#3-permisos-por-módulo)
4. [Configuración del Tenant](#4-configuración-del-tenant)
5. [Configuración de Seguridad](#5-configuración-de-seguridad)
6. [Configuración de Notificaciones](#6-configuración-de-notificaciones)
7. [Configuración de IA](#7-configuración-de-ia)
8. [Feature Flags](#8-feature-flags)
9. [Retención de Datos](#9-retención-de-datos)
10. [Gestión de Sitios](#10-gestión-de-sitios)
11. [Gestión de Dispositivos](#11-gestión-de-dispositivos)
12. [Configuración de Alertas y Escalamiento](#12-configuración-de-alertas-y-escalamiento)
13. [Configuración de WhatsApp](#13-configuración-de-whatsapp)
14. [Configuración de Email](#14-configuración-de-email)
15. [Configuración de Citofonía/VoIP](#15-configuración-de-citofoníavoip)
16. [Configuración de Domótica](#16-configuración-de-domótica)
17. [Gestión de Contratos](#17-gestión-de-contratos)
18. [Gestión de Llaves](#18-gestión-de-llaves)
19. [Cumplimiento Normativo](#19-cumplimiento-normativo)
20. [Capacitación y Certificaciones](#20-capacitación-y-certificaciones)
21. [Integraciones y MCP](#21-integraciones-y-mcp)
22. [Auditoría](#22-auditoría)
23. [Salud del Sistema](#23-salud-del-sistema)
24. [Backups](#24-backups)
25. [Reportes Programados](#25-reportes-programados)
26. [Turnos y SLA](#26-turnos-y-sla)
27. [Protocolos de Emergencia](#27-protocolos-de-emergencia)
28. [Automatización](#28-automatización)

---

## 1. Roles y Responsabilidades

### Roles del Sistema

| Rol | Alcance | Puede |
|-----|---------|-------|
| `super_admin` | Plataforma completa | Todo: gestionar tenants, usuarios globales, configuración de plataforma |
| `tenant_admin` | Su tenant | Gestionar usuarios, configuración, dispositivos, integraciones del tenant |
| `operator` | Operaciones diarias | Eventos, incidentes, dispositivos, vista en vivo, control de acceso |
| `viewer` | Solo lectura | Ver dashboards, eventos, dispositivos (sin modificar) |
| `auditor` | Auditoría y reportes | Auditoría, reportes, cumplimiento |

### ¿Quién puede hacer qué?

| Acción | super_admin | tenant_admin | operator | viewer | auditor |
|--------|:-----------:|:------------:|:--------:|:------:|:-------:|
| Crear usuarios | Si | Si | No | No | No |
| Cambiar roles | Si | Si | No | No | No |
| Configurar tenant | Si | Si | No | No | No |
| Agregar dispositivos | Si | Si | Si | No | No |
| Gestionar eventos | Si | Si | Si | No | No |
| Ver dashboard | Si | Si | Si | Si | Si |
| Ver auditoría | Si | Si | No | No | Si |
| Configurar alertas | Si | Si | No | No | No |
| Configurar integraciones | Si | Si | No | No | No |
| Ver reportes | Si | Si | Si | Si | Si |

---

## 2. Gestión de Usuarios

### Acceder

**Administración** en la barra lateral (requiere rol admin).

### Invitar Nuevo Usuario

1. Clic en **Invitar Usuario**
2. Llenar:
   - **Correo Electrónico**: Email del nuevo usuario
   - **Nombre Completo**: Nombre para el perfil
   - **Rol**: Seleccionar rol apropiado
3. Clic en **Crear y Generar Credenciales**
4. El sistema genera:
   - Contraseña temporal (copiar y compartir de forma segura)
   - Enlace de activación
5. Compartir credenciales con el usuario por canal seguro

### Cambiar Rol de Usuario

1. En la tabla de usuarios, localizar al usuario
2. En la columna **Rol**, abrir el dropdown
3. Seleccionar el nuevo rol
4. El cambio se aplica inmediatamente

### Activar/Desactivar Usuario

1. En la columna de estado, usar el toggle
2. Un usuario desactivado no puede iniciar sesión
3. Sus datos y auditoría se preservan

### Buscar Usuarios

Usar el campo de búsqueda para filtrar por nombre.

---

## 3. Permisos por Módulo

### Acceder

**Administración → Pestaña "Permisos por Módulo"**

### Configurar Permisos

La tabla muestra una matriz de roles × módulos:

| Módulo | super_admin | tenant_admin | operator | viewer | auditor |
|--------|:-----------:|:------------:|:--------:|:------:|:-------:|
| Dashboard | Fijo | Fijo | Editable | Editable | Editable |
| Vista en Vivo | Fijo | Fijo | Editable | Editable | Editable |
| Dispositivos | Fijo | Fijo | Editable | Editable | Editable |
| ... | ... | ... | ... | ... | ... |

- **Fijo** (candado): Los roles admin siempre tienen acceso
- **Editable** (checkbox): Habilitar/deshabilitar por módulo

### Guardar Permisos

1. Marcar/desmarcar los módulos deseados para cada rol
2. Clic en **Guardar Cambios**

### Restaurar por Defecto

Clic en **Restaurar Valores por Defecto** para volver a la configuración original.

### Módulos Disponibles

| Módulo | Clave | Descripción |
|--------|-------|-------------|
| Panel Principal | dashboard | Dashboard operativo |
| Vista en Vivo | live_view | Monitoreo de cámaras |
| Reproducción | playback | Reproducción de grabaciones |
| Eventos | events | Eventos de seguridad |
| Alertas | alerts | Reglas y alertas |
| Incidentes | incidents | Gestión de incidentes |
| Dispositivos | devices | Inventario de equipos |
| Sitios | sites | Ubicaciones |
| Domóticos | domotics | Dispositivos IoT |
| Control de Acceso | access_control | Personas, vehículos, bitácora |
| Reinicios | reboots | Reinicio de dispositivos |
| Citofonía | intercom | VoIP e intercomunicación |
| Base de Datos | database | Registros operativos |
| Asistente IA | ai_assistant | Chat con IA |
| Integraciones | integrations | Servicios externos |
| Reportes | reports | Reportes y analíticas |
| Auditoría | audit | Trail de auditoría |
| Salud del Sistema | system | Monitoreo de infraestructura |
| Configuración | settings | Ajustes del tenant |
| Administración | admin | Gestión de usuarios |
| WhatsApp | integrations | Mensajería WhatsApp |
| Turnos | shifts | Gestión de turnos |
| SLA | sla | Acuerdos de servicio |
| Emergencias | emergency | Protocolos de emergencia |
| Patrullas | patrols | Rutas de patrulla |
| Reportes Programados | scheduled_reports | Reportes automáticos |
| Automatización | automation | Reglas de automatización |
| Visitantes | visitors | Gestión de visitantes |
| Analíticas | analytics | Dashboard analítico |
| Contratos | contracts | Gestión de contratos |
| Llaves | keys | Inventario de llaves |
| Cumplimiento | compliance | Normatividad |
| Capacitación | training | Programas de formación |

---

## 4. Configuración del Tenant

### Acceder

**Configuración → General**

### Campos

| Campo | Descripción |
|-------|-------------|
| Nombre de la Organización | Nombre que aparece en la interfaz |
| Zona Horaria | Zona para timestamps y reportes |

### Logo del Tenant

El logo se configura vía la URL del logo en la base de datos del tenant. Para cambiar:
1. Subir el logo a un servicio de hosting de imágenes
2. Actualizar la URL vía API o base de datos

### Idioma

**Configuración → General → Idioma**
- Español (predeterminado)
- English

El cambio se persiste en la base de datos y aplica a todos los usuarios del tenant.

---

## 5. Configuración de Seguridad

### Acceder

**Configuración → Seguridad**

### Opciones

| Opción | Descripción | Default |
|--------|-------------|---------|
| Autenticación de Dos Factores | Requerir 2FA para todos los usuarios | Desactivado |
| Tiempo de Sesión | Cierre automático por inactividad | 60 min |
| Contraseñas Seguras | Mínimo 12 caracteres con especiales | Desactivado |

### Recomendaciones para Producción

- **Activar 2FA** para todos los roles admin
- **Contraseñas seguras** activado
- **Tiempo de sesión**: 30 minutos para operadores, 15 minutos para admins
- **CREDENTIAL_ENCRYPTION_KEY** configurada en variables de entorno

---

## 6. Configuración de Notificaciones

### Acceder

**Configuración → Notificaciones**

### Preferencias por Tipo de Evento

| Tipo | Descripción | Default |
|------|-------------|---------|
| Eventos Críticos | Notificar eventos de severidad crítica | Activado |
| Alertas de Alta Severidad | Notificar alertas de alta severidad | Activado |
| Dispositivo Fuera de Línea | Notificar cuando un dispositivo se desconecta | Activado |
| Cambios de Salud del Sistema | Notificar cambios en componentes del sistema | Desactivado |
| Actualizaciones de Incidentes | Notificar cambios en incidentes asignados | Activado |

### Push Notifications

1. Verificar estado del permiso del navegador
2. Si no está otorgado: clic en **Habilitar Notificaciones Push**
3. Aceptar permiso del navegador
4. Las notificaciones llegan aunque la pestaña esté en segundo plano

### Historial de Notificaciones

Lista de notificaciones recientes de la sesión. Botón **Limpiar Historial** para borrar.

---

## 7. Configuración de IA

### Acceder

**Configuración → Config. IA**

### Proveedores Disponibles

| Proveedor | Modelos | Requiere |
|-----------|---------|----------|
| Lovable | Proxy gateway | Incluido (no necesita API key) |
| OpenAI | GPT-4o, GPT-4, GPT-3.5 | `OPENAI_API_KEY` en backend |
| Anthropic | Claude 3.5 Sonnet, Opus | `ANTHROPIC_API_KEY` en backend |

### Configurar

1. Seleccionar **Proveedor Principal**: El que se usa por defecto
2. Seleccionar **Proveedor de Respaldo**: Se usa si el principal falla
3. Clic en **Guardar Config. IA**

### Nota de Seguridad

Las API keys se configuran **solo en el backend** (variables de entorno). Nunca se exponen en el frontend. La interfaz solo selecciona cuál proveedor usar.

---

## 8. Feature Flags

### Acceder

**Configuración → Feature Flags**

### ¿Qué son?

Toggles globales para habilitar/deshabilitar funcionalidades del sistema sin necesidad de desplegar código nuevo.

### Gestión

- Lista de flags con nombre, clave y descripción
- Toggle para activar/desactivar cada uno
- Los overrides por tenant son gestionados por super_admin

---

## 9. Retención de Datos

### Acceder

**Configuración → Avanzado**

### Configurar

| Dato | Opciones |
|------|----------|
| Retención de Eventos | 30 días, 90 días, 365 días, Ilimitado |
| Retención de Auditoría | 30 días, 90 días, 365 días, Ilimitado |

Clic en **Guardar Configuración de Retención**.

### Impacto

- Los registros más antiguos que el período configurado se eliminan automáticamente
- La eliminación es irreversible
- Para cumplimiento normativo, se recomienda mínimo 365 días de auditoría

---

## 10. Gestión de Sitios

### Crear Sitio

1. **Sitios → Agregar Sitio**
2. Llenar:
   - Nombre (obligatorio)
   - Dirección
   - Latitud y Longitud (para ubicación en mapa)
   - Zona Horaria
   - Estado inicial
3. Clic en **Guardar**

### Buenas Prácticas

- Usar nombres claros: "Sede Norte — Edificio A"
- Siempre agregar coordenadas para el mapa
- Configurar zona horaria correcta para reportes precisos
- Asignar dispositivos al sitio correcto

---

## 11. Gestión de Dispositivos

### Proceso de Alta

1. **Dispositivos → Agregar Dispositivo**
2. Llenar información básica (nombre, marca, modelo, IP)
3. Configurar puertos (RTSP, ONVIF)
4. Agregar credenciales (se encriptan automáticamente)
5. Asignar a un sitio
6. **Probar Conexión** para verificar
7. Guardar

### Alta Masiva

Para importar múltiples dispositivos:
1. Preparar archivo CSV con columnas: nombre, marca, modelo, IP, puerto, sitio
2. Usar el botón **Importar** (cuando disponible)
3. O usar la API: `POST /api/v1/devices` en batch

### Monitoreo de Salud

El sistema realiza health checks periódicos:
- TCP connectivity al puerto principal
- Tiempo de respuesta
- Estado resultante: online/offline/unknown

Los dispositivos offline generan alertas automáticas si hay reglas configuradas.

### Credenciales de Dispositivos

- Las credenciales se almacenan encriptadas con AES-256
- La clave de encriptación se configura en `CREDENTIAL_ENCRYPTION_KEY`
- Nunca se exponen en el frontend
- Solo se usan internamente para conectar con el dispositivo

---

## 12. Configuración de Alertas y Escalamiento

### Crear Regla de Alerta

1. **Alertas → Reglas → Nueva Regla**
2. Configurar:
   - Nombre descriptivo
   - Severidad (critical/high/medium/low)
   - Tipo de trigger (device_offline, event_type, threshold)
   - Dispositivos/sitios afectados
3. Guardar

### Crear Política de Escalamiento

1. **Alertas → Escalamiento → Nueva Política**
2. Definir niveles:
   | Nivel | Timeout | Notifica a |
   |-------|---------|-----------|
   | 1 | 5 min | Operador de turno |
   | 2 | 15 min | Supervisor |
   | 3 | 30 min | Gerente |
3. Guardar

### Crear Canal de Notificación

1. **Alertas → Canales → Nuevo Canal**
2. Seleccionar tipo:
   - **Email**: Dirección de correo
   - **WhatsApp**: Número de teléfono
   - **Webhook**: URL del endpoint externo
   - **Push**: Automático por usuario suscrito
   - **Slack**: URL del incoming webhook
   - **Teams**: URL del incoming webhook
3. Probar y guardar

### Flujo Completo

```
Evento → Regla coincide → Alerta creada → Nivel 1: Notificar
                                            → No respuesta en timeout
                                            → Nivel 2: Escalar
                                            → No respuesta en timeout
                                            → Nivel 3: Escalar
```

---

## 13. Configuración de WhatsApp

### Prerequisitos

1. Cuenta Meta Business verificada
2. App en Meta for Developers (tipo Business)
3. Número de WhatsApp Business registrado

### Paso a Paso

1. Obtener credenciales de Meta:
   - Phone Number ID
   - Access Token (permanente)
   - Business Account ID

2. Configurar en Clave Seguridad:
   - **Opción A**: Variables de entorno en `backend/.env`
   - **Opción B**: **WhatsApp → Configuración** en la interfaz

3. Configurar webhook en Meta:
   - URL: `https://tu-dominio.com/api/v1/webhooks/whatsapp`
   - Verify Token: el mismo configurado en `WHATSAPP_VERIFY_TOKEN`
   - Suscripciones: messages, message_status

4. Sincronizar plantillas:
   - **WhatsApp → Plantillas → Sincronizar**
   - Las plantillas aprobadas por Meta aparecerán disponibles

### Seguridad del Webhook

- Validación de firma HMAC-SHA256 con `WHATSAPP_APP_SECRET`
- Protección contra replay attacks
- Deduplicación de mensajes

---

## 14. Configuración de Email

### Opción 1: Resend (Recomendado)

1. Crear cuenta en [resend.com](https://resend.com)
2. Generar API key
3. Configurar dominio de envío
4. En `backend/.env`:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxx
   EMAIL_FROM_ADDRESS=alertas@midominio.com
   EMAIL_FROM_NAME=Clave Seguridad
   ```

### Opción 2: SMTP

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alertas@miempresa.com
SMTP_PASS=contraseña_de_aplicacion
EMAIL_FROM_ADDRESS=alertas@miempresa.com
EMAIL_FROM_NAME=Clave Seguridad
```

Para Gmail: usar "Contraseñas de aplicaciones" (no la contraseña normal).

### Verificar

```bash
curl -X POST http://localhost:3000/api/v1/email/test \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"to":"admin@miempresa.com","subject":"Prueba","body":"Test desde Clave Seguridad"}'
```

---

## 15. Configuración de Citofonía/VoIP

### Paso 1: Configurar PBX

En `backend/.env`:
```env
SIP_HOST=192.168.1.100
SIP_PORT=5060
SIP_DOMAIN=pbx.midominio.com
SIP_ARI_URL=http://192.168.1.100:8088/ari
SIP_ARI_USERNAME=clave
SIP_ARI_PASSWORD=secreto
```

### Paso 2: Registrar Citófonos

1. **Citofonía IP → Dispositivos → Agregar Dispositivo**
2. Llenar: nombre, sección, marca, modelo, IP, URI SIP
3. El sistema verifica conectividad automáticamente

### Paso 3: Configurar Voz IA (Opcional)

1. Obtener API key de [elevenlabs.io](https://elevenlabs.io)
2. Configurar en `backend/.env`:
   ```
   ELEVENLABS_API_KEY=sk_xxxxxxxx
   ELEVENLABS_DEFAULT_VOICE_ID=21m00Tcm4TlvDq8ikWAM
   ```
3. En **Citofonía IP → Voz IA**:
   - Verificar conexión (indicador verde)
   - Seleccionar voz preferida
   - Configurar modo de atención (Humano/IA/Mixto)
   - Personalizar plantillas de saludo

---

## 16. Configuración de Domótica

### eWeLink/Sonoff

1. Configurar credenciales de desarrollador en `backend/.env`:
   ```
   EWELINK_APP_ID=tu_app_id
   EWELINK_APP_SECRET=tu_app_secret
   EWELINK_REGION=us
   ```

2. Desde **Domóticos** en la interfaz:
   - Clic en el ícono eWeLink
   - Ingresar email y contraseña de la cuenta eWeLink
   - Sincronizar dispositivos

3. Los dispositivos aparecen automáticamente con sus estados

### Otros Dispositivos

Para dispositivos no-eWeLink:
1. **Domóticos → Agregar Dispositivo**
2. Configurar: nombre, tipo, sección, marca, modelo, IP
3. Definir acciones disponibles

---

## 17. Gestión de Contratos

### Crear Contrato

1. **Contratos → Nuevo Contrato**
2. Llenar:
   - Número de contrato
   - Cliente
   - Fechas (inicio — fin)
   - Valor
   - Términos de servicio
   - Estado (borrador/activo/expirado)

### Facturas

1. Dentro de un contrato → **Agregar Factura**
2. Llenar items, montos, fecha de vencimiento
3. Marcar como pagada cuando se reciba el pago

---

## 18. Gestión de Llaves

### Inventario

1. **Llaves → Agregar Llave**
2. Llenar: código, ubicación, categoría, descripción

### Asignar Llave

1. Seleccionar llave → **Asignar**
2. Seleccionar persona responsable
3. Registrar fecha de entrega

### Devolver Llave

1. Seleccionar llave asignada → **Devolver**
2. Se registra fecha de devolución
3. Historial completo de tenedores disponible

---

## 19. Cumplimiento Normativo

### Plantillas

1. **Cumplimiento → Plantillas → Nueva Plantilla**
2. Definir: tipo (política/procedimiento/checklist), contenido, versión
3. Flujo de aprobación para cambios

### Retención de Datos

Configurar períodos de retención por tipo de dato para cumplir con regulaciones locales (Ley 1581 de Protección de Datos en Colombia, GDPR, etc.)

---

## 20. Capacitación y Certificaciones

### Programas

1. **Capacitación → Nuevo Programa**
2. Definir: nombre, descripción, requisitos de completación

### Certificaciones

1. Registrar certificación de un usuario
2. Definir fecha de obtención y expiración
3. El sistema alerta automáticamente cuando certificaciones están por vencer

---

## 21. Integraciones y MCP

### Gestión de Integraciones

1. **Integraciones → Activas**
2. Lista de integraciones configuradas con estado
3. Acciones: verificar salud, ver errores, editar, eliminar

### Conectores MCP

Model Context Protocol - conectores para herramientas externas del asistente IA:
1. **Integraciones → Conectores MCP**
2. Registrar nuevo conector con endpoint y credenciales
3. Las herramientas del conector quedan disponibles para el asistente IA

### Catálogo

**Integraciones → Catálogo** muestra integraciones disponibles para configurar.

---

## 22. Auditoría

### Acceder

**Auditoría** en la barra lateral.

### Contenido del Trail

Cada registro muestra:

| Campo | Descripción |
|-------|-------------|
| Fecha y Hora | Timestamp preciso |
| Usuario | Quién realizó la acción |
| Acción | Tipo de operación (crear, editar, eliminar, login, etc.) |
| Entidad | Qué recurso fue afectado |
| IP | Dirección IP del usuario |
| Detalles | Estado antes y después del cambio |

### Filtros

- Búsqueda por acción o usuario
- Filtro por tipo de acción
- Rango de fechas

### Exportar

Clic en **Exportar CSV** para descargar el trail completo filtrado.

---

## 23. Salud del Sistema

### Acceder

**Salud del Sistema** en la barra lateral.

### Componentes Monitoreados

| Componente | Qué Mide |
|------------|----------|
| Base de Datos | Conectividad y latencia PostgreSQL |
| Cache Redis | Conectividad Redis |
| MediaMTX | Estado del gateway de video |
| API Backend | Tiempo de respuesta |
| WebSocket | Conexiones activas |

### Estados

- **Saludable** (verde): Funcionando correctamente
- **Degradado** (amarillo): Funcionando con latencia alta o errores intermitentes
- **Caído** (rojo): No responde

### Acciones ante Problemas

1. Verificar logs: `docker compose logs <servicio>`
2. Reiniciar servicio: `docker compose restart <servicio>`
3. Verificar recursos del servidor (CPU, RAM, disco)

---

## 24. Backups

### Verificar Estado

```bash
GET /api/v1/backup/status
```

Muestra: último backup, próximo programado, uso de disco.

### Ejecutar Backup Manual

```bash
# Vía API
POST /api/v1/backup/trigger

# Vía línea de comando
docker exec clave-postgres pg_dump -U clave clave_db > backup_$(date +%Y%m%d_%H%M).sql
```

### Restaurar

```bash
cat backup_archivo.sql | docker exec -i clave-postgres psql -U clave clave_db
```

### Recomendaciones

- Backup diario automático
- Retener al menos 30 días de backups
- Almacenar copias fuera del servidor principal
- Probar restauración mensualmente

---

## 25. Reportes Programados

### Crear Reporte Programado

1. **Reportes Programados → Nuevo**
2. Configurar:
   - Tipo: eventos, incidentes, SLA, patrullas, dispositivos
   - Frecuencia: diario, semanal, mensual
   - Destinatarios: lista de emails
   - Filtros: severidad, sitio, tipo
   - Formato: PDF o CSV
3. Guardar

Los reportes se generan y envían automáticamente según la frecuencia configurada.

---

## 26. Turnos y SLA

### Configurar Turnos

1. **Turnos → Nuevo Turno**
2. Definir nombre, horario, días, sitios cubiertos
3. Asignar operadores al turno

### Configurar SLA

1. **SLA → Nueva Definición**
2. Definir por severidad:
   - Tiempo máximo de respuesta
   - Tiempo máximo de resolución
3. Los incidentes se rastrean automáticamente contra estos SLA

---

## 27. Protocolos de Emergencia

### Crear Protocolo

1. **Emergencias → Nuevo Protocolo**
2. Definir:
   - Nombre (ej: "Incendio", "Intrusión")
   - Descripción del escenario
   - Pasos a seguir
   - Contactos de emergencia vinculados
3. Guardar

### Contactos de Emergencia

1. **Emergencias → Contactos → Nuevo**
2. Agregar: nombre, cargo, teléfono, email
3. Categorizar: policía, bomberos, ambulancia, administración

### Activar Protocolo

En una emergencia real:
1. Ir a **Emergencias**
2. Seleccionar el protocolo correspondiente
3. **Activar** — se registra la hora y el activador
4. Seguir los pasos indicados
5. Contactar a los responsables listados
6. **Cerrar** cuando la emergencia se resuelva

---

## 28. Automatización

### Crear Regla

1. **Automatización → Nueva Regla**
2. Configurar:
   - **Trigger**: Evento, horario, manual
   - **Condiciones**: Expresiones lógicas (AND/OR)
   - **Acciones**: Secuencia de acciones a ejecutar
   - **Prioridad**: Alta, media, baja
3. Activar con el toggle

### Ejemplos de Reglas

| Regla | Trigger | Acción |
|-------|---------|--------|
| Cerrar puertas 22:00 | Horario 22:00 | Controlar relay de puerta |
| Alerta dispositivo offline | Evento device_offline | Enviar email + WhatsApp |
| Encender luces perimetrales | Horario 18:30 | Toggle dispositivo Sonoff |
| Escalar incidente crítico | Evento severity=critical | Crear incidente + notificar |

### Monitorear Ejecuciones

**Automatización → Historial** muestra cada ejecución con estado y tiempo.

---

## Checklist de Configuración Inicial

Use esta lista para verificar que todo esté configurado correctamente:

- [ ] Variables de entorno configuradas (JWT_SECRET, DATABASE_URL, CORS)
- [ ] Primer usuario admin creado en Supabase
- [ ] Tenant configurado con nombre y zona horaria
- [ ] Al menos un sitio creado
- [ ] Dispositivos registrados y verificados
- [ ] Streams de video funcionando
- [ ] Email configurado y probado
- [ ] Notificaciones push habilitadas
- [ ] Reglas de alerta creadas para eventos críticos
- [ ] Política de escalamiento configurada
- [ ] Canales de notificación activos
- [ ] Turnos definidos y operadores asignados
- [ ] SLA definidos por severidad
- [ ] Protocolo de emergencia configurado
- [ ] Backup verificado
- [ ] Permisos por módulo revisados
- [ ] (Opcional) WhatsApp configurado
- [ ] (Opcional) IA configurada
- [ ] (Opcional) Voz TTS configurada
- [ ] (Opcional) Domóticos sincronizados
- [ ] (Opcional) Reportes programados creados

---

*Manual de Administrador — Clave Seguridad v1.0 — Marzo 2026*
