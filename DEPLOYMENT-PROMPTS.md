# AION Vision Hub - Prompts de Despliegue Secuencial

> Cada prompt es una sesión de trabajo completa. Ejecutar EN ORDEN.
> Antes de cada prompt, proporcionar las credenciales que se soliciten.
> Al final de cada sesión, se genera un reporte de validación.

---

## PROMPT 1: PREPARACION DEL PROYECTO Y OPTIMIZACION PARA PRODUCCION

```
Eres el ingeniero principal de despliegue del proyecto AION Vision Hub ubicado en /Users/ADMIN/Documents/open-view-hub-main. Este es un sistema empresarial de videovigilancia multi-tenant con arquitectura:
- Frontend: React 18 + Vite + TypeScript + Shadcn/UI (PWA)
- Backend: Fastify 5 + Drizzle ORM + PostgreSQL 16 (monorepo pnpm + Turborepo en /backend)
- Edge Gateway: Fastify 5 + Device Adapters (Hikvision, Dahua, ONVIF)
- Streaming: MediaMTX (RTSP → WebRTC/HLS)
- Auth: Supabase Auth + JWT
- Real-time: Supabase Realtime (PostgreSQL LISTEN/NOTIFY)

OBJETIVO DE ESTA SESION: Preparar el código para producción escalable (250→500→1000 dispositivos).

TAREAS A EJECUTAR:

1. AUDITORÍA DE CÓDIGO PARA PRODUCCIÓN:
   - Revisar todos los archivos .env.example y documentar CADA variable requerida vs opcional
   - Verificar que NO haya credenciales hardcodeadas en el código fuente
   - Verificar que NO haya console.log sin contexto en producción
   - Revisar los CSP headers en index.html y asegurar que estén correctos para producción
   - Verificar que el service worker (PWA) esté correctamente configurado

2. OPTIMIZACIÓN DE RENDIMIENTO PARA ESCALA:
   - Revisar el docker-compose.yml y ajustar los límites de recursos para soportar 250-1000 dispositivos:
     * PostgreSQL: connection pool adecuado, shared_buffers, work_mem
     * Backend API: cluster mode o workers
     * Edge Gateway: configuración de conexiones concurrentes
     * MediaMTX: límites de streams simultáneos
   - Revisar la configuración de rate limiting y ajustar para operación real
   - Verificar que hay índices de base de datos adecuados en las tablas de alto volumen (events, audit_logs, devices)
   - Revisar las queries de Drizzle ORM para N+1 y optimizar si es necesario

3. CONFIGURACIÓN DE ESCALABILIDAD:
   - Crear/actualizar docker-compose.prod.yml con configuración optimizada para producción
   - Configurar PostgreSQL 16 con parámetros de producción (shared_buffers=1GB, effective_cache_size=3GB, etc.)
   - Agregar health checks robustos a todos los servicios
   - Configurar logging estructurado (JSON) con rotación
   - Agregar métricas básicas de rendimiento (request latency, active connections, memory usage)

4. SEGURIDAD:
   - Verificar que todas las rutas tienen autenticación excepto las públicas documentadas
   - Verificar CORS configurado correctamente para producción
   - Verificar que las credenciales de dispositivos se encriptan con AES-256-GCM
   - Revisar las políticas RLS en las migraciones de Supabase
   - Asegurar que los webhooks (WhatsApp) validan firmas HMAC

5. VALIDACIÓN:
   - Ejecutar npm run build (frontend) y verificar que compila sin errores
   - Ejecutar pnpm build (backend) y verificar que compila sin errores
   - Ejecutar npm run test y pnpm test, reportar resultados
   - Generar un archivo PRODUCTION-READINESS.md con el checklist de todo lo verificado

Al finalizar, genera un reporte con:
- [OK] o [PENDIENTE] para cada punto
- Lista de archivos modificados
- Próximos pasos para PROMPT 2
```

---

## PROMPT 2: CONFIGURACION DE SUPABASE Y BASE DE DATOS

```
Eres el ingeniero de base de datos del proyecto AION Vision Hub en /Users/ADMIN/Documents/open-view-hub-main. El PROMPT 1 ya preparó el código para producción.

CREDENCIALES QUE NECESITO QUE ME PROPORCIONES ANTES DE CONTINUAR:
- Supabase Project URL
- Supabase Anon Key (public)
- Supabase Service Role Key (private)
- Supabase DB Connection String (postgresql://...)
- Supabase Project Ref (para CLI)

OBJETIVO: Configurar Supabase completamente y validar que la base de datos esté lista para producción.

TAREAS A EJECUTAR:

1. CONFIGURAR SUPABASE CLI:
   - Verificar que supabase CLI está instalado (si no, dar instrucciones de instalación)
   - Vincular el proyecto con supabase link --project-ref
   - Verificar la conexión a la base de datos

2. MIGRACIONES DE BASE DE DATOS:
   - Listar TODAS las migraciones en /supabase/migrations/ en orden cronológico
   - Verificar que las migraciones son coherentes y no hay conflictos
   - Ejecutar supabase db push para aplicar todas las migraciones
   - Verificar que todas las tablas se crearon correctamente
   - Documentar las tablas creadas y sus relaciones

3. OPTIMIZACION DE BASE DE DATOS PARA 250-1000 DISPOSITIVOS:
   - Crear índices adicionales si no existen:
     * devices: (tenant_id, status), (tenant_id, site_id), (tenant_id, brand)
     * events: (tenant_id, created_at DESC), (tenant_id, severity, status), (device_id, created_at DESC)
     * audit_logs: (tenant_id, created_at DESC), (tenant_id, action)
     * streams: (device_id, status)
     * access_logs: (tenant_id, created_at DESC)
   - Crear una migración SQL con estos índices
   - Configurar auto-vacuum agresivo para tablas de alto volumen (events, audit_logs)

4. ROW LEVEL SECURITY (RLS):
   - Verificar que RLS está habilitado en TODAS las tablas de datos de usuario
   - Revisar cada política RLS existente
   - Si falta alguna política, crearla
   - Verificar que las funciones security definer están correctas

5. CONFIGURAR SUPABASE AUTH:
   - Verificar que Email/Password está habilitado
   - Configurar las URLs de redirección para producción
   - Documentar los pasos manuales que el usuario debe hacer en el dashboard de Supabase (capturas no posibles, pero sí instrucciones exactas)

6. CONFIGURAR SUPABASE EDGE FUNCTIONS:
   - Revisar /supabase/config.toml
   - Verificar que las funciones están configuradas para JWT verification
   - Listar todas las edge functions y su propósito

7. CREAR DATOS INICIALES:
   - Generar un script SQL para crear:
     * Tenant inicial de la empresa
     * Perfil del usuario admin (se llenará después del primer registro)
     * Sitio inicial de ejemplo
     * Configuración default del sistema
   - Guardar como /supabase/seed-production.sql

8. CONFIGURAR ARCHIVOS .ENV:
   - Actualizar .env del frontend con las credenciales de Supabase proporcionadas
   - Actualizar .env del backend con las credenciales de Supabase
   - Generar JWT_SECRET y CREDENTIAL_ENCRYPTION_KEY seguros
   - NO commitear archivos .env (verificar .gitignore)

VALIDACIÓN:
   - Conectar a la base de datos y ejecutar SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'
   - Verificar que RLS está activo en todas las tablas
   - Verificar que los índices existen
   - Probar la conexión desde el backend: cd backend && pnpm dev:api (iniciar y verificar que conecta a DB)
   - Generar reporte DATABASE-READY.md con estado de cada punto
```

