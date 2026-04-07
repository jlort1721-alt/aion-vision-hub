# Guia del Desarrollador — AION Vision Hub

**Proyecto:** Clave Seguridad / AION Vision Hub
**Repositorio principal:** github.com/jlort1721-alt/aion-vision-hub
**Branch de trabajo:** `develop`
**Produccion:** https://aionseg.co

---

## 1. Instalacion Local

### 1.1 Requisitos

| Herramienta | Version | Instalacion |
|-------------|---------|-------------|
| Node.js | 20.x | `nvm install 20` |
| pnpm | 9.x | `npm install -g pnpm@9` |
| PostgreSQL | 16 | `brew install postgresql@16` (macOS) |
| Redis | 7.x | `brew install redis` (macOS) |
| Git | 2.x+ | Ya instalado |

### 1.2 Clonar y configurar

```bash
# Clonar repositorio
git clone https://github.com/jlort1721-alt/aion-vision-hub.git
cd aion-vision-hub

# Cambiar a branch de desarrollo
git checkout develop

# Crear tu branch de feature
git checkout -b feature/tu-nombre-feature
```

### 1.3 Instalar dependencias

```bash
# Frontend (raiz del proyecto)
npm install

# Backend (monorepo con pnpm)
cd backend
pnpm install
cd ..
```

### 1.4 Configurar variables de entorno

```bash
# Frontend
cp .env.example .env.local
# Editar .env.local con:
#   VITE_API_URL=http://localhost:3000
#   VITE_SUPABASE_URL=https://oeplpbfikcrcvccimjki.supabase.co
#   VITE_SUPABASE_PUBLISHABLE_KEY=<pedir al lead>

# Backend
cp backend/.env.example backend/.env
# Editar backend/.env con:
#   DATABASE_URL=postgres://aion:aion_dev_password@localhost:5432/aion_dev
#   JWT_SECRET=<generar con: openssl rand -hex 32>
#   CORS_ORIGINS=http://localhost:5173,http://localhost:8080
```

### 1.5 Crear base de datos local

```bash
# Crear DB
createdb aion_dev

# Aplicar migraciones
cd backend/apps/backend-api
npx drizzle-kit push
cd ../../..
```

### 1.6 Levantar el proyecto

```bash
# Terminal 1: Frontend (puerto 8080)
npm run dev

# Terminal 2: Backend (puerto 3000)
cd backend
pnpm run dev:api
```

### 1.7 Verificar que funciona

```bash
# Frontend
open http://localhost:8080

# Backend health
curl http://localhost:3000/health/ready

# TypeScript check
npm run typecheck

# Tests
npm test
```

---

## 2. Estructura del Proyecto

```
open-view-hub-main/
├── src/                          # Frontend React
│   ├── components/               # 258+ componentes (shadcn/ui + custom)
│   │   ├── ui/                   # Primitivos Radix UI (button, card, etc.)
│   │   ├── shared/               # ErrorBoundary, EmptyState
│   │   ├── ai/                   # AIONFloatingAssistant
│   │   └── ...                   # Por feature
│   ├── pages/                    # 68 paginas (una por ruta)
│   ├── services/                 # API clients (*-api.ts)
│   ├── hooks/                    # 87 hooks custom
│   ├── types/                    # TypeScript types
│   ├── contexts/                 # Auth, Branding, I18n
│   ├── i18n/                     # es.ts, en.ts
│   └── lib/                      # api-client.ts, utils.ts
│
├── backend/                      # Backend monorepo
│   ├── apps/
│   │   └── backend-api/src/
│   │       ├── modules/          # 76 modulos (routes + service + schemas)
│   │       ├── db/schema/        # Drizzle ORM schemas
│   │       ├── db/migrations/    # SQL migrations
│   │       ├── services/         # 42 servicios (integraciones externas)
│   │       ├── workers/          # 8 workers (automation, backup, etc.)
│   │       ├── plugins/          # auth, audit, websocket, rate-limit
│   │       ├── middleware/       # error-handler, rate-limiter
│   │       ├── config/           # env.ts (validacion Zod)
│   │       └── __tests__/        # 36 test files
│   └── packages/
│       ├── shared-contracts/     # Types compartidos
│       ├── common-utils/         # Crypto, logging
│       └── device-adapters/      # Hikvision, Dahua, ONVIF
│
├── .claude/                      # Skills, agentes, comandos (AI-assisted dev)
├── .github/workflows/            # CI/CD (6 workflows)
├── scripts/                      # 31 scripts de mantenimiento
├── deploy/                       # Configs de deploy
├── CLAUDE.md                     # Instrucciones maestras (207 lineas)
├── MANUAL_PLATAFORMA.md          # Manual completo (546 lineas)
└── package.json                  # Frontend dependencies
```

