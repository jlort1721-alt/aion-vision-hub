# AUDITORÍA INTEGRAL — PLATAFORMA AION

**Fecha:** 2026-04-05
**Plataforma:** AION Seguridad — Centro de Operaciones de Seguridad Física
**Cliente:** Clave Seguridad CTA, Medellín, Colombia
**Dominio:** aionseg.co
**Clasificación:** CONFIDENCIAL

---

## FASE 0 — VALIDACIÓN DE INSUMOS

### Insumos Disponibles

| Insumo | Estado | Observación |
|--------|--------|-------------|
| Código fuente Frontend (React/TS/Vite) | DISPONIBLE | 62 páginas, 40+ servicios, 19 hooks |
| Código fuente Backend (Node/Fastify) | DISPONIBLE | 68 módulos de rutas, 36 servicios, 5 workers |
| Esquema de BD (migraciones SQL) | DISPONIBLE | 19 migraciones, 81 tablas |
| Variables de entorno | DISPONIBLE | `.env`, `.env.production`, env templates |
| package.json (frontend + backend) | DISPONIBLE | Completos con deps prod y dev |
| docker-compose.yml | DISPONIBLE | 5 servicios containerizados |
| Nginx config | DISPONIBLE | Docker + producción VPS |
| Supabase edge functions | DISPONIBLE | 14 funciones |
| E2E tests | DISPONIBLE | 3 archivos Playwright |
| Deploy scripts | DISPONIBLE | GitHub Actions + scripts shell |

### Insumos No Proporcionados

| Insumo | Impacto |
|--------|---------|
| go2rtc.yaml (producción) | Solo disponible en `deploy/go2rtc-complete.yaml` (contiene credenciales) |
| PM2 ecosystem.config (producción) | Disponible en `backend/ecosystem.config.cjs` |
| Mosquitto config | NO PROPORCIONADO — no se puede evaluar seguridad MQTT |
| Asterisk config (sip.conf, pjsip.conf) | NO PROPORCIONADO — solo referenciado en IVR service |
| Redis config (redis.conf) | Solo Docker command line |
| Logs de producción | NO PROPORCIONADO |
| Acceso a plataforma en vivo | NO PROPORCIONADO |

---

## FASE 1 — RESUMEN EJECUTIVO

### Estado General de la Plataforma

| Dimensión | Semáforo | Calificación |
|-----------|----------|--------------|
| Arquitectura | AMARILLO | Buena modularidad, deuda técnica media, SQL injection crítico |
| Backend API | AMARILLO | 350+ endpoints, buen RBAC, validación incompleta en ~15% |
| Base de Datos | ROJO | 81 tablas, 2 sin RLS, credenciales en texto plano |
| Frontend | VERDE | 62 páginas lazy-loaded, buen UX 24/7, 1 XSS |
| Seguridad | ROJO | Secretos en Git, registro abierto, TLS deshabilitado en Docker |
| DevOps | AMARILLO | Buena base PM2/Nginx, sin alerting, backup sin verificar |
| QA/Testing | AMARILLO | 750 tests, 25% cobertura estimada, 14 tests fallando |

### Top 10 Hallazgos Críticos

| # | Hallazgo | Área | Impacto |
|---|----------|------|---------|
| 1 | Secretos de producción en Git (API keys, JWT, DB passwords) | Seguridad/DevOps | Compromiso total de plataforma |
| 2 | SQL Injection via sql.raw() — 49 instancias | Arquitectura/Backend | Ejecución arbitraria de SQL |
| 3 | Endpoint de provisioning SIP sin autenticación | Backend/Seguridad | Robo de credenciales SIP |
| 4 | 2 tablas sin RLS (knowledge_base, ai_conversations) | Base de Datos | Fuga de datos cross-tenant |
| 5 | Contraseñas VoIP en texto plano en BD | Base de Datos | Compromiso de sistema PBX |
| 6 | Registro público sin aprobación (obtiene rol operator) | Seguridad | Acceso no autorizado |
| 7 | password_hash visible a usuarios del mismo tenant | Base de Datos | Brute-force offline de contraseñas |
| 8 | Redis/PostgreSQL/MediaMTX expuestos sin auth (Docker) | DevOps/Seguridad | Acceso directo a datos/streams |
| 9 | XSS via dangerouslySetInnerHTML sin sanitización | Frontend | Robo de tokens JWT |
| 10 | 110 credenciales de dispositivos en seed SQL | Base de Datos | Compromiso de 22 sedes |

### Evaluación de Riesgo

| Tipo | Nivel | Justificación |
|------|-------|---------------|
| Riesgo Operativo | ALTO | Sistema corre 24/7 sin alerting automatizado; falla silenciosa |
| Riesgo de Seguridad | CRÍTICO | Secretos comprometidos, registro abierto, SQL injection |
| Riesgo de Datos | ALTO | Datos biométricos sin consentimiento, PII sin cifrar, Ley 1581 |
| Riesgo de Disponibilidad | MEDIO | Health checks existen pero no hay auto-recovery ni alertas |

### Recomendación General

**NO-GO para producción certificada** hasta resolver todos los hallazgos CRÍTICOS (estimado: 5-7 días/persona). La plataforma tiene una arquitectura sólida y funcionalidad avanzada, pero los hallazgos de seguridad requieren remediación inmediata antes de operar con datos reales de residentes y grabaciones de cámaras.

### Inversión Estimada en Remediación

| Fase | Días/Persona | Costo Estimado (COP) |
|------|-------------|---------------------|
| Inmediata (CRÍTICOS) | 5-7 | $3.5M - $4.9M |
| Corto plazo (ALTOS) | 10-15 | $7M - $10.5M |
| Medio plazo (MEDIOS) | 15-25 | $10.5M - $17.5M |
| Evolución (BAJOS+INFO) | 20-30 | $14M - $21M |
| **TOTAL** | **50-77** | **$35M - $53.9M** |

*(Base: $700K COP/día-persona desarrollador senior)*

---

## FASE 2 — DASHBOARD DE HALLAZGOS

| Severidad | Arquitectura | Backend | BD | Frontend | Seguridad | DevOps | QA | **TOTAL** |
|-----------|:-----------:|:-------:|:--:|:--------:|:---------:|:------:|:--:|:---------:|
| **CRÍTICO** | 2 | 2 | 5 | 1 | 4 | 3 | 3 | **20** |
| **ALTO** | 6 | 7 | 7 | 4 | 8 | 5 | 7 | **44** |
| **MEDIO** | 6 | 11 | 10 | 7 | 8 | 7 | 6 | **55** |
| **BAJO** | 5 | 7 | 7 | 5 | 5 | 5 | 5 | **39** |
| **INFO** | 3 | 0 | 7 | 7 | 5 | 6 | 4 | **32** |
| **TOTAL** | **22** | **27** | **36** | **24** | **30** | **26** | **25** | **190** |

> **Nota:** Después de deduplicación (hallazgos encontrados por múltiples agentes), los hallazgos únicos son **~120**. La tabla refleja el conteo bruto por agente para trazabilidad.

---

## FASE 3 — HALLAZGOS DETALLADOS