---

## PROMPT 3: CONFIGURACION DEL VPS Y INFRAESTRUCTURA

```
Eres el ingeniero de infraestructura del proyecto AION Vision Hub en /Users/ADMIN/Documents/open-view-hub-main. Los PROMPTs 1 y 2 ya prepararon el código y la base de datos.

CREDENCIALES QUE NECESITO:
- IP del VPS
- Usuario SSH (root o con sudo)
- Contraseña SSH o ruta a la llave SSH
- Dominio principal (ej: aion.miempresa.com)
- Email para certificado SSL

CONTEXTO: El VPS debe soportar 250 dispositivos inicialmente, escalable a 1000. Ubuntu 22.04 LTS recomendado.

OBJETIVO: Preparar toda la infraestructura del servidor.

TAREAS A EJECUTAR (generar scripts ejecutables):

1. SCRIPT DE APROVISIONAMIENTO DEL VPS (/scripts/server-setup.sh):
   Crear un script bash completo que:
   - Actualice el sistema (apt update && upgrade)
   - Instale: Docker, Docker Compose plugin, Node.js 20, pnpm 9, Nginx, Certbot, UFW, htop, fail2ban
   - Configure el firewall (UFW): 22, 80, 443, 8554 (RTSP), 8889 (WebRTC)
   - Cree usuario 'aion' con permisos Docker
   - Configure fail2ban para protección SSH
   - Configure límites del sistema:
     * fs.file-max = 1000000
     * net.core.somaxconn = 65535
     * vm.swappiness = 10
   - Cree la estructura de directorios:
     * /opt/aion/app (código)
     * /opt/aion/backups (backups DB)
     * /opt/aion/logs (logs centralizados)
     * /opt/aion/ssl (certificados si aplica)
     * /opt/aion/media (almacenamiento de snapshots/clips)

2. CONFIGURACION DE NGINX (/scripts/nginx-aion.conf):
   Crear configuración completa de Nginx con:
   - Virtual host para frontend: aion.DOMINIO → /opt/aion/app/dist
   - Virtual host para API: api.DOMINIO → proxy_pass localhost:3000
   - Virtual host para Gateway: gw.DOMINIO → proxy_pass localhost:3100
   - WebSocket support en API y Gateway
   - Gzip compression
   - Cache headers para assets estáticos (1 año)
   - No cache para service worker
   - Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
   - Rate limiting a nivel de Nginx (backup del rate limiting de Fastify)
   - Configuración de upload size (para snapshots: client_max_body_size 50M)
   - Logs separados por virtual host

3. SCRIPT DE SSL (/scripts/ssl-setup.sh):
   - Certbot para los 3 subdominios
   - Auto-renovación via systemd timer
   - Redirect HTTP → HTTPS automático

4. DOCKER COMPOSE DE PRODUCCION (/backend/docker-compose.prod.yml):
   Crear versión de producción con:
   - PostgreSQL 16 con configuración optimizada:
     * shared_buffers=1GB
     * effective_cache_size=3GB
     * work_mem=16MB
     * maintenance_work_mem=256MB
     * max_connections=200
     * Volumen persistente con backup path
   - MediaMTX con configuración para 250+ streams:
     * Aumentar límites de conexión
     * Configurar paths dinámicos
     * Habilitar métricas
   - Backend API con:
     * NODE_ENV=production
     * Restart: unless-stopped
     * Logging: json-file con rotación (max-size: 50m, max-file: 5)
     * Resource limits apropiados
   - Edge Gateway con:
     * Restart: unless-stopped
     * Red: host network (para RTSP directo)
     * Variables de entorno desde .env

5. SCRIPTS DE OPERACION:
   - /scripts/deploy.sh: Pull + build + restart con zero-downtime
   - /scripts/backup.sh: Backup de PostgreSQL + rotación 30 días
   - /scripts/healthcheck.sh: Verificación de todos los servicios
   - /scripts/logs.sh: Visualización centralizada de logs
   - /scripts/restore-db.sh: Restaurar backup de base de datos

6. SYSTEMD SERVICES (alternativa a Docker para el backend):
   - /scripts/aion-api.service: Backend API como servicio systemd
   - /scripts/aion-gateway.service: Edge Gateway como servicio systemd
   - Instrucciones para elegir Docker vs systemd+PM2

VALIDACIÓN:
   - Verificar que todos los scripts son ejecutables y tienen sintaxis correcta (bash -n)
   - Verificar que el docker-compose.prod.yml es válido (docker compose config)
   - Verificar que la configuración de Nginx es válida (nginx -t simulado)
   - Generar INFRASTRUCTURE-READY.md con:
     * Lista de scripts generados y su propósito
     * Orden de ejecución en el VPS
     * Puertos que deben estar abiertos
     * Requisitos mínimos de hardware confirmados
     * Checklist de verificación post-instalación
```