---

## 3. Workflow de Desarrollo

### 3.1 Flujo Git

```
main (produccion — NO hacer push directo)
  └── develop (integracion — merges via PR)
        ├── feature/nombre-feature    (tu trabajo)
        ├── fix/nombre-bug            (bug fixes)
        └── refactor/nombre           (refactoring)
```

### 3.2 Proceso diario

```bash
# 1. Actualizar develop
git checkout develop
git pull origin develop

# 2. Crear/continuar tu feature branch
git checkout -b feature/mi-feature
# o si ya existe:
git checkout feature/mi-feature
git rebase develop

# 3. Desarrollar (hacer cambios)
# ... editar archivos ...

# 4. Verificar antes de commit
npm run typecheck              # 0 errores obligatorio
npm test                       # Tests deben pasar
cd backend && pnpm run typecheck  # Backend tambien

# 5. Commit (mensajes convencionales)
git add -A
git commit -m "feat(modulo): descripcion corta"

# 6. Push
git push origin feature/mi-feature

# 7. Crear Pull Request en GitHub
#    Base: develop
#    Compare: feature/mi-feature
```

### 3.3 Convenciones de commit

```
feat(modulo): nueva funcionalidad
fix(modulo): correccion de bug
refactor(modulo): refactoring sin cambiar comportamiento
docs(modulo): cambios en documentacion
test(modulo): agregar o modificar tests
chore(modulo): tareas de mantenimiento
perf(modulo): optimizacion de rendimiento
```

### 3.4 Verificaciones obligatorias antes de PR

```bash
# Debe pasar TODO esto:
npm run typecheck                # Frontend TS
npm run build                    # Frontend build
npm test                         # Frontend tests
cd backend && pnpm run typecheck # Backend TS
cd backend && pnpm run build     # Backend build
cd backend && pnpm run test      # Backend tests
```

---

## 4. Credenciales del Proyecto

### 4.1 Desarrollo local (usa estos valores)

| Variable | Valor desarrollo |
|----------|-----------------|
| `DATABASE_URL` | `postgres://aion:aion_dev_password@localhost:5432/aion_dev` |
| `JWT_SECRET` | Generar: `openssl rand -hex 32` |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:8080` |
| `VITE_API_URL` | `http://localhost:3000` |
| `VITE_SUPABASE_URL` | `https://oeplpbfikcrcvccimjki.supabase.co` |

### 4.2 Produccion (solo en VPS — NO en repo)

**NUNCA commitear secretos de produccion.** Todas las credenciales de produccion estan en el VPS:
```bash
ssh -i clave-demo-aion.pem ubuntu@18.230.40.6
cat /var/www/aionseg/backend/apps/backend-api/.env
```

| Servicio | Donde obtener |
|----------|---------------|
| OpenAI API Key | platform.openai.com/api-keys |
| Anthropic API Key | console.anthropic.com/settings/keys |
| ElevenLabs API Key | elevenlabs.io/settings/api-keys |
| Twilio SID/Token | console.twilio.com |
| Resend API Key | resend.com/api-keys |
| Telegram Bot Token | @BotFather en Telegram |
| eWeLink App ID | dev.ewelink.cc |

### 4.3 Supabase