### HALLAZGOS CRÍTICOS (20 hallazgos — remediación inmediata requerida)

---

### [CRIT-SEC-001] Secretos de Producción Comprometidos en Repositorio Git

**Severidad**: CRÍTICO
**Área**: Seguridad / DevOps
**OWASP**: A02 Cryptographic Failures / A05 Security Misconfiguration
**Componente**: `backend/.env`, `deploy/RUNBOOK.sh`, `deploy/go2rtc-*.yaml`, `e2e/helpers.ts`

**Descripción**: Múltiples archivos tracked por Git contienen secretos de producción en texto plano:
- `backend/.env`: JWT_SECRET, DATABASE_URL (con password `TestAdmin456!`), OPENAI_API_KEY (`sk-proj-...`), ANTHROPIC_API_KEY (`sk-ant-api03-...`), ELEVENLABS_API_KEY, RESEND_API_KEY, CREDENTIAL_ENCRYPTION_KEY, Twilio credentials, eWeLink credentials (`Clave.seg2023`)
- `deploy/RUNBOOK.sh`: 17+ contraseñas de dispositivos (`seg12345`, `Clave.seg2023`, `Seg12345`), password de admin (`Jml1413031.`)
- `deploy/go2rtc-complete.yaml`: 204 URLs RTSP con credenciales embebidas
- `e2e/helpers.ts`: Email y password de producción en texto plano

**Impacto**: Compromiso total de la plataforma. Cualquier persona con acceso al repositorio puede: impersonar cualquier usuario (JWT), leer toda la BD, usar APIs de pago (OpenAI, Anthropic, ElevenLabs), descifrar credenciales de dispositivos, y controlar 86 dispositivos IoT.

**Remediación**:
```bash
# 1. Rotar TODOS los secretos INMEDIATAMENTE
# 2. Regenerar: JWT_SECRET, DB password, todas las API keys, CREDENTIAL_ENCRYPTION_KEY
# 3. Purgar historial de Git:
pip install git-filter-repo
git filter-repo --path backend/.env --invert-paths
git filter-repo --path deploy/RUNBOOK.sh --invert-paths
git filter-repo --path deploy/go2rtc-complete.yaml --invert-paths
git filter-repo --path deploy/go2rtc-hikvision.yaml --invert-paths
# 4. Agregar a .gitignore:
echo "backend/.env" >> .gitignore
echo "deploy/*.yaml" >> .gitignore
echo "deploy/RUNBOOK.sh" >> .gitignore
# 5. Force push (requiere coordinación con equipo)
```
**Esfuerzo**: 4 horas
**Prioridad**: INMEDIATA (hoy)

---

### [CRIT-ARCH-001] SQL Injection via sql.raw() con Interpolación de Strings

**Severidad**: CRÍTICO
**Área**: Arquitectura / Backend
**OWASP**: A03 Injection
**Componente**: 49 instancias en múltiples archivos

**Descripción**: El backend usa `sql.raw()` de Drizzle ORM con interpolación directa de strings en lugar de consultas parametrizadas. Las instancias más peligrosas:

- `services/rules-engine.ts:573-586`: Método `update()` interpola `input.name`, `input.description`, e `id` directamente:
  ```typescript
  // VULNERABLE
  setClauses.push(`name = '${input.name.replace(/'/g, "''")}'`);
  await db.execute(sql.raw(`UPDATE automation_rules SET ${setClauses.join(', ')} WHERE id = '${id}'`));
  ```
- `services/ivr-call-flow.ts:127-157`: `findResident()`, `findVehicleByPlate()`, `findDoorDevice()` con escaping mínimo
- `modules/operational-data/service.ts`: 36 usos de `sql.raw()` — el parámetro `search` se concatena en cláusulas ILIKE
- `services/event-bus.ts:206-218`: `getHistory()` con WHERE construido por concatenación

**Impacto**: Un atacante puede ejecutar SQL arbitrario. El servicio `operational-data` concatena el parámetro `search` del usuario directamente en ILIKE clauses.

**Remediación**:
```typescript
// ANTES (vulnerable):
conditions.push(`(full_name ILIKE '%${search}%')`);
await db.execute(sql.raw(`SELECT * FROM residents WHERE ${conditions.join(' AND ')}`));

// DESPUÉS (seguro):
import { sql } from 'drizzle-orm';
const results = await db.execute(
  sql`SELECT * FROM residents WHERE full_name ILIKE ${'%' + search + '%'} AND tenant_id = ${tenantId}`
);
```
**Esfuerzo**: 3-4 días (49 instancias a refactorizar)
**Prioridad**: INMEDIATA

---

### [CRIT-BACK-001] Endpoint de Provisioning SIP Sin Autenticación Expone Credenciales

**Severidad**: CRÍTICO
**Área**: Backend / Seguridad
**OWASP**: A01 Broken Access Control / A07 Auth Failures
**Componente**: `modules/provisioning/routes.ts:28-98`

**Descripción**: El endpoint `GET /provisioning/:filename` es público (no requiere JWT). Dado un MAC address de 12 caracteres, retorna la configuración SIP completa incluyendo username y password en texto plano. El fallback (línea 83) usa una contraseña hardcoded `aion2026`.

**Impacto**: Un atacante que enumere MAC addresses obtiene credenciales SIP para todos los teléfonos de intercomunicación, permitiendo llamadas no autorizadas o escucha.

**Remediación**:
```typescript
// Agregar autenticación al endpoint:
fastify.get('/provisioning/:filename', {
  preHandler: [fastify.authenticate], // Mínimo: JWT requerido
  // Ideal: validar que el dispositivo está registrado y el request viene de su IP
}, handler);

// Eliminar contraseña hardcoded:
// Línea 83: reemplazar 'aion2026' con generación dinámica desde BD
```
**Esfuerzo**: 4 horas
**Prioridad**: INMEDIATA

---

### [CRIT-DB-001] Tablas knowledge_base y ai_conversations Sin RLS

**Severidad**: CRÍTICO
**Área**: Base de Datos
**Componente**: `migrations/20260328_knowledge_base.sql`, `migrations/20260329_ai_conversations.sql`

**Descripción**: 
- `knowledge_base`: tenant_id es UUID nullable, sin FK, sin NOT NULL, sin RLS habilitado. Cualquier usuario autenticado puede leer/escribir todo el contenido.
- `ai_conversations`: user_id y tenant_id son TEXT (no UUID), sin FK, sin RLS. Cualquier usuario puede leer el historial completo de conversaciones AI de todos los tenants.

**Impacto**: Fuga completa de datos cross-tenant para knowledge base y conversaciones AI.

**Remediación**:
```sql
-- knowledge_base
ALTER TABLE knowledge_base ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE knowledge_base ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE knowledge_base ADD CONSTRAINT fk_kb_tenant 
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON knowledge_base
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));