---

## PROMPT 4: DESPLIEGUE EN EL VPS - BUILD Y LANZAMIENTO

```
Eres el ingeniero de despliegue del proyecto AION Vision Hub en /Users/ADMIN/Documents/open-view-hub-main. Los PROMPTs 1-3 prepararon código, base de datos e infraestructura.

CREDENCIALES QUE NECESITO:
- IP del VPS (ya configurado con PROMPT 3)
- Usuario SSH
- Dominio confirmado con DNS apuntando al VPS
- Credenciales de Supabase (ya configuradas en PROMPT 2)
- JWT_SECRET generado
- CREDENTIAL_ENCRYPTION_KEY generado

OBJETIVO: Hacer el build final, subir al servidor, y levantar todos los servicios.

TAREAS A EJECUTAR:

1. BUILD FINAL DEL FRONTEND:
   - Verificar que .env tiene las variables correctas de producción:
     * VITE_SUPABASE_URL
     * VITE_SUPABASE_PUBLISHABLE_KEY
     * VITE_API_URL=https://api.DOMINIO
   - Ejecutar npm run build
   - Verificar que dist/ se generó correctamente
   - Verificar tamaño del bundle (debe ser < 5MB total)
   - Verificar que el manifest.webmanifest está en dist/
   - Verificar que el service worker (sw.js) está en dist/

2. BUILD FINAL DEL BACKEND:
   - Verificar que backend/.env tiene todas las variables de producción
   - Ejecutar cd backend && pnpm install --frozen-lockfile
   - Ejecutar pnpm build
   - Verificar que apps/backend-api/dist/ existe
   - Verificar que apps/edge-gateway/dist/ existe
   - Ejecutar pnpm test y reportar resultados

3. PREPARAR PAQUETE DE DESPLIEGUE:
   - Crear script /scripts/package-deploy.sh que:
     * Cree un tarball con solo los archivos necesarios (sin node_modules, sin .git)
     * Incluya: dist/, backend/dist/, backend/package.json, backend/pnpm-lock.yaml, docker-compose.prod.yml, scripts/, .env files
     * Excluya: src/, tests/, docs/, .git/, node_modules/
   - Generar el tarball: aion-deploy-FECHA.tar.gz

4. INSTRUCCIONES DE DESPLIEGUE EN VPS:
   Generar script /scripts/deploy-to-vps.sh que:
   - Suba el tarball al VPS via SCP
   - Extraiga en /opt/aion/app/
   - Instale dependencias de producción: cd backend && pnpm install --prod --frozen-lockfile
   - Copie la configuración de Nginx y recargue
   - Configure SSL con Certbot
   - Inicie los contenedores Docker: docker compose -f docker-compose.prod.yml up -d
   - Espere a que todos los servicios estén healthy
   - Ejecute las migraciones de base de datos: pnpm db:migrate
   - Verifique cada servicio:
     * curl http://localhost:3000/health
     * curl http://localhost:3100/health
     * curl http://localhost:9997/v3/paths
     * curl https://DOMINIO (frontend)
     * curl https://api.DOMINIO/health
   - Reporte resultado de cada verificación

5. CONFIGURAR CRON JOBS:
   - Backup de DB: diario a las 3am
   - Health check: cada 5 minutos
   - Limpieza de logs: semanal
   - Renovación SSL: automática via certbot timer
   - Limpieza de eventos antiguos (>90 días): mensual

6. CONFIGURAR MONITOREO BASICO:
   - Script que envíe alerta por email si algún servicio cae
   - Configurar logrotate para todos los logs
   - Dashboard de estado simple (endpoint /health que muestre todos los servicios)

VALIDACIÓN COMPLETA:
   - [ ] Frontend accesible en https://DOMINIO
   - [ ] API responde en https://api.DOMINIO/health
   - [ ] Gateway responde en https://gw.DOMINIO/health
   - [ ] Login funciona (crear usuario de prueba)
   - [ ] PWA se puede instalar desde Chrome
   - [ ] WebSocket funciona (eventos real-time)
   - [ ] SSL válido en los 3 subdominios
   - [ ] Docker containers healthy
   - [ ] Cron jobs registrados
   - Generar DEPLOYMENT-COMPLETE.md con estado de cada validación
```

---

## PROMPT 5: CONFIGURACION INICIAL DEL SISTEMA Y PRIMER TENANT