| Campo | Valor |
|-------|-------|
| Project ref | oeplpbfikcrcvccimjki |
| URL | https://oeplpbfikcrcvccimjki.supabase.co |
| Anon Key | Pedir al lead del proyecto |
| Dashboard | supabase.com/dashboard (login con GitHub) |

---

## 5. Como Desarrollar en Cada Area

### 5.1 Nueva pagina frontend

```bash
# 1. Crear archivo en src/pages/
touch src/pages/MiNuevaPagina.tsx

# 2. Estructura base:
```

```tsx
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function MiNuevaPagina() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['mi-recurso'],
    queryFn: () => apiClient.get('/mi-endpoint'),
  });

  if (isLoading) return <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (isError) return <div className="p-6 text-center text-destructive">Error al cargar. <button onClick={() => refetch()}>Reintentar</button></div>;
  if (!data?.length) return <EmptyState icon={Loader2} title="Sin datos" description="No hay registros" />;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Mi Pagina</h1>
      {/* Contenido */}
    </div>
  );
}
```

```bash
# 3. Agregar ruta en src/App.tsx
# <Route path="/mi-pagina" element={<MiNuevaPagina />} />

# 4. UI en ESPANOL, codigo en INGLES
```

### 5.2 Nuevo modulo backend

```bash
# 1. Crear directorio
mkdir -p backend/apps/backend-api/src/modules/mi-modulo

# 2. Crear 3 archivos:
```

**schemas.ts:**
```typescript
import { z } from 'zod';

export const createMiRecursoSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export type CreateMiRecursoInput = z.infer<typeof createMiRecursoSchema>;
```

**service.ts:**
```typescript
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { miTabla } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';

export class MiModuloService {
  async list(tenantId: string) {
    return db.select().from(miTabla).where(eq(miTabla.tenantId, tenantId));
  }
  
  async create(data: CreateMiRecursoInput, tenantId: string) {
    const [row] = await db.insert(miTabla).values({ ...data, tenantId }).returning();
    return row;
  }
}

export const miModuloService = new MiModuloService();
```

**routes.ts:**
```typescript
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { requireRole } from '../../plugins/auth.js';
import { miModuloService } from './service.js';
import { createMiRecursoSchema } from './schemas.js';

async function routes(app: FastifyInstance) {
  app.get('/', { preHandler: [requireRole('operator')] }, async (request) => {
    const data = await miModuloService.list(request.tenantId);
    return { success: true, data };
  });

  app.post('/', { preHandler: [requireRole('tenant_admin')] }, async (request, reply) => {
    const body = createMiRecursoSchema.parse(request.body);
    const data = await miModuloService.create(body, request.tenantId);
    await request.audit('mi-modulo.create', 'mi-modulo', data.id, data as Record<string, unknown>);
    return reply.code(201).send({ success: true, data });
  });
}

export default fp(routes, { name: 'mi-modulo-routes', dependencies: ['auth'] });
```

```bash
# 3. Registrar en app.ts
# import registerMiModuloRoutes from './modules/mi-modulo/routes.js';
# await app.register(registerMiModuloRoutes, { prefix: '/mi-modulo' });

# 4. Crear test
# backend/apps/backend-api/src/__tests__/mi-modulo.test.ts
```

### 5.3 Agregar un MCP Tool

```bash
# Editar: backend/apps/backend-api/src/modules/mcp-bridge/tools/
# Agregar tool en el archivo de categoria correspondiente
# Registrar en tools/index.ts
```

### 5.4 Crear una regla de automatizacion

Las reglas se crean desde el frontend (`/automation`) o via API:
```bash
curl -X POST https://aionseg.co/api/automation/rules \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi regla",
    "trigger": { "type": "event", "eventType": "motion" },
    "conditions": [{ "field": "severity", "operator": "eq", "value": "critical" }],
    "actions": [
      { "type": "send_alert", "config": { "recipients": ["admin@empresa.com"] } },
      { "type": "execute_mcp_tool", "config": { "toolName": "create_incident", "params": {} } }
    ],
    "cooldownMinutes": 5,
    "isActive": true
  }'
```

---