-- ai_conversations  
ALTER TABLE ai_conversations ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid;
ALTER TABLE ai_conversations ALTER COLUMN user_id TYPE UUID USING user_id::uuid;
ALTER TABLE ai_conversations ADD CONSTRAINT fk_aic_tenant
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON ai_conversations
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
```
**Esfuerzo**: 2 horas
**Prioridad**: INMEDIATA

---

### [CRIT-DB-002] Contraseñas VoIP en Texto Plano en Base de Datos

**Severidad**: CRÍTICO
**Área**: Base de Datos / Seguridad
**Componente**: `migrations/20260325000000_add_missing_tables.sql:102-138`

**Descripción**: La tabla `voip_config` almacena `ari_password TEXT` y `fanvil_admin_password TEXT` en texto plano. Estas son credenciales PBX/ARI que otorgan control sobre el sistema de intercomunicación y control de acceso. La política RLS permite SELECT a cualquier usuario autenticado del tenant.

**Remediación**:
```sql
-- Cambiar a columnas encriptadas
ALTER TABLE voip_config ADD COLUMN ari_password_encrypted BYTEA;
ALTER TABLE voip_config ADD COLUMN fanvil_password_encrypted BYTEA;
-- Migrar datos existentes (desde el backend con encryptCredential())
-- Luego eliminar columnas plaintext:
ALTER TABLE voip_config DROP COLUMN ari_password;
ALTER TABLE voip_config DROP COLUMN fanvil_admin_password;
-- Restringir SELECT a admin solamente:
DROP POLICY IF EXISTS "voip_config_select" ON voip_config;
CREATE POLICY "voip_config_admin_only" ON voip_config
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND get_user_role(auth.uid()) IN ('super_admin', 'tenant_admin')
  );
```
**Esfuerzo**: 4 horas
**Prioridad**: INMEDIATA

---

### [CRIT-DB-003] RLS Roto en Tablas WhatsApp (current_setting vs auth.uid)

**Severidad**: CRÍTICO
**Área**: Base de Datos
**Componente**: `migrations/20260308040000_whatsapp_tables.sql:75-82`

**Descripción**: Las tablas `wa_conversations`, `wa_messages`, `wa_templates` usan `current_setting('app.current_tenant_id', true)::uuid` en lugar del patrón estándar `get_user_tenant_id(auth.uid())`. Si la variable de sesión no está configurada (default para clientes Supabase), la política retorna NULL y bloquea TODO acceso. Si un llamador malicioso la configura vía `SET LOCAL`, puede acceder a cualquier tenant.

**Remediación**:
```sql
-- Reescribir políticas wa_* para usar el patrón estándar
DROP POLICY IF EXISTS "wa_conversations_tenant" ON wa_conversations;
CREATE POLICY "wa_conversations_tenant" ON wa_conversations
  FOR ALL USING (tenant_id = get_user_tenant_id(auth.uid()));
-- Repetir para wa_messages y wa_templates
```
**Esfuerzo**: 1 hora
**Prioridad**: INMEDIATA

---

### [CRIT-DB-004] password_hash y reset_token Visibles a Usuarios del Mismo Tenant

**Severidad**: CRÍTICO
**Área**: Base de Datos / Seguridad
**Componente**: `migrations/20260329_local_auth.sql:4-8`

**Descripción**: Los campos `password_hash TEXT` y `reset_token TEXT` fueron agregados a la tabla `profiles`. La política RLS "Users see tenant profiles" permite SELECT a cualquier usuario del mismo tenant, exponiendo hashes de contraseñas (brute-force offline) y tokens de reset (account takeover) de todos los usuarios.

**Remediación**:
```sql
-- Opción 1: Vista restringida (recomendada)
CREATE VIEW public.profiles_safe AS
  SELECT id, tenant_id, email, full_name, role, avatar_url, created_at, updated_at
  FROM profiles;
-- Backend debe usar la vista para lecturas generales
-- y la tabla directa solo para auth (login, reset)

-- Opción 2: Política RLS más granular
DROP POLICY "Users see tenant profiles" ON profiles;
CREATE POLICY "Users see own profile fully" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users see tenant profiles limited" ON profiles
  FOR SELECT USING (
    tenant_id = get_user_tenant_id(auth.uid())
    AND id != auth.uid()
  );
-- + security barrier view que excluye password_hash y reset_token
```
**Esfuerzo**: 3 horas
**Prioridad**: INMEDIATA

---

### [CRIT-DB-005] 110 Credenciales de Dispositivos en Seed SQL

**Severidad**: CRÍTICO
**Área**: Base de Datos
**Componente**: `supabase/seed/seed_network_devices.sql`

**Descripción**: 110 pares usuario/contraseña en texto plano en el campo `notes` con marcador `NEEDS_ENCRYPTION`. Ejemplo: `usr: admin | pwd: seg12345`. Si los seeds se ejecutan en producción o los archivos se exponen, todas las credenciales de dispositivos de las 22 sedes quedan comprometidas.

**Remediación**: Migrar credenciales a columnas `username_encrypted`/`password_encrypted` BYTEA. Eliminar credenciales de los archivos seed.
**Esfuerzo**: 4 horas
**Prioridad**: INMEDIATA

---

### [CRIT-SEC-002] Clave Bridge Sin Guards de Autorización + SSRF

**Severidad**: CRÍTICO
**Área**: Seguridad / Backend
**OWASP**: A01 Broken Access Control / A10 SSRF
**Componente**: `modules/clave-bridge/routes.ts`

**Descripción**: Los 5 endpoints (`/clave/voice-command`, `/clave/push-event`, `/clave/announce`, `/clave/operator/:id/health`, `/clave/status`) no tienen `preHandler` con `requireRole`. El endpoint `/clave/push-event` actúa como relay SSRF abierto, reenviando cualquier JSON body a `CLAVE_API_URL`.

**Remediación**:
```typescript
fastify.post('/clave/voice-command', {
  preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')],
}, handler);
// Repetir para todos los endpoints clave-bridge
```
**Esfuerzo**: 1 hora
**Prioridad**: INMEDIATA

---

### [CRIT-SEC-003] Credenciales IMOU Hardcoded en Código Fuente

**Severidad**: CRÍTICO
**Área**: Seguridad / Backend
**Componente**: `modules/imou/routes.ts:68`

**Descripción**: El endpoint `/imou/binding-guide` retorna la credencial `admin / Clave.seg2023` junto con 11 serial numbers de dispositivos. Aunque requiere rol admin, la credencial nunca debe estar en código fuente.

**Remediación**: Mover a variable de entorno o BD cifrada. Eliminar del código.
**Esfuerzo**: 1 hora
**Prioridad**: INMEDIATA

---

### [CRIT-SEC-004] Registro Público Sin Aprobación — Rol Operator Inmediato

**Severidad**: CRÍTICO
**Área**: Seguridad
**OWASP**: A07 Identification and Authentication Failures
**Componente**: `modules/auth/routes.ts:68`

**Descripción**: `POST /auth/register` es público. Cualquier persona puede registrar una cuenta y obtener inmediatamente rol `operator` con acceso al tenant por defecto. Sin verificación de email, sin flujo de aprobación de admin, sin mecanismo invitation-only.

**Remediación**:
```typescript
// Opción A: Deshabilitar registro público
// Remover /auth/register de PUBLIC_ROUTES