```
Eres el ingeniero de configuración del proyecto AION Vision Hub. El sistema ya está desplegado y funcionando en producción (PROMPTs 1-4 completados).

CREDENCIALES QUE NECESITO:
- URL del sistema en producción (https://aion.DOMINIO)
- Supabase DB Connection String (para queries directas)
- Datos de la empresa:
  * Nombre de la empresa
  * Email del administrador principal
  * Nombre completo del administrador
  * Timezone (ej: America/Bogota, America/Mexico_City)
  * Idioma preferido (es/en)

OBJETIVO: Configurar el primer tenant, usuario admin, sitios, y dejar el sistema listo para agregar dispositivos.

TAREAS A EJECUTAR:

1. CREAR TENANT PRINCIPAL:
   - Generar script SQL /scripts/init-tenant.sql que:
     * Cree el tenant con los datos de la empresa
     * Configure plan 'enterprise'
     * Configure settings JSON con timezone e idioma
     * Active el tenant

2. CONFIGURAR USUARIO ADMIN:
   - Documentar paso a paso:
     1. El admin debe registrarse en https://DOMINIO/login → "Create account"
     2. Confirmar email
     3. Ejecutar script SQL que:
        * Vincule el usuario al tenant
        * Cree perfil completo
        * Asigne rol super_admin
   - Generar script /scripts/promote-admin.sql parametrizado

3. CREAR ESTRUCTURA DE SITIOS:
   - Generar script SQL para crear sitios de ejemplo basados en la info del usuario
   - Cada sitio con: nombre, dirección, coordenadas GPS, timezone, gateway_id

4. CREAR SECCIONES POR SITIO:
   - Generar secciones típicas de videovigilancia:
     * Entrada principal, Perímetro, Estacionamiento, Lobby, Oficinas, Almacén, etc.
   - Asignar a cada sitio creado

5. CREAR ROLES Y USUARIOS ADICIONALES:
   - Documentar cómo crear usuarios adicionales desde la interfaz:
     * Operadores (monitoreo 24/7)
     * Viewers (solo lectura)
     * Auditores
   - Generar script SQL de ejemplo para crear usuarios de prueba

6. CONFIGURAR PARAMETROS DEL SISTEMA:
   - Revisar y configurar:
     * Severidad de eventos (critical, high, medium, low, info)
     * Tipos de eventos soportados
     * Políticas de retención de eventos (90 días default)
     * Políticas de retención de audit logs (180 días)
     * Configuración de notificaciones por defecto
   - Generar migración SQL con estos defaults

7. CONFIGURAR INTEGRACIONES BÁSICAS:
   - Crear registros de integración para:
     * Email (si se proporcionó RESEND_API_KEY)
     * AI Assistant (si se proporcionó ANTHROPIC_API_KEY)
   - Documentar qué integraciones opcionales se pueden habilitar después

8. VERIFICAR PERMISOS Y ACCESO:
   - Verificar que el admin puede acceder a TODAS las secciones
   - Verificar que un viewer NO puede modificar datos
   - Verificar que las rutas protegidas redirigen a login

VALIDACIÓN:
   - [ ] Admin puede hacer login
   - [ ] Dashboard muestra datos del tenant
   - [ ] Sites aparecen en el mapa (SitesPage)
   - [ ] La navegación completa funciona sin errores 404
   - [ ] Settings muestra la configuración del tenant
   - [ ] Admin page muestra gestión de usuarios
   - [ ] El idioma cambia correctamente (es/en)
   - [ ] El tema dark mode funciona
   - Generar TENANT-CONFIGURED.md con estado
```

---

## PROMPT 6: CONFIGURACION DE DISPOSITIVOS Y STREAMING

```
Eres el ingeniero de integración de dispositivos del proyecto AION Vision Hub. El sistema está en producción con tenant y admin configurados (PROMPTs 1-5).

CREDENCIALES QUE NECESITO:
- URL del Gateway: https://gw.DOMINIO
- Datos de cámaras a agregar (para cada una):
  * IP de la cámara
  * Puerto (80 o 554)
  * Usuario admin de la cámara
  * Contraseña de la cámara
  * Marca (Hikvision/Dahua/ONVIF)
  * Modelo (si lo sabe)
  * Ubicación/nombre descriptivo
  * Sitio al que pertenece
- Rango de red para descubrimiento (ej: 192.168.1.0/24)
- Tipo de conexión: ¿VPS en misma red que cámaras? ¿VPN? ¿Edge Gateway local?

OBJETIVO: Configurar la conexión a dispositivos y validar streaming de video.

TAREAS A EJECUTAR:

1. VERIFICAR CONECTIVIDAD DE RED:
   - Desde el VPS/Gateway, verificar acceso a las IPs de las cámaras
   - Si las cámaras están en red distinta, documentar las opciones:
     * Opción A: VPN (WireGuard) entre VPS y red local
     * Opción B: Edge Gateway local (mini-PC en la red de cámaras)
     * Opción C: Port forwarding (no recomendado para producción)
   - Generar script /scripts/test-camera-connectivity.sh

2. CONFIGURAR EDGE GATEWAY PARA ESCALA:
   - Revisar y optimizar la configuración del Edge Gateway para 250 dispositivos:
     * DEVICE_CONNECT_TIMEOUT_MS=10000 (incrementar para redes lentas)
     * DEVICE_PING_INTERVAL_MS=60000 (cada minuto para 250+ dispositivos)
     * DEVICE_RECONNECT_MAX_ATTEMPTS=10
     * CACHE_MAX_ENTRIES=1000
     * CACHE_TTL_MS=600000
   - Actualizar .env del gateway

3. CONFIGURAR MEDIAMTX PARA ESCALA:
   - Crear /backend/mediamtx.yml con configuración optimizada:
     * pathDefaults para streams RTSP
     * Límites de lectores por stream
     * Timeouts apropiados
     * Habilitar métricas
     * Configurar paths dinámicos (on-demand)
   - Montar como volumen en docker-compose.prod.yml

4. REGISTRAR DISPOSITIVOS:
   - Para cada cámara proporcionada:
     * Generar la llamada API para registrarla
     * Test de conexión via API del Gateway
     * Registrar streams (main + sub)
   - Generar script /scripts/register-devices.sh con curl commands
   - Alternativa: Generar script SQL para inserción directa

5. DESCUBRIMIENTO AUTOMÁTICO:
   - Configurar DISCOVERY_NETWORK_RANGE
   - Documentar cómo usar el Discovery desde la interfaz web
   - Generar script para descubrimiento via API

6. VALIDAR STREAMING:
   - Para cada dispositivo registrado:
     * Verificar que MediaMTX recibe el stream RTSP
     * Verificar que WebRTC funciona en el navegador
     * Verificar la URL del stream: GET /streams/:deviceId/url
   - Generar script de validación masiva

7. CONFIGURAR POLÍTICAS DE STREAM:
   - Main stream: Para vista individual (alta resolución)
   - Sub stream: Para mosaico/grid (baja resolución, ahorra ancho de banda)
   - Configurar la política en el código si necesita ajustes

8. MONITOREO DE DISPOSITIVOS:
   - Verificar que el health monitor del Gateway funciona
   - Configurar alertas cuando un dispositivo se desconecta
   - Dashboard de estado de dispositivos

VALIDACIÓN:
   - [ ] Todos los dispositivos registrados aparecen en Devices page
   - [ ] Estado de cada dispositivo: "online" o "connected"
   - [ ] Live View muestra video en tiempo real
   - [ ] Grid/mosaico de múltiples cámaras funciona
   - [ ] PTZ funciona en cámaras compatibles
   - [ ] Discovery encuentra dispositivos en la red
   - [ ] MediaMTX muestra paths activos: curl http://localhost:9997/v3/paths
   - [ ] No hay errores en logs del Gateway: docker logs aion-gateway --tail=100
   - Generar DEVICES-CONFIGURED.md con estado de cada dispositivo
```