## 6. Plan de 30 Dias — Objetivos y Tareas

### Semana 1 (Dias 1-7): Onboarding + Quick Wins

| # | Tarea | Prioridad | Tiempo | Verificacion |
|---|-------|:---------:|:------:|-------------|
| 1 | Instalar proyecto local, correr frontend + backend | CRITICA | 2h | `localhost:8080` carga, API responde |
| 2 | Leer CLAUDE.md + MANUAL_PLATAFORMA.md completos | CRITICA | 1h | Entender arquitectura |
| 3 | Eliminar `as any` en 5 archivos criticos de `src/components/` | ALTA | 4h | `grep -c "as any" src/` disminuye |
| 4 | Agregar EmptyState a 10 paginas que faltan | ALTA | 3h | Paginas muestran estado vacio |
| 5 | Agregar i18n (useI18n) a 5 paginas sin traduccion | MEDIA | 3h | Strings en es.ts/en.ts |
| 6 | Escribir 3 tests backend para modulos sin coverage | MEDIA | 4h | `pnpm test` pasa |
| 7 | Primer PR a develop | CRITICA | 30min | PR mergeado |

### Semana 2 (Dias 8-14): Mejoras de UX + Performance

| # | Tarea | Prioridad | Tiempo | Verificacion |
|---|-------|:---------:|:------:|-------------|
| 8 | Responsive en 10 paginas sin breakpoints | ALTA | 6h | Viewport 375px funciona |
| 9 | Accesibilidad: aria-label en botones icon-only | ALTA | 4h | `eslint-plugin-jsx-a11y` sin warnings |
| 10 | Lazy loading de paginas pesadas (Immersive3D, PhonePanel) | MEDIA | 3h | Bundle size reducido |
| 11 | Agregar skeleton loaders a 5 paginas | MEDIA | 3h | Loading states profesionales |
| 12 | Optimizar queries backend: cameras service | ALTA | 4h | Query builder dinamico, no SQL inline |
| 13 | Completar service.ts para 3 modulos stub | MEDIA | 6h | Modulos con CRUD completo |
| 14 | PR semanal a develop | CRITICA | 30min | PR mergeado |

### Semana 3 (Dias 15-21): Nuevas Features + Integraciones

| # | Tarea | Prioridad | Tiempo | Verificacion |
|---|-------|:---------:|:------:|-------------|
| 15 | Dashboard mejorado: widget de camaras offline | ALTA | 4h | Widget muestra count real |
| 16 | Mapa interactivo con Leaflet (GPS de sitios) | MEDIA | 8h | Mapa en /sites con markers |
| 17 | Portal de residentes mejorado (/portal/:siteCode) | MEDIA | 6h | Residentes ven info de su unidad |
| 18 | Notificaciones push: trigger desde automation | ALTA | 4h | Push llega al suscribirse |
| 19 | Exportacion PDF mejorada (logo AION, tablas) | MEDIA | 4h | PDF descargable profesional |
| 20 | 5 tests E2E con Playwright (flujos criticos) | ALTA | 6h | Tests pasan en CI |
| 21 | PR semanal a develop | CRITICA | 30min | PR mergeado |

### Semana 4 (Dias 22-30): Hardening + Deploy

| # | Tarea | Prioridad | Tiempo | Verificacion |
|---|-------|:---------:|:------:|-------------|
| 22 | Reducir `as any` a menos de 100 en todo el proyecto | ALTA | 8h | `grep -c "as any" src/` < 100 |
| 23 | Test coverage backend > 40% | ALTA | 8h | `pnpm test:coverage` > 40% |
| 24 | Rate limiting por endpoint (no solo global) | MEDIA | 4h | Auth: 5/min, write: 30/min |
| 25 | Documentar 5 endpoints con OpenAPI inline | MEDIA | 3h | /api/docs muestra endpoints |
| 26 | Circuit breaker para OpenAI/Twilio | MEDIA | 4h | Servicios degradan gracefully |
| 27 | Smoke tests automaticos post-deploy | ALTA | 3h | Script verifica endpoints |
| 28 | Deploy a produccion via PR main | CRITICA | 2h | aionseg.co actualizado |
| 29 | Documentar cambios en CHANGELOG.md | MEDIA | 1h | Cambios registrados |
| 30 | Retrospectiva: que funciono, que mejorar | - | 1h | Doc de aprendizajes |