// Opción B: Registro con aprobación
// 1. Nuevo campo: profiles.status = 'pending_approval' | 'active' | 'disabled'
// 2. Registro crea perfil con status='pending_approval', role='viewer'
// 3. Admin recibe notificación y aprueba/rechaza
// 4. Solo perfiles 'active' pueden autenticarse
```
**Esfuerzo**: 8 horas (opción B completa)
**Prioridad**: INMEDIATA

---

### [CRIT-FRONT-001] XSS via dangerouslySetInnerHTML Sin Sanitización

**Severidad**: CRÍTICO
**Área**: Frontend
**OWASP**: A03 Injection
**Componente**: `src/pages/SkillsPage.tsx:24`

**Descripción**: El componente `SimpleMarkdown` convierte markdown a HTML con regex y renderiza via `dangerouslySetInnerHTML` SIN usar DOMPurify. Si el contenido de skills incluye contenido generado por usuario o viene del API, es un vector XSS directo. DOMPurify está disponible en `src/lib/sanitize.ts` pero no se usa aquí.

**Remediación**:
```typescript
import { sanitizeHtml } from '@/lib/sanitize';

function SimpleMarkdown({ content }: { content: string }) {
  let html = content
    .replace(/### (.*)/g, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // ... etc
  html = sanitizeHtml(html); // AGREGAR ESTA LÍNEA
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```
**Esfuerzo**: 30 minutos
**Prioridad**: INMEDIATA

---

### [CRIT-DEVOPS-001] MediaMTX Sin Health Check ni Límite de Recursos

**Severidad**: CRÍTICO
**Área**: DevOps
**Componente**: `docker-compose.yml:111-127`

**Descripción**: MediaMTX maneja 204 streams RTSP pero no tiene healthcheck, ni `deploy.resources.limits`. Si consume toda la memoria disponible, derriba el VPS completo.

**Remediación**:
```yaml
clave-mediamtx:
  # ... existing config ...
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:9997/v3/paths/list"]
    interval: 30s
    timeout: 10s
    retries: 3
  deploy:
    resources:
      limits:
        memory: 4G
```
**Esfuerzo**: 30 minutos
**Prioridad**: INMEDIATA

---

### [CRIT-QA-001] Credenciales de Producción Hardcoded en Tests E2E

**Severidad**: CRÍTICO
**Área**: QA / Seguridad
**Componente**: `e2e/helpers.ts:4-5`

**Descripción**: Email y password reales de producción (`jlort1721@gmail.com` / `Jml1413031.`) en texto plano committed a Git.

**Remediación**: Usar variables de entorno: `process.env.E2E_USER_EMAIL`, `process.env.E2E_USER_PASSWORD`.
**Esfuerzo**: 30 minutos
**Prioridad**: INMEDIATA

---

### [CRIT-QA-002] Backend Tests No Ejecutan en CI (Module Resolution Error)

**Severidad**: CRÍTICO
**Área**: QA
**Componente**: `backend/apps/backend-api/src/__tests__/`

**Descripción**: Los 393 tests del backend fallan por error de resolución de módulos en el workspace pnpm. Esto significa que posiblemente no se ejecutan en CI, dejando 393 tests como documentación no verificada.

**Remediación**: Corregir configuración vitest del backend para resolver imports del workspace correctamente.
**Esfuerzo**: 4 horas
**Prioridad**: INMEDIATA

---

### HALLAZGOS ALTOS (Consolidados — 44 brutos, ~30 únicos)

---

### [HIGH-ARCH-001] Sistemas de Automatización Duplicados

**Severidad**: ALTO
**Área**: Arquitectura
**Componente**: `workers/automation-engine.ts` + `services/rules-engine.ts` + `services/orchestrator.ts`

**Descripción**: Dos sistemas independientes de automatización/reglas coexisten: (1) Rules Engine + Orchestrator (event-bus, cache en memoria), (2) Automation Engine worker (consulta BD directamente). Ambos evalúan `automation_rules`, ambos tienen lógica de cooldown, ambos crean incidentes. Riesgo de doble ejecución.

**Remediación**: Consolidar en un solo sistema. Recomendación: mantener el Orchestrator + Rules Engine (más maduro, event-driven) y retirar el automation-engine worker.
**Esfuerzo**: 2-3 días
**Prioridad**: Corto plazo (1 semana)

---

### [HIGH-ARCH-002] 38+ Variables de Entorno Sin Validación Zod

**Severidad**: ALTO
**Área**: Arquitectura
**Componente**: 38+ archivos de servicios usando `process.env.*` directamente

**Descripción**: Mientras `config/env.ts` valida vars centrales via Zod, 38+ servicios leen `process.env.*` directamente: GO2RTC_URL (en 6 archivos), FACE_RECOGNITION_URL, HIKCONNECT_AK/SK, ARI_URL/USERNAME/PASSWORD, VLLM_*, etc. Sin validación de tipo ni fallo temprano al arrancar.

**Remediación**: Mover TODAS las lecturas de `process.env` a `config/env.ts` con esquema Zod.
**Esfuerzo**: 1 día
**Prioridad**: Corto plazo

---

### [HIGH-ARCH-003] Sin Timeouts en Llamadas a APIs Externas

**Severidad**: ALTO
**Área**: Arquitectura
**Componente**: `services/imou-cloud.ts`, `hikconnect-cloud.ts`, `go2rtc-manager.ts`, `face-recognition.ts`, `elevenlabs.ts`

**Descripción**: Las integraciones externas no tienen timeouts configurados. Una conexión colgada puede bloquear el event loop y cascadear en degradación del servicio.

**Remediación**: Agregar `AbortSignal.timeout(10000)` a todas las llamadas `fetch()` externas. Usar `withRetry()` de `common-utils/src/retry.ts` (ya existe, no se usa).
**Esfuerzo**: 1 día
**Prioridad**: Corto plazo

---

### [HIGH-ARCH-004] Health Check Worker Secuencial (No Escala)

**Severidad**: ALTO
**Área**: Arquitectura
**Componente**: `workers/health-check-worker.ts:112`

**Descripción**: El worker hace TCP ping secuencial a cada dispositivo. Con 1000 dispositivos y 5s timeout, un sweep toma ~83 minutos, excediendo el intervalo de 5 minutos.

**Remediación**: Paralelizar con concurrency limiter:
```typescript
import pLimit from 'p-limit';
const limit = pLimit(10); // 10 concurrent pings
await Promise.allSettled(checkable.map(d => limit(() => pingDevice(d))));
```
**Esfuerzo**: 4 horas
**Prioridad**: Corto plazo

---

### [HIGH-BACK-001] /auth/reset-password y /confirm Sin Validación Zod

**Severidad**: ALTO
**Área**: Backend
**Componente**: `modules/auth/routes.ts:250,279`

**Descripción**: Body cast con `as { email: string }` y `as { token: string; newPassword: string }` sin esquema Zod. Sin longitud mínima en newPassword. Sin rate limiting en `/confirm`.

**Remediación**: Agregar esquemas Zod y rate limiting.
**Esfuerzo**: 2 horas
**Prioridad**: Corto plazo

---

### [HIGH-BACK-002] operational-data POST/PATCH Acepta Record<string, unknown>

**Severidad**: ALTO
**Área**: Backend
**Componente**: `modules/operational-data/routes.ts` (16 endpoints)

**Descripción**: 16 rutas POST/PATCH aceptan `Record<string, unknown>` sin esquema Zod. Riesgo de mass assignment — un atacante puede inyectar campos como `id`, `tenant_id`, `created_at`.

**Remediación**: Crear esquemas Zod para cada entidad de operational-data.
**Esfuerzo**: 1-2 días
**Prioridad**: Corto plazo

---

### [HIGH-BACK-003] Tenant GET /:id Sin Restricción de Rol (IDOR)

**Severidad**: ALTO
**Área**: Backend
**Componente**: `modules/tenants/routes.ts:36-44, 69-73`

**Descripción**: Cualquier usuario autenticado puede fetch datos de cualquier tenant por ID (UUID), incluyendo configuración/settings.

**Remediación**: Agregar `preHandler: [requireRole('super_admin', 'tenant_admin')]`.
**Esfuerzo**: 30 minutos
**Prioridad**: Corto plazo

---

### [HIGH-BACK-004] Remote Access Proxy — SSRF a Red Interna

**Severidad**: ALTO
**Área**: Backend / Seguridad
**OWASP**: A10 SSRF
**Componente**: `modules/remote-access/routes.ts:119-186`

**Descripción**: El proxy HTTP acepta `path` arbitrario. Combinado con `resolveTarget` que usa `wanIp` de la BD (podría ser 127.0.0.1), permite pivoteo a la red interna.

**Remediación**: Validar que IP resuelta no sea loopback/link-local/Docker-internal. Whitelist de paths permitidos (`/ISAPI/*`, `/cgi-bin/*`).
**Esfuerzo**: 4 horas
**Prioridad**: Corto plazo

---

### [HIGH-BACK-005] Network Scanner Permite Escaneo de Hosts Arbitrarios

**Severidad**: ALTO
**Área**: Backend / Seguridad
**OWASP**: A10 SSRF
**Componente**: `modules/network/routes.ts:62-136`

**Descripción**: `POST /network/scan/host` y `/scan/range` aceptan host/range con validación mínima (regex). Un operador autenticado puede escanear 127.0.0.1, 10.x.x.x, 172.17.x.x para descubrir infraestructura interna.

**Remediación**: Bloquear rangos privados/loopback en la validación del scanner.
**Esfuerzo**: 2 horas
**Prioridad**: Corto plazo

---

### [HIGH-BACK-006] Streams/Reboots/Database-Records Sin requireRole

**Severidad**: ALTO
**Área**: Backend
**Componente**: Múltiples módulos (~13 endpoints)

**Descripción**: 13 endpoints con JWT auth global pero sin `requireRole`, permitiendo acceso a cualquier usuario autenticado incluyendo `viewer`.

**Remediación**: Agregar `preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')]` a cada endpoint.
**Esfuerzo**: 2 horas
**Prioridad**: Corto plazo

---

### [HIGH-SEC-001] Política de Contraseñas Débil

**Severidad**: ALTO
**Área**: Seguridad
**Componente**: `modules/auth/schemas.ts:6`, `src/pages/LoginPage.tsx:41`

**Descripción**: Registro requiere solo `min(8)` sin complejidad. Frontend valida solo 6 caracteres. Sin verificación contra contraseñas comprometidas.

**Remediación**: Mínimo 12 caracteres, requerir mayúscula + minúscula + dígito + carácter especial.
**Esfuerzo**: 2 horas
**Prioridad**: Corto plazo

---

### [HIGH-SEC-002] No TLS en Configuración Docker (Nginx)

**Severidad**: ALTO
**Área**: Seguridad / DevOps
**Componente**: `nginx.conf:7` (bloque TLS completamente comentado)

**Descripción**: Todo el tráfico viaja sin cifrar (HTTP solo). JWTs, credenciales, datos biométricos, feeds de cámaras en texto plano.

**Remediación**: Habilitar bloque HTTPS en nginx.conf. La configuración de producción (`scripts/nginx-aionseg.conf`) ya tiene TLS — verificar que está activa.
**Esfuerzo**: 1 hora
**Prioridad**: Corto plazo

---

### [HIGH-DEVOPS-001] Redis y PostgreSQL Expuestos Externamente Sin Auth

**Severidad**: ALTO
**Área**: DevOps / Seguridad
**Componente**: `docker-compose.yml:87,135-136`

**Descripción**: Redis (6379) y PostgreSQL (5432) bindeados a 0.0.0.0. Redis sin `requirepass`.

**Remediación**:
```yaml
# Redis: Agregar autenticación y restringir bind
clave-redis:
  command: redis-server --save 60 1 --requirepass ${REDIS_PASSWORD} --maxmemory-policy allkeys-lru
  ports:
    - "127.0.0.1:${REDIS_PORT:-6379}:6379"

# PostgreSQL: Solo acceso interno
clave-postgres:
  ports:
    - "127.0.0.1:${DB_PORT:-5432}:5432"
```
**Esfuerzo**: 1 hora
**Prioridad**: Corto plazo

---

### [HIGH-DEVOPS-002] MediaMTX Streams Sin Autenticación

**Severidad**: ALTO
**Área**: DevOps / Seguridad
**Componente**: `docker-compose.yml:113-116`

**Descripción**: Puertos RTSP (8554), HLS (8888), WebRTC (8889) expuestos sin auth. Cualquier persona con acceso de red puede ver streams de cámaras directamente, bypass total de controles AION.

**Remediación**: Bind a 127.0.0.1 y servir streams solo a través del backend autenticado.
**Esfuerzo**: 2 horas
**Prioridad**: Corto plazo

---

### [HIGH-DEVOPS-003] Sin Alerting Automatizado en Fallas

**Severidad**: ALTO
**Área**: DevOps
**Componente**: `scripts/healthcheck.sh`, `services/system-watchdog.ts`

**Descripción**: Variables de alerta definidas pero sin implementación de envío. System Watchdog logea fallas pero no notifica. Para una plataforma de seguridad 24/7, fallas silenciosas son inaceptables.

**Remediación**: Conectar healthcheck y System Watchdog a Telegram/email/PagerDuty.
**Esfuerzo**: 1 día
**Prioridad**: Corto plazo

---

### [HIGH-DEVOPS-004] Sin Sentry en Backend (Solo Frontend)

**Severidad**: ALTO
**Área**: DevOps
**Componente**: Backend (ausente)

**Descripción**: Frontend tiene Sentry con tracing. Backend solo tiene logs Pino a disco/stdout — si nadie los lee, errores son invisibles.

**Remediación**: Integrar `@sentry/node` en el backend.
**Esfuerzo**: 4 horas
**Prioridad**: Corto plazo

---

### [HIGH-FRONT-001] 4 Rutas Sin ModuleGuard

**Severidad**: ALTO
**Área**: Frontend
**Componente**: `src/App.tsx:215-229`

**Descripción**: `/skills`, `/agent`, `/admin/dashboard`, `/admin/residents` están dentro de ProtectedRoute pero sin ModuleGuard. Cualquier usuario autenticado (incluyendo `viewer`) puede acceder.

**Remediación**: Envolver en `<ModuleGuard module="admin">` o el módulo apropiado.
**Esfuerzo**: 30 minutos
**Prioridad**: Corto plazo

---

### [HIGH-FRONT-002] fetch() Directo en DevicesPage Sin Auth Headers

**Severidad**: ALTO
**Área**: Frontend
**Componente**: `src/pages/DevicesPage.tsx:186-194, 262-296`

**Descripción**: Múltiples llamadas `fetch()` construyen URLs directamente, bypass del apiClient y sus auth headers/retry logic. Las llamadas no incluyen Authorization header.

**Remediación**: Reemplazar con `apiClient.post('/devices/${id}/test')`, etc.
**Esfuerzo**: 1 hora
**Prioridad**: Corto plazo

---

### [HIGH-FRONT-003] Token Refresh Duplicado (Race Condition)

**Severidad**: ALTO
**Área**: Frontend
**Componente**: `src/contexts/AuthContext.tsx:155-181` + `src/lib/api-client.ts:141-175`

**Descripción**: Token refresh implementado en AuthContext Y apiClient independientemente. Si dos requests fallan con 401 simultáneamente, ambos intentan refresh, potencialmente invalidando tokens mutuamente.

**Remediación**: Consolidar refresh en apiClient con mutex.
**Esfuerzo**: 4 horas
**Prioridad**: Corto plazo

---

### [HIGH-DB-001] Phantom Indexes sobre Columnas Inexistentes

**Severidad**: ALTO
**Área**: Base de Datos
**Componente**: `migrations/20260328_add_indexes.sql:6,14,29`

**Descripción**: 3 índices referencian columnas que no existen: `devices.device_slug`, `sites.slug`, `streams.tenant_id`. La migración falla silenciosamente con IF NOT EXISTS.

**Remediación**: Eliminar los CREATE INDEX o agregar las columnas faltantes.
**Esfuerzo**: 1 hora
**Prioridad**: Corto plazo

---

### [HIGH-DB-002] user_id y created_by Sin FK en 20+ Tablas

**Severidad**: ALTO
**Área**: Base de Datos
**Componente**: Múltiples migraciones

**Descripción**: 20+ columnas `user_id`, `created_by`, `initiated_by`, `performed_by`, `activated_by`, `resolved_by` sin constraint FK. Integridad referencial no garantizada.

**Remediación**: Agregar FK constraints referenciando `profiles(id)` o `auth.users(id)`.
**Esfuerzo**: 4 horas
**Prioridad**: Corto plazo

---

### [HIGH-LEY1581-001] Sin Consentimiento para Datos Biométricos

**Severidad**: ALTO
**Área**: Cumplimiento / Ley 1581
**Componente**: `modules/face-recognition/routes.ts`, tabla `biomarkers`

**Descripción**: Datos de reconocimiento facial (dato sensible bajo Ley 1581 Art. 5) se almacenan sin registro de consentimiento. El módulo GDPR existe (`/gdpr/consents`) pero no está integrado con el flujo de reconocimiento facial. `biomarkers.embedding` (vectores faciales) almacenado como `REAL[]` sin cifrado.

**Remediación**: 
1. Integrar flujo de consentimiento explícito antes de registrar rostro
2. Cifrar embeddings biométricos en reposo
3. Implementar política de retención con eliminación automática
**Esfuerzo**: 2-3 días
**Prioridad**: Corto plazo (requerimiento legal)

---

### [HIGH-LEY1581-002] Transferencia Internacional de Datos Sin Autorización SIC

**Severidad**: ALTO
**Área**: Cumplimiento / Ley 1581
**Componente**: Supabase (US-West-2), IMOU Cloud (China), eWeLink Cloud (China)

**Descripción**: Ley 1581 requiere que transferencias internacionales de datos personales solo ocurran a países con protección adecuada o con autorización de la SIC o consentimiento explícito del titular.

**Remediación**: Documentar transferencias, obtener autorización SIC o consentimiento explícito.
**Esfuerzo**: Variable (proceso legal)
**Prioridad**: Corto plazo

---

### [HIGH-QA-001] 88% de Páginas Frontend Sin Tests

**Severidad**: ALTO
**Área**: QA
**Descripción**: 53 de 60 páginas sin ningún test de componente. 14 de 19 hooks sin tests.
**Prioridad**: Medio plazo

---

### [HIGH-QA-002] Access Control, Alerts, LPR, Emergency: Zero Tests

**Severidad**: ALTO
**Área**: QA
**Descripción**: Módulos críticos de seguridad física sin cobertura de tests.
**Prioridad**: Medio plazo

---

## FASE 4 — INVENTARIOS CLAVE

### 4.1 Inventario de Servicios (Arquitectura)

| Servicio | Puerto | Protocolo | Health Check | Criticidad |
|----------|--------|-----------|--------------|------------|
| Fastify Backend API | 3000 | HTTP/WS | /health, /health/ready | CRÍTICA |
| Nginx Reverse Proxy | 80/443 | HTTP/HTTPS | wget spider | CRÍTICA |
| PostgreSQL (Supabase) | 5432 | TCP | pg_isready | CRÍTICA |
| Redis | 6379 | TCP | redis-cli ping | ALTA |
| go2rtc | 1984 | HTTP | manual curl | ALTA |
| MediaMTX | 8554,8888,8889 | RTSP/HLS/WebRTC | NINGUNO | ALTA |
| Asterisk PBX | 5038,5060 | AMI/SIP | AMI port check | MEDIA |
| Edge Gateway | 3100 | HTTP | /health | MEDIA |

### 4.2 Inventario de Endpoints API (350+)

| Categoría | Endpoints | Con Auth | Con Validación Zod | Con requireRole |
|-----------|-----------|----------|--------------------|-----------------| 
| Auth | 10 | 4/10 (6 públicos) | 7/10 | N/A |
| Devices/Cameras | 25 | 25/25 | 20/25 | 22/25 |
| Events/Incidents | 20 | 20/20 | 18/20 | 20/20 |
| Operational Data | 35 | 35/35 | 0/35 | 35/35 |
| IoT/Domotics | 15 | 15/15 | 15/15 | 15/15 |
| Access Control | 15 | 15/15 | 12/15 | 15/15 |
| Intercom/PBX | 20 | 20/20 | 18/20 | 18/20 |
| WhatsApp | 15 | 13/15 (2 webhook) | 15/15 | 13/15 |
| Alerts/Notifications | 25 | 25/25 | 22/25 | 22/25 |
| Admin/Config | 30 | 30/30 | 28/30 | 27/30 |
| Analytics/Reports | 20 | 20/20 | 18/20 | 18/20 |
| Streams/Media | 10 | 10/10 | 8/10 | 5/10 |
| Health/System | 10 | 0/10 (públicos) | N/A | N/A |
| Otros | 100+ | ~95% | ~85% | ~90% |

### 4.3 Inventario de Tablas BD (81 tablas)

| Estado RLS | Conteo | Tablas |
|------------|--------|--------|
| RLS ON + Políticas correctas | 76 | Todas las tablas core |
| RLS ON + Política rota (current_setting) | 3 | wa_conversations, wa_messages, wa_templates |
| **RLS DESHABILITADO** | **2** | **knowledge_base, ai_conversations** |

### 4.4 Estado de Módulos (Semáforo QA)

| Módulo | Estado | Tests | Notas |
|--------|--------|-------|-------|
| Autenticación | FUNCIONAL | 34 | Login/token OK, MFA falta |
| RBAC/Permisos | OPERATIVO | 14+ | 5 roles cubiertos |
| Dashboard | FUNCIONAL | 13 | UI renderiza, mocks menores |
| Cámaras/Dispositivos | FUNCIONAL | 30 | CRUD+health OK, streaming sin tests |
| Eventos | OPERATIVO | 15 | CRUD+normalización+stats |
| Incidentes | OPERATIVO | 14 | Lifecycle+SLA completo |
| Sitios | OPERATIVO | 8 | CRUD+aislamiento |
| Domótica/IoT | PARCIAL | 12 | 11 tests FALLANDO |
| Control de Acceso | PARCIAL | 1 | Solo tool MCP, CRUD sin tests |
| Intercom/PBX | FUNCIONAL | 12 | 1 fallando, SIP sin tests |
| WhatsApp | FUNCIONAL | 20 | Webhook+página, mensajería sin tests |
| Integraciones | OPERATIVO | 14+ | CRUD+conectividad |
| AI Assistant | FUNCIONAL | 13 | Config+provider |
| Reportes | OPERATIVO | 15+ | Servicio+worker+email |
| Alertas | EN DESARROLLO | 0 | Zero tests |
| Turnos | EN DESARROLLO | 0 | Zero tests |
| Patrullas | EN DESARROLLO | 0 | Zero tests |
| Emergencia | EN DESARROLLO | 0 | Zero tests |
| LPR/ANPR | EN DESARROLLO | 0 | Zero tests |
| Reconocimiento Facial | EN DESARROLLO | 0 | Zero tests |
| System Health | FUNCIONAL | 7 | UI + probes |
| Backup | OPERATIVO | 16 | Worker lifecycle completo |
| MCP Bridge | OPERATIVO | 36 | 22 tools validados |
| Templates Notificación | OPERATIVO | 37 | Schemas+service+rendering |
| Evidencia | OPERATIVO | 24 | CRUD+schemas |
| Analytics | FUNCIONAL | 8 | Dashboard+trends |
| Auditoría | FUNCIONAL | 12 | Plugin+auto-logging |
| Seguridad (XSS/HMAC) | OPERATIVO | 36 | Sanitización+webhook |
| Error Handling | OPERATIVO | 7 | Todos los tipos |
| Observabilidad | OPERATIVO | 13 | Métricas+health probes |
| PWA/Offline | FUNCIONAL | 27 | Hooks+notifications |

---

## FASE 5 — CUMPLIMIENTO LEY 1581/2012

| Requisito | Estado | Detalle |
|-----------|--------|---------|
| Art. 4 — Principio de Seguridad | FALLA PARCIAL | Contraseñas VoIP y datos seed en plaintext; embeddings biométricos sin cifrar |
| Art. 4 — Confidencialidad | FALLA PARCIAL | Reset tokens y password hashes visibles a usuarios del mismo tenant |
| Art. 5 — Datos Sensibles (Biometría) | FALLA | Vectores faciales sin cifrado, sin consentimiento, sin retención limitada |
| Art. 8 — Derechos del Titular (ARCO) | PARCIAL | Soft delete parcial; `data_retention_policies` sin motor de ejecución |
| Art. 12 — Transferencia Internacional | NO EVALUADO | Depende de Supabase region + IMOU + eWeLink (China) |
| Art. 15 — Aviso de Privacidad | FALTANTE | No hay política de privacidad ni aviso servido a usuarios/residentes |
| Registro ante SIC | DESCONOCIDO | No hay evidencia de registro de BD ante SIC |
| Consentimiento Informado | FALTANTE | No existe tabla `consent_records` ni mecanismo |
| Portal de Derechos ARCO para Residentes | FALTANTE | Solo usuarios autenticados de la plataforma acceden al módulo GDPR |
| Retención de Datos Automatizada | FALTANTE | Tabla existe pero sin ejecución automatizada |

---

## FASE 6 — ROADMAP CORRECTIVO

### Fase Inmediata (24-72 horas) — CRÍTICOS

| # | Acción | Esfuerzo | Responsable |
|---|--------|----------|-------------|
| 1 | Rotar TODOS los secretos (JWT, DB, API keys, encryption key) | 4h | DevOps |
| 2 | Purgar secretos del historial Git (filter-repo/BFG) | 2h | DevOps |
| 3 | Parametrizar 49 sql.raw() — comenzar por operational-data y rules-engine | 3-4 días | Backend |
| 4 | Agregar RLS a knowledge_base y ai_conversations | 2h | BD |
| 5 | Cifrar voip_config passwords, restringir RLS a admin | 4h | BD |
| 6 | Reescribir RLS de tablas wa_* (current_setting → auth.uid) | 1h | BD |
| 7 | Crear vista restringida de profiles (excluir password_hash, reset_token) | 3h | BD |
| 8 | Deshabilitar o agregar aprobación a /auth/register | 8h | Backend |
| 9 | Agregar auth a provisioning endpoint | 4h | Backend |
| 10 | Agregar requireRole a clave-bridge routes | 1h | Backend |
| 11 | Sanitizar SkillsPage.SimpleMarkdown con DOMPurify | 30min | Frontend |
| 12 | Eliminar credenciales de e2e/helpers.ts | 30min | QA |
| 13 | Agregar healthcheck + memory limit a MediaMTX | 30min | DevOps |
| 14 | Bind Redis/PostgreSQL a 127.0.0.1, agregar requirepass | 1h | DevOps |
| 15 | Eliminar credenciales de seed SQL | 4h | BD |

**Total estimado Fase Inmediata: 5-7 días/persona**

### Fase Corto Plazo (1-2 semanas) — ALTOS

| # | Acción | Esfuerzo |
|---|--------|----------|
| 16 | Consolidar sistemas de automatización duplicados | 2-3 días |
| 17 | Centralizar env vars en config/env.ts con Zod | 1 día |
| 18 | Agregar timeouts + retry a todas las integraciones externas | 1 día |
| 19 | Paralelizar health check worker | 4h |
| 20 | Agregar Zod a /auth/reset-password endpoints | 2h |
| 21 | Agregar Zod a 16 endpoints operational-data | 1-2 días |
| 22 | Agregar requireRole a tenant GET/:id, streams, reboots, database-records | 2h |
| 23 | SSRF protection en remote-access proxy y network scanner | 4h |
| 24 | Fortalecer política de contraseñas (12+ chars, complejidad) | 2h |
| 25 | Habilitar TLS en nginx Docker config | 1h |
| 26 | Agregar alerting (Telegram/email) a healthcheck y watchdog | 1 día |
| 27 | Integrar Sentry en backend | 4h |
| 28 | Agregar ModuleGuard a 4 rutas frontend faltantes | 30min |
| 29 | Reemplazar fetch() directo en DevicesPage con apiClient | 1h |
| 30 | Consolidar token refresh (eliminar duplicado) | 4h |
| 31 | Corregir phantom indexes o agregar columnas faltantes | 1h |
| 32 | Agregar FK constraints a user_id/created_by (20+ tablas) | 4h |
| 33 | Implementar consentimiento para datos biométricos | 2-3 días |
| 34 | Fix 14 tests frontend fallando | 4h |
| 35 | Fix backend test runner (module resolution) | 4h |

**Total estimado Fase Corto Plazo: 10-15 días/persona**

### Fase Medio Plazo (1-3 meses) — MEDIOS

| # | Acción | Esfuerzo |
|---|--------|----------|
| 36 | Refactorizar operational-data/service.ts (God Object → 12 servicios) | 3-5 días |
| 37 | Agregar CHECK constraints a campos status/type/severity (30+ tablas) | 2 días |
| 38 | Agregar updated_at triggers a 10+ tablas faltantes | 1 día |
| 39 | Mover JWT storage de localStorage a HttpOnly cookies | 2 días |
| 40 | Implementar account lockout (5 intentos fallidos → 15 min) | 1 día |
| 41 | Agregar CSP nonce/hash, eliminar 'unsafe-inline' | 2 días |
| 42 | Implementar motor de retención de datos automatizado | 2-3 días |
| 43 | Crear portal de derechos ARCO para residentes | 3-5 días |
| 44 | Tests para módulos sin cobertura (Access Control, Alerts, LPR, Emergency) | 5-10 días |
| 45 | Integrar E2E tests en CI pipeline | 1 día |
| 46 | Implementar backup off-site | 1 día |
| 47 | Agregar AOF persistence a Redis | 2h |
| 48 | Corregir 296 `any` types en frontend | 3-5 días |
| 49 | Eliminar 113 silent catch{} blocks en backend | 2-3 días |
| 50 | Documentar y obtener autorización SIC para transferencias internacionales | Variable |

**Total estimado Fase Medio Plazo: 25-45 días/persona**

### Fase Evolución (3-6 meses) — BAJOS + INFO

| # | Acción |
|---|--------|
| 51 | Centralizar GO2RTC_URL (repetido en 6+ archivos) |
| 52 | Mover pino-pretty y @types/nodemailer a devDependencies |
| 53 | Eliminar stub de Supabase client (dead code) |
| 54 | Agregar OCSP stapling a Nginx |
| 55 | Aumentar kill_timeout de PM2 a 10-15s |
| 56 | Alcanzar 50% cobertura de tests (frontend pages + hooks) |
| 57 | Load testing con k6 (endpoints críticos) |
| 58 | Accessibility testing con axe-playwright |
| 59 | Visual regression tests |
| 60 | Documentación operativa completa (runbooks) |

---

## FASE 7 — MÉTRICAS DE LA AUDITORÍA

| Métrica | Valor |
|---------|-------|
| Total de hallazgos (brutos, antes de dedup) | 190 |
| Total de hallazgos únicos (estimado post-dedup) | ~120 |
| Hallazgos CRÍTICOS | 20 |
| Hallazgos ALTOS | 44 |
| Hallazgos MEDIOS | 55 |
| Hallazgos BAJOS | 39 |
| Hallazgos INFO | 32 |
| Módulos backend analizados | 68 |
| Endpoints API catalogados | 350+ |
| Tablas de BD analizadas | 81 |
| Migraciones SQL revisadas | 19 |
| Edge functions revisadas | 14 |
| Páginas frontend analizadas | 62 |
| Hooks frontend analizados | 19 |
| Archivos de test revisados | 66 |
| Casos de test existentes | ~750 |
| Cobertura estimada de testing | ~25% |
| Cobertura estimada de la auditoría | ~85% |
| Tiempo de remediación total estimado | 50-77 días/persona |
| Deuda técnica cuantificada | 50-77 días/persona (~$53.9M COP max) |

---

## FASE 8 — FORTALEZAS DESTACADAS

A pesar de los hallazgos críticos, la plataforma demuestra madurez técnica significativa:

1. **Refresh Token con Detección de Reutilización** — Implementación ejemplar con rotación basada en familia, hash SHA-256, y revocación automática. Nivel enterprise.

2. **Password Hashing con scrypt** — 32-byte salt, 64-byte derived key, timing-safe compare. Correcto.

3. **OpenTelemetry + Prometheus** — Métricas custom de dominio (WebSocket connections, auth attempts, event ingestion). Base sólida para observabilidad.

4. **Code Splitting Completo** — Las 62 páginas usan `React.lazy()`. Bundles de i18n también lazy-loaded.

5. **Offline Support con IndexedDB** — Cache offline de 48h para eventos, mutation queue con auto-sync, detección de conexión lenta.

6. **RBAC Granular con 5 Roles** — Permisos por módulo, overrides por tenant via BD, enforcement server-side + client-side.

7. **WhatsApp Webhook Security** — HMAC-SHA256, timing-safe compare, replay protection, Zod validation, rate limiting dedicado, sanitización de PII.

8. **Arquitectura Multi-Tenant** — Tenant plugin + RLS consistente en 76/81 tablas + cache Redis de 5 minutos.

9. **MCP Bridge con 22 Tools** — Integración AI bien diseñada con rate limiting por tool y 36 tests.

10. **750 Tests Existentes** — Base sólida para expandir cobertura.

---

## FASE 9 — CONCLUSIÓN

La plataforma AION representa un logro técnico significativo: un centro de operaciones de seguridad física completo con 68 módulos backend, 81 tablas de BD, 62 páginas frontend, integraciones con cámaras Hikvision/Dahua, dispositivos IoT eWeLink, PBX Asterisk, reconocimiento facial, LPR, y más.

Sin embargo, la auditoría revela **20 hallazgos CRÍTICOS** que deben resolverse antes de operar con datos reales:

1. **Secretos comprometidos** — la prioridad #1 absoluta es rotar todos los secretos
2. **SQL Injection** — 49 instancias que deben parametrizarse
3. **Control de acceso** — registro abierto, tablas sin RLS, endpoints sin authorization
4. **Datos sensibles** — credenciales en plaintext, biometría sin consentimiento
5. **Infraestructura** — servicios expuestos sin autenticación

La inversión estimada de remediación completa (50-77 días/persona, ~$35-54M COP) es proporcional a la complejidad y criticidad de la plataforma. La remediación de CRÍTICOS (5-7 días) debería ser la primera prioridad inmediata.

**Firma del Agente Director de Auditoría**
Auditoría ejecutada el 2026-04-05 mediante análisis estático completo del código fuente.

---

*Este informe es confidencial y está destinado exclusivamente a Clave Seguridad CTA. La distribución no autorizada está prohibida.*