---

## PROMPT 7: INTEGRACIONES AVANZADAS (WhatsApp, Email, IA, Domótica)

```
Eres el ingeniero de integraciones del proyecto AION Vision Hub. El sistema está en producción con dispositivos configurados (PROMPTs 1-6).

CREDENCIALES QUE NECESITO (solo las que apliquen):
- WhatsApp Business:
  * Phone Number ID
  * Access Token (permanente)
  * Business Account ID
  * App Secret
  * Verify Token (inventar uno seguro)
- Email:
  * Resend API Key, O
  * SendGrid API Key, O
  * SMTP: host, port, user, password
  * Dominio verificado para envío
- IA:
  * Anthropic API Key (Claude)
  * OpenAI API Key (opcional)
- ElevenLabs (voz):
  * API Key
  * Voice ID preferido
- eWeLink/Sonoff:
  * App ID
  * App Secret
  * Region (us/eu/as)
- VoIP/SIP (si aplica):
  * PBX IP (Asterisk/FreePBX)
  * ARI URL, username, password
  * Dominio SIP

OBJETIVO: Configurar todas las integraciones opcionales que el usuario tenga disponibles.

TAREAS POR INTEGRACIÓN:

1. EMAIL (si se proporcionó):
   - Configurar provider en backend .env (RESEND_API_KEY o SENDGRID_API_KEY o SMTP_*)
   - Verificar envío con un email de prueba via API
   - Configurar alertas automáticas:
     * Evento crítico → email al admin
     * Dispositivo offline > 5 min → email al operador
     * Resumen diario de eventos
   - Crear templates de email si no existen

2. WHATSAPP (si se proporcionó):
   - Configurar todas las variables WHATSAPP_* en backend .env
   - Configurar el webhook URL en Meta Developer Console:
     URL: https://api.DOMINIO/webhooks/whatsapp
     Verify Token: el proporcionado
   - Verificar que el webhook responde al challenge de Meta
   - Enviar mensaje de prueba
   - Configurar bot AI para respuestas automáticas
   - Crear templates de mensaje para alertas

3. INTELIGENCIA ARTIFICIAL (si se proporcionó):
   - Configurar ANTHROPIC_API_KEY y/o OPENAI_API_KEY en .env
   - Verificar que AI Assistant funciona en la app
   - Configurar contexto del AI para videovigilancia:
     * Conocimiento del sistema
     * Capacidad de consultar eventos
     * Sugerencias de respuesta a incidentes
   - Verificar streaming de respuestas

4. ELEVENLABS TTS (si se proporcionó):
   - Configurar ELEVENLABS_API_KEY y VOICE_ID en .env
   - Verificar síntesis de voz via API
   - Integrar con intercom (si aplica)

5. EWELINK/SONOFF (si se proporcionó):
   - Configurar EWELINK_* en .env
   - Verificar lista de dispositivos via API
   - Configurar dispositivos en la sección Domotics
   - Probar toggle on/off

6. VOIP/SIP (si se proporcionó):
   - Configurar SIP_* en .env
   - Verificar conexión con PBX
   - Configurar dispositivos intercom
   - Probar llamada de prueba
   - Configurar greeting AI + handoff

7. PARA CADA INTEGRACIÓN CONFIGURADA:
   - Reiniciar servicios afectados
   - Verificar logs sin errores
   - Probar desde la interfaz web
   - Documentar la configuración realizada

VALIDACIÓN:
   - [ ] Email: Se recibe correo de prueba
   - [ ] WhatsApp: Webhook verificado por Meta
   - [ ] WhatsApp: Mensaje enviado y recibido
   - [ ] AI Assistant: Responde consultas sobre el sistema
   - [ ] ElevenLabs: Audio generado correctamente
   - [ ] eWeLink: Dispositivos listados y controlables
   - [ ] VoIP: Llamada de prueba exitosa
   - [ ] Integrations page muestra todas las integraciones activas
   - Generar INTEGRATIONS-CONFIGURED.md con estado
```

---

## PROMPT 8: CONFIGURACION DE PWA, NOTIFICACIONES Y EXPERIENCIA DE USUARIO