---

## 7. Comandos de Referencia Rapida

```bash
# ── Desarrollo ──
npm run dev                          # Frontend dev server (:8080)
cd backend && pnpm run dev:api       # Backend dev server (:3000)

# ── Verificacion ──
npm run typecheck                    # Frontend TypeScript
npm run build                        # Frontend build
npm test                             # Frontend tests
cd backend && pnpm run typecheck     # Backend TypeScript
cd backend && pnpm run build         # Backend build (turbo)
cd backend && pnpm run test          # Backend tests

# ── Base de datos ──
cd backend/apps/backend-api
npx drizzle-kit generate             # Generar migracion SQL
npx drizzle-kit push                 # Aplicar migraciones

# ── Git ──
git checkout develop                 # Branch de trabajo
git pull origin develop              # Actualizar
git checkout -b feature/xxx          # Crear feature
git push origin feature/xxx          # Push feature
# Crear PR en GitHub: feature/xxx → develop

# ── Produccion (VPS) ──
ssh -i clave-demo-aion.pem ubuntu@18.230.40.6
pm2 status                           # Ver servicios
pm2 restart all                      # Reiniciar todo
pm2 logs aionseg-api --lines 50      # Ver logs
curl localhost:3001/health/ready     # Health check
```

---

## 8. Reglas del Proyecto

### OBLIGATORIAS

1. **TypeScript strict** — `npx tsc --noEmit` debe dar 0 errores
2. **No `any`** — usar tipos especificos o `unknown` + type guard
3. **UI en espanol** — todo texto visible al usuario en espanol
4. **Codigo en ingles** — variables, funciones, comentarios en ingles
5. **No secrets en repo** — credenciales solo en .env (NO commitear)
6. **Tests para modulos nuevos** — minimo happy path + error case
7. **shadcn/ui + Tailwind** — no CSS custom, no styled-components
8. **apiClient** — no llamadas directas a fetch/axios/supabase.from()
9. **requireRole()** — en todas las rutas protegidas
10. **request.audit()** — en todas las mutaciones

### PROHIBIDAS

1. ❌ Push directo a `main` (solo via PR desde develop)
2. ❌ `console.log` en produccion (usar logger del backend)
3. ❌ `supabase.from()` en frontend (usar apiClient)
4. ❌ CSS inline extenso (usar Tailwind classes)
5. ❌ Commit con tests fallando
6. ❌ Merge sin aprobacion de PR

---

## 9. Recursos

| Recurso | Ubicacion |
|---------|-----------|
| Manual completo | `MANUAL_PLATAFORMA.md` |
| Instrucciones IA | `CLAUDE.md` |
| Plan de mejoras | `PLAN_MEJORAS_AIONSEG.md` |
| Informe de seguridad | `SECURITY_REPORT.md` |
| Guia de migracion | `MIGRATION_GUIDE.md` |
| Config DVR/NVR | `GUIA_CONFIGURACION_DISPOSITIVOS.md` |
| Config Asterisk | `GUIA_CONFIGURACION_ASTERISK.md` |
| Config Dahua | `GUIA_IMPLEMENTACION_DAHUA_COMPLETA.md` |
| Skills AI | `.claude/skills/` (32 skills) |
| Agentes AI | `.claude/agents/` (10 agentes) |

---

## 10. Contacto

- **Repo principal:** github.com/jlort1721-alt/aion-vision-hub
- **Repo produccion:** github.com/jlort1721-alt/aionseg-platform
- **VPS produccion:** 18.230.40.6 (SSH con clave PEM)
- **Dominio:** aionseg.co
- **n8n:** http://18.230.40.6:5678

---

*Documento generado el 7 de abril de 2026 — AION Vision Hub v1.0*