```
Eres el ingeniero de experiencia de usuario del proyecto AION Vision Hub. El sistema está completamente funcional con integraciones (PROMPTs 1-7).

CREDENCIALES NECESARIAS:
- URL de producción: https://aion.DOMINIO
- Acceso admin al sistema

OBJETIVO: Optimizar la experiencia PWA, configurar notificaciones, y verificar que la app funciona perfectamente en Windows y Mac.

TAREAS A EJECUTAR:

1. VERIFICAR PWA EN PRODUCCIÓN:
   - Verificar que el manifest.webmanifest se sirve correctamente
   - Verificar que el service worker se registra
   - Verificar que los iconos PWA (72x72 hasta 512x512) son accesibles
   - Verificar que la app pasa el "Lighthouse PWA audit" (documentar los criterios)
   - Si hay problemas, corregir la configuración en vite.config.ts

2. OPTIMIZAR MANIFEST PWA:
   - Verificar/actualizar el nombre y descripción de la app
   - Verificar shortcuts (Dashboard, Live View, Events, Incidents)
   - Verificar theme_color y background_color
   - Verificar display: standalone
   - Verificar orientation: any (para tablets)

3. CONFIGURAR NOTIFICACIONES PUSH:
   - Verificar que use-push-notifications.ts funciona correctamente
   - Verificar que el browser pide permiso de notificaciones
   - Configurar qué eventos generan notificaciones:
     * Evento de severidad critical → notificación inmediata
     * Evento de severidad high → notificación
     * Dispositivo offline → notificación
     * Incidente nuevo → notificación
   - Verificar que las notificaciones funcionan con la app cerrada (service worker)

4. VERIFICAR REAL-TIME:
   - Verificar que Supabase Realtime funciona:
     * Insertar un evento y verificar que aparece en tiempo real en Events page
     * Verificar que el badge de notificaciones se actualiza
   - Si no funciona, diagnosticar y corregir la suscripción

5. GUÍA DE INSTALACIÓN PARA USUARIOS FINALES:
   - Crear documento /docs/INSTALL-GUIDE.md con instrucciones paso a paso:

   WINDOWS (Chrome):
     1. Abrir https://aion.DOMINIO en Chrome
     2. Esperar prompt automático o click en icono de instalación
     3. Click "Instalar"
     4. La app aparece en menú inicio y escritorio

   WINDOWS (Edge):
     1. Abrir https://aion.DOMINIO en Edge
     2. Click "..." → "Apps" → "Install this site as an app"
     3. Click "Install"

   MAC (Chrome):
     1. Abrir https://aion.DOMINIO en Chrome
     2. Click "⋮" → "Install AION Vision Hub"
     3. Aparece en Applications y Launchpad

   MAC (Safari - Sonoma+):
     1. Abrir en Safari
     2. File → "Add to Dock"

   IPHONE/IPAD:
     1. Abrir en Safari
     2. Tap botón compartir → "Add to Home Screen"

   ANDROID:
     1. Abrir en Chrome
     2. Tap "Add to Home Screen" o banner automático

6. VERIFICAR RESPONSIVE:
   - Verificar que el layout funciona en:
     * Desktop (1920x1080)
     * Laptop (1366x768)
     * Tablet landscape (1024x768)
     * Tablet portrait (768x1024)
     * Mobile (375x812)
   - Documentar cualquier problema de layout encontrado
   - Corregir si hay issues críticos

7. VERIFICAR FUNCIONALIDADES PRINCIPALES:
   - Dashboard: gráficos, estadísticas, resumen
   - Live View: grid de cámaras, cambio de layout
   - Events: filtros, búsqueda, detalle
   - Incidents: crear, asignar, resolver
   - Devices: listar, agregar, estado
   - Sites: mapa con marcadores
   - Settings: cambiar idioma, tema
   - Reports: generar y descargar

8. OPTIMIZAR RENDIMIENTO:
   - Verificar que el bundle splitting funciona (vendor chunks separados)
   - Verificar lazy loading de páginas
   - Verificar caché de imágenes y fonts (service worker)
   - Verificar que las API calls usan React Query caching

VALIDACIÓN:
   - [ ] PWA instalable en Chrome Windows
   - [ ] PWA instalable en Chrome Mac
   - [ ] PWA instalable en Safari Mac
   - [ ] PWA instalable en móvil
   - [ ] Notificaciones push funcionan
   - [ ] Real-time events funcionan
   - [ ] Todas las páginas cargan sin errores
   - [ ] Responsive funciona en todas las resoluciones
   - [ ] Offline: la app muestra contenido cacheado sin conexión
   - [ ] Service worker se actualiza cuando hay nueva versión
   - Generar PWA-VALIDATED.md con estado
```

---

## PROMPT 9: SEGURIDAD, HARDENING Y OPTIMIZACION FINAL

```
Eres el ingeniero de seguridad del proyecto AION Vision Hub. El sistema está completamente funcional (PROMPTs 1-8).

CREDENCIALES NECESARIAS:
- Acceso SSH al VPS
- URL de producción

OBJETIVO: Asegurar el sistema para producción enterprise, optimizar rendimiento, y preparar para escalamiento.

TAREAS A EJECUTAR:

1. HARDENING DEL VPS:
   - Verificar/configurar fail2ban:
     * SSH: 5 intentos → ban 1 hora
     * Nginx: 100 requests/min → ban 10 min
   - Deshabilitar login root por SSH (si no es necesario)
   - Configurar SSH key-only authentication (documentar pasos)
   - Verificar que solo los puertos necesarios están abiertos
   - Configurar automatic security updates:
     apt install unattended-upgrades
   - Verificar permisos de archivos sensibles (.env: 600)

2. HARDENING DE NGINX:
   - Agregar security headers:
     * Strict-Transport-Security (HSTS)
     * X-Content-Type-Options: nosniff
     * X-Frame-Options: DENY (excepto para embeds permitidos)
     * Referrer-Policy: strict-origin-when-cross-origin
     * Permissions-Policy: camera=(), microphone=(), geolocation=()
   - Ocultar versión de Nginx (server_tokens off)
   - Rate limiting por IP en Nginx
   - Bloqueo de bots maliciosos

3. HARDENING DE LA APLICACIÓN:
   - Verificar que CORS solo permite orígenes configurados
   - Verificar que rate limiting funciona correctamente
   - Verificar que JWT tokens expiran correctamente (24h)
   - Verificar que las credenciales de dispositivos están encriptadas en DB
   - Verificar que no hay información sensible en los logs
   - Verificar Content Security Policy en index.html

4. HARDENING DE BASE DE DATOS:
   - Verificar que PostgreSQL no acepta conexiones externas
   - Verificar que el usuario de DB tiene solo los permisos necesarios
   - Configurar connection pooling (PgBouncer si necesario para >250 dispositivos)
   - Verificar backups automáticos funcionan

5. OPTIMIZACIÓN DE RENDIMIENTO:
   - Frontend:
     * Verificar tamaño de chunks (ninguno > 500KB)
     * Verificar que imágenes están optimizadas
     * Verificar que fonts usan display: swap
     * Verificar Time to First Byte < 200ms
   - Backend:
     * Verificar que las queries pesadas tienen índices
     * Configurar connection pool de PostgreSQL apropiado
     * Verificar que no hay memory leaks (monitorear RSS)
   - MediaMTX:
     * Verificar consumo de CPU/RAM por stream
     * Estimar capacidad: cuántos streams con el hardware actual

6. PLAN DE ESCALAMIENTO:
   - Documentar en SCALING-GUIDE.md:
     * 250 dispositivos: configuración actual (1 VPS)
     * 500 dispositivos: ajustes necesarios (más RAM, CPU)
     * 1000 dispositivos: arquitectura distribuida
       - Múltiples Edge Gateways
       - Load balancer para API
       - Read replicas de PostgreSQL
       - MediaMTX distribuido
     * Estimación de costos por nivel

7. PLAN DE DISASTER RECOVERY:
   - Documentar en DR-PLAN.md:
     * Backup: PostgreSQL cada 6 horas, retención 30 días
     * Restauración: tiempo estimado < 30 min
     * Failover: documentar pasos para levantar en nuevo servidor
     * Datos críticos: DB, .env, certificados SSL
   - Generar script /scripts/full-backup.sh (DB + config + certs)
   - Generar script /scripts/full-restore.sh

8. MONITOREO DE PRODUCCIÓN:
   - Configurar endpoint /health/detailed que muestre:
     * Estado de PostgreSQL
     * Estado de MediaMTX
     * Estado del Edge Gateway
     * Número de dispositivos conectados
     * Uso de memoria/CPU
     * Uptime
   - Configurar alertas básicas (script + cron que envíe email si algo falla)

VALIDACIÓN:
   - [ ] fail2ban activo y funcionando
   - [ ] SSL rating A+ en ssllabs.com
   - [ ] No hay puertos innecesarios abiertos (nmap scan)
   - [ ] Headers de seguridad presentes (securityheaders.com)
   - [ ] Rate limiting funciona (test con ab o wrk)
   - [ ] Backups se generan correctamente
   - [ ] Restore funciona (probar en entorno de test)
   - [ ] Memoria y CPU dentro de rangos normales
   - [ ] No hay credenciales en logs
   - Generar SECURITY-HARDENED.md con estado
```

---

## PROMPT 10: VALIDACION FINAL INTEGRAL - CERTIFICACION DE PRODUCCION

```
Eres el ingeniero de QA y certificación del proyecto AION Vision Hub. TODOS los PROMPTs anteriores (1-9) han sido ejecutados. Esta es la validación final antes de declarar el sistema en producción.

CREDENCIALES NECESARIAS:
- URL de producción: https://aion.DOMINIO
- URL API: https://api.DOMINIO
- URL Gateway: https://gw.DOMINIO
- Acceso SSH al VPS
- Credenciales admin del sistema

OBJETIVO: Ejecutar una batería completa de pruebas para certificar que el sistema está 100% operativo.

BATERÍA DE PRUEBAS A EJECUTAR:

═══════════════════════════════════════════
CATEGORIA 1: INFRAESTRUCTURA (15 pruebas)
═══════════════════════════════════════════

1.1  [ ] VPS: Sistema operativo actualizado (apt list --upgradable)
1.2  [ ] VPS: Firewall activo (ufw status)
1.3  [ ] VPS: fail2ban activo (systemctl status fail2ban)
1.4  [ ] VPS: Disco > 30% libre (df -h)
1.5  [ ] VPS: RAM > 20% libre (free -h)
1.6  [ ] Docker: Todos los contenedores running (docker ps)
1.7  [ ] Docker: Sin contenedores en restart loop (docker ps --filter status=restarting)
1.8  [ ] Nginx: Configuración válida (nginx -t)
1.9  [ ] Nginx: Servicio activo (systemctl status nginx)
1.10 [ ] SSL: Certificado válido para los 3 dominios
1.11 [ ] SSL: Auto-renovación configurada (certbot renew --dry-run)
1.12 [ ] DNS: Resolución correcta de los 3 subdominios
1.13 [ ] PostgreSQL: Conexión activa y respondiendo
1.14 [ ] MediaMTX: API respondiendo (curl localhost:9997/v3/paths)
1.15 [ ] Backups: Cron configurado y último backup existente

═══════════════════════════════════════════
CATEGORIA 2: BACKEND API (20 pruebas)
═══════════════════════════════════════════

2.1  [ ] Health check: GET /health → 200
2.2  [ ] Health ready: GET /health/ready → 200
2.3  [ ] CORS: Request desde origen permitido → headers correctos
2.4  [ ] CORS: Request desde origen no permitido → rechazado
2.5  [ ] Auth: Login con credenciales válidas → JWT token
2.6  [ ] Auth: Request sin token → 401
2.7  [ ] Auth: Request con token expirado → 401
2.8  [ ] Auth: Request con token válido → 200
2.9  [ ] Tenants: GET /tenants → lista del tenant
2.10 [ ] Users: GET /users → lista de usuarios del tenant
2.11 [ ] Devices: GET /devices → lista de dispositivos
2.12 [ ] Events: GET /events → lista de eventos
2.13 [ ] Sites: GET /sites → lista de sitios
2.14 [ ] Audit: GET /audit → logs de auditoría
2.15 [ ] Rate limiting: 100+ requests rápidos → 429
2.16 [ ] Error handling: Request a ruta inexistente → 404 con formato correcto
2.17 [ ] Validation: POST con datos inválidos → error de validación Zod
2.18 [ ] Encryption: Credenciales de dispositivos encriptadas en DB
2.19 [ ] Webhook: WhatsApp verify token (si configurado)
2.20 [ ] Logs: Sin errores en últimos 100 registros (docker logs)

═══════════════════════════════════════════
CATEGORIA 3: EDGE GATEWAY (10 pruebas)
═══════════════════════════════════════════

3.1  [ ] Health: GET /health → 200
3.2  [ ] Health ready: GET /health/ready → 200
3.3  [ ] Devices: GET /devices → lista de dispositivos conectados
3.4  [ ] Discovery: Funcionalidad de descubrimiento activa
3.5  [ ] Streams: Al menos 1 stream registrado y activo
3.6  [ ] WebSocket: Conexión WebSocket funcional
3.7  [ ] Heartbeat: Gateway reportando al backend API
3.8  [ ] Cache: LRU cache funcionando (no OOM)
3.9  [ ] Reconnect: Política de reconexión activa
3.10 [ ] Logs: Sin errores críticos en últimos 100 registros

═══════════════════════════════════════════
CATEGORIA 4: FRONTEND PWA (15 pruebas)
═══════════════════════════════════════════

4.1  [ ] Carga: Página inicial carga en < 3 segundos
4.2  [ ] Login: Formulario funciona correctamente
4.3  [ ] Dashboard: Muestra datos del sistema
4.4  [ ] Live View: Muestra streams de video
4.5  [ ] Events: Lista eventos con filtros
4.6  [ ] Devices: Lista dispositivos con estado
4.7  [ ] Sites: Mapa con marcadores
4.8  [ ] Settings: Configuración accesible
4.9  [ ] PWA: Manifest servido correctamente
4.10 [ ] PWA: Service worker registrado
4.11 [ ] PWA: Instalable en Chrome
4.12 [ ] PWA: Offline muestra contenido cacheado
4.13 [ ] Responsive: Funciona en mobile (375px)
4.14 [ ] I18n: Cambio de idioma funciona (es/en)
4.15 [ ] Dark mode: Tema oscuro activo y funcional

═══════════════════════════════════════════
CATEGORIA 5: SEGURIDAD (10 pruebas)
═══════════════════════════════════════════

5.1  [ ] SSL: Rating A o superior
5.2  [ ] Headers: Security headers presentes
5.3  [ ] HSTS: Strict-Transport-Security configurado
5.4  [ ] CSP: Content-Security-Policy configurado
5.5  [ ] Cookies: Secure, HttpOnly, SameSite
5.6  [ ] No info leak: Server header no revela versiones
5.7  [ ] RLS: Row Level Security activo en todas las tablas
5.8  [ ] Encryption: Credenciales encriptadas AES-256-GCM
5.9  [ ] Auth: Tokens JWT con expiración
5.10 [ ] Audit: Todas las acciones quedan registradas

═══════════════════════════════════════════
CATEGORIA 6: INTEGRACIONES (variable)
═══════════════════════════════════════════

6.1  [ ] Email: Envío de correo de prueba (si configurado)
6.2  [ ] WhatsApp: Webhook verificado (si configurado)
6.3  [ ] AI: Asistente responde (si configurado)
6.4  [ ] eWeLink: Dispositivos listados (si configurado)
6.5  [ ] VoIP: Conexión SIP activa (si configurado)

═══════════════════════════════════════════
CATEGORIA 7: OPERACIONES (5 pruebas)
═══════════════════════════════════════════

7.1  [ ] Backup: Script funciona y genera archivo
7.2  [ ] Restore: Script de restauración probado
7.3  [ ] Deploy: Script de actualización funciona
7.4  [ ] Monitoring: Health check cron activo
7.5  [ ] Logs: Rotación de logs configurada

GENERAR REPORTE FINAL:

Crear /PRODUCTION-CERTIFICATION.md con:
- Fecha de certificación
- Versión del sistema
- Resumen ejecutivo (1 párrafo)
- Resultados por categoría (aprobado/fallido/no aplica)
- Score total: X/75 pruebas pasadas
- Issues encontrados y severidad
- Recomendaciones
- Firma del proceso de validación

Si el score es >= 90%: CERTIFICADO PARA PRODUCCIÓN
Si el score es 70-89%: PRODUCCIÓN CON OBSERVACIONES
Si el score es < 70%: NO APTO - requiere correcciones

Al final, generar también:
- /docs/OPERATIONS-MANUAL.md: Manual de operaciones diarias
- /docs/TROUBLESHOOTING.md: Guía de resolución de problemas comunes
- /docs/SCALING-ROADMAP.md: Hoja de ruta para escalar 250→500→1000 dispositivos
```

---

## NOTAS IMPORTANTES

### Orden de ejecución obligatorio:
```
PROMPT 1 → PROMPT 2 → PROMPT 3 → PROMPT 4 → PROMPT 5 → PROMPT 6 → PROMPT 7 → PROMPT 8 → PROMPT 9 → PROMPT 10
```

### Entre cada prompt:
1. Verificar que el reporte de validación muestra todos los puntos [OK]
2. Si hay puntos [PENDIENTE], resolverlos antes de avanzar
3. Proporcionar las credenciales solicitadas por el siguiente prompt

### Credenciales a tener listas antes de empezar:
- [ ] Cuenta Supabase (URL, keys)
- [ ] VPS (IP, SSH, Ubuntu 22.04)
- [ ] Dominio + DNS configurado
- [ ] Email para SSL (Let's Encrypt)
- [ ] Datos de la empresa (nombre, timezone)
- [ ] IPs y credenciales de cámaras
- [ ] APIs opcionales (Resend, Anthropic, WhatsApp, eWeLink)
