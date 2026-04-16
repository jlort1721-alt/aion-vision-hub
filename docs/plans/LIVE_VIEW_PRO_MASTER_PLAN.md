# LIVE VIEW PROFESIONAL — Plan Maestro de Implementación

**Objetivo único**: Unificar en `/live-view` todo el control operativo (video, citofonía, acceso, IoT, IA, mapa) con performance profesional (100+ cámaras, sub-1s latencia, cero saturación IMOU, bbox IA en tiempo real).

**Principio ejecución**: Fases secuenciales con gates de verificación. Cada fase tiene agentes asignados. Autorización explícita del usuario entre fases. Ningún ítem se omite.

---

## FASE 0 — Baseline y Preparación

**Propósito**: Asegurar estado reproducible, capturar métricas actuales, preparar infraestructura.

### Agentes
- `monitor-observe` (medición baseline)
- `architect` (revisión técnica)
- `doc-updater` (snapshot inicial)

### Tareas

**0.1 Captura baseline de performance (monitor-observe)**
- Medir FPS actual en `/live-view` con 16 y 25 cámaras
- Latencia end-to-end video (RTSP→browser)
- Uso memoria browser por tile
- CPU go2rtc, memoria PM2 `imou-live-server`
- Documentar en `docs/plans/baseline-20260415.md`

**0.2 Verificar dependencias instaladas (build-error-resolver)**
- Validar en `package.json`: `hls.js`, `@tanstack/react-query`, `zustand`, `lucide-react`
- Agregar: `react-window@1.8.11`, `@types/react-window`, `react-virtualized-auto-sizer`
- Ejecutar `pnpm install` + `pnpm --filter @aion/backend-api test` para confirmar build limpio

**0.3 Preparar feature flags (planner)**
- Crear `src/lib/feature-flags.ts` con:
  - `LIVE_VIEW_VIRTUALIZATION`
  - `LIVE_VIEW_AI_OVERLAY`
  - `LIVE_VIEW_IMOU_ONDEMAND`
  - `LIVE_VIEW_PTZ_INLINE`
  - `LIVE_VIEW_CONTEXT_PANEL`
  - `LIVE_VIEW_FLOOR_PLAN`
  - `LIVE_VIEW_SCENE_COMPOSER`
  - `LIVE_VIEW_AI_COPILOT`
  - `LIVE_VIEW_RECORDING`
- Todas default `false`. Se activan incrementalmente por fase.

**0.4 Infra VPS (deploy-rollback + monitor-observe)**
- Aumentar `IMOU_LIVE_MAX=20` en `/etc/systemd/system/pm2-ubuntu.service` env (via pm2 restart con env)
- Habilitar `hardware=vaapi` en `/etc/go2rtc/go2rtc.yaml` sección `ffmpeg` si GPU disponible; sino dejar `hardware=none`
- Validar TURN server: instalar `coturn` con config mínima en `/etc/turnserver.conf` para Fase 3 (two-way audio)
- Crear backup `/etc/go2rtc/go2rtc.yaml.bak.preFase0.<ts>`

**0.5 Branch strategy (planner)**
- Crear branch `feat/live-view-pro` desde `main`
- Sub-branches por fase: `feat/lv-phase-1-fluidity`, `feat/lv-phase-2-ai-overlay`, etc.
- Merge a `feat/live-view-pro` tras cada fase aprobada; merge final a `main` tras Fase 5

### Gate de verificación Fase 0
- [ ] Baseline documentado con números reales
- [ ] `pnpm build` verde en backend + frontend
- [ ] Feature flags desplegados, toggleables desde admin
- [ ] VPS estable post-ajustes (go2rtc active, pm2 25 services online)
- [ ] Branch base creado

---

## FASE 1 — Fundación de Fluidez

**Propósito**: Video fluido a escala. Desbloquear grids grandes. Limpiar `LiveViewPage.tsx`.

### Agentes
- `architect` (diseño de hooks + virtualization strategy)
- `module-scaffold` (nuevos archivos)
- `tdd-guide` (tests primero)
- `code-reviewer` (post-implementación)
- `perf-profiler` (medición post-cambio)

### Tareas

**1.1 Hook `useImouLive` (module-scaffold + tdd-guide)**
- Archivo: `src/hooks/useImouLive.ts`
- API:
  ```ts
  function useImouLive(params: { serial: string; channel: number; streamId?: 0 | 1; enabled?: boolean })
    : { proxyUrl: string | null; status: 'idle'|'binding'|'ready'|'error'; error?: string; rebind: () => void }
  ```
- Llama `POST /imou-live/bind` al mount (si enabled)
- Llama `DELETE /imou-live/unbind/<token>` al unmount o cambio de deps
- Re-bind automático si el servidor responde 404 durante HLS (sesión expirada)
- Abort via `AbortController` si desmonta antes de completar bind
- Tests: `src/hooks/__tests__/useImouLive.test.ts` (mock fetch, cubrir idle/success/error/unmount)

**1.2 Hook `useCameraStream` unificador (architect + module-scaffold)**
- Archivo: `src/hooks/useCameraStream.ts`
- Decide protocolo según `device.vendor` y capability:
  - IMOU → `useImouLive` (HLS proxy)
  - Hikvision/ONVIF → WebSocket MSE go2rtc (`/go2rtc/api/ws?src=...`)
  - Fallback → JPEG snapshot polling
- Expone `{ src, protocol, latencyMs, retry }`
- Tests para cada rama

**1.3 Hook `useVirtualCameraGrid` (architect + module-scaffold)**
- Archivo: `src/hooks/useVirtualCameraGrid.ts`
- Wrapper sobre `FixedSizeGrid` de `react-window`
- Configura:
  - `columnCount` según `gridSize` (1, 2, 3, 4, 5, 6, 7, 8)
  - `rowHeight` dinámico según container
  - `overscanRowCount={1}` para prebuffer
- Integra `onItemsRendered` para mantener compatibilidad con `useIntersectionVideo`
- Tests con React Testing Library + resize mock

**1.4 Refactor `SmartCameraCell.tsx` para consumir `useCameraStream`**
- Archivo: `src/components/video/SmartCameraCell.tsx`
- Reemplazar construcción manual de `wsUrl` por `useCameraStream(device)`
- Añadir prop `streamQuality: 'main' | 'sub'` (default `'sub'` para grids >= 4×4)
- Exponer `onLatencyChange?(ms: number)` para Context Panel
- Verificar MAX_CONCURRENT_STREAMS sigue vigente pero ahora como cap de decoders MSE (no HLS)

**1.5 Extraer `CameraGrid.tsx` de `LiveViewPage.tsx`**
- Archivo: `src/components/liveview/CameraGrid.tsx`
- Props: `cameras`, `gridSize`, `onCellClick`, `selectedCameraId`
- Usa `useVirtualCameraGrid`
- Mantiene drag-and-drop de reordenamiento (actual en LiveViewPage)
- Tests: render con 4, 16, 64, 100 cámaras

**1.6 Quality selector + latency badge (module-scaffold)**
- Overlay en `SmartCameraCell`: badge pequeño top-right con `HD | SD`, click alterna
- Badge latencia bottom-right: verde <500ms, amarillo <1500ms, rojo >1500ms
- Persistir elección por `camera_id` en `localStorage` vía `zustand` store `useLiveViewPreferencesStore`

**1.7 Toggle de feature flag (planner)**
- En admin panel, al activar `LIVE_VIEW_VIRTUALIZATION` el `CameraGrid` pasa por `FixedSizeGrid`; sino renderiza el `.map()` original
- Permite rollback instantáneo sin deploy

**1.8 Tests E2E Fase 1 (e2e-runner)**
- Playwright: `tests/e2e/live-view-phase1.spec.ts`
  - Abre `/live-view` con grid 4×4
  - Verifica 16 tiles montados
  - Cambia a 8×8 → 64 tiles virtualizados
  - Click en quality toggle → verifica request a `/imou-live/bind` con `streamId` correcto
  - Scroll del grid → verifica tiles fuera de viewport se desmontan (via data-testid count)

**1.9 Perf profiling post-cambio (perf-profiler)**
- Lighthouse sobre `/live-view` con 64 cámaras
- Chrome DevTools Performance: tiempo de scroll, memoria heap, long tasks
- Reporte `docs/plans/phase1-perf.md` vs baseline Fase 0

### Gate Fase 1
- [ ] 64 cámaras simultáneas con FPS >30
- [ ] IMOU Dahua: 15+ streams simultáneos (vs 7-8 actual)
- [ ] Memoria browser <2GB con 64 tiles
- [ ] Tests Vitest >85% sobre hooks nuevos
- [ ] Playwright golden path verde
- [ ] Feature flag activado en staging, admin puede togglear
- [ ] 0 regresiones en camera view single (grid 1×1)

---

## FASE 2 — Capa de IA Visual

**Propósito**: Hacer visibles las detecciones IA existentes. Timeline de eventos por tile. PTZ inline.

### Agentes
- `architect` (canvas + WebSocket channel design)
- `module-scaffold`
- `tdd-guide`
- `api-docs-generator` (endpoint `/events/density`)
- `perf-profiler` (60fps overlay)

### Tareas

**2.1 Hook `useDetectionStream` (architect + module-scaffold)**
- Archivo: `src/hooks/useDetectionStream.ts`
- Suscribe al canal WebSocket `live-view-events` (ya existe en `plugins/websocket.ts`)
- Filtra por `camera_id`
- Retorna `{ detections: Array<{ id, bbox, label, confidence, ts, ttlMs }> }`
- TTL: remueve detecciones >3s de antigüedad (coalesced en `requestAnimationFrame`)
- Soporta backpressure: si >100 detecciones/s, descarta intermedias

**2.2 Componente `DetectionOverlay.tsx` (module-scaffold)**
- Archivo: `src/components/liveview/DetectionOverlay.tsx`
- Props: `detections`, `videoWidth`, `videoHeight`, `tileWidth`, `tileHeight`
- Canvas 2D absoluto sobre `<video>` con `pointer-events: none`
- Dibuja bbox: rectángulo + label top-left ("Persona 94%")
- Color por clase: `person=blue`, `vehicle=yellow`, `weapon=red`, `intrusion=red`, `other=gray`
- Fade-out: opacity interpolada según `age / ttlMs`
- Redraw sólo en `requestAnimationFrame` y solo si hay cambios (dirty flag)

**2.3 Integrar `DetectionOverlay` en `SmartCameraCell`**
- Renderiza overlay cuando `feature_flag.LIVE_VIEW_AI_OVERLAY` activo
- Toggle per-tile: usuario puede ocultar bbox en su cámara (pref persistida en `useLiveViewPreferencesStore`)

**2.4 Endpoint `GET /events/density` (module-scaffold + api-docs-generator)**
- Archivo: `backend/apps/backend-api/src/modules/events/routes.ts` (añadir route)
- Signature:
  ```ts
  GET /events/density?camera_id=UUID&window_min=60&bucket_sec=60
  → { buckets: Array<{ ts: ISO8601, count: number, severity_max: string }> }
  ```
- SQL: `date_trunc` sobre `events.created_at`, group by bucket, max(severity)
- Usa RLS automáticamente
- Test integración: `modules/events/__tests__/density.test.ts`

**2.5 Componente `EventTimelineSparkline.tsx` (module-scaffold)**
- Archivo: `src/components/liveview/EventTimelineSparkline.tsx`
- Width: 100%, height: 24px
- Render inline SVG (no canvas, es pequeño)
- Color por bucket según `severity_max`: gris(info)→azul(low)→amarillo(medium)→naranja(high)→rojo(critical)
- Hover muestra tooltip con count + timestamp
- Click emite `onTimestampClick(ts)` para handover a playback

**2.6 Integrar sparkline en `SmartCameraCell` (bottom overlay)**
- Se muestra bajo el video cuando la cámara está seleccionada o en hover prolongado (>500ms)
- Fetch vía `useQuery(['events-density', camera_id], ...)` con `staleTime: 30s`

**2.7 PTZ inline (module-scaffold)**
- Archivo: `src/components/liveview/PtzInlineControl.tsx` (wrapper sobre `PTZJoystick`)
- Detecta `device.capabilities.ptz === true` (añadir campo si no existe en `devices.metadata`)
- Botón en tile overlay bottom-right → abre Popover con joystick + presets (1-9)
- Endpoint `POST /reverse/sessions/:sessionId/ptz` reusado
- Si no hay sesión, crea una transparente vía `POST /reverse/sessions`

**2.8 Migración 031 — ampliar `devices.metadata` (db-migration)**
- `backend/apps/backend-api/src/db/migrations/031_device_capabilities.sql`:
  ```sql
  ALTER TABLE devices ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '{}'::jsonb;
  CREATE INDEX IF NOT EXISTS idx_devices_capabilities_ptz ON devices ((capabilities->>'ptz'));
  ```
- Job de backfill: para devices ONVIF, llamar `GetCapabilities` SOAP y poblar `ptz`, `audio_io`, `motion_detection`
- Validar con db-migration agent (sin DROP, sin NOT NULL sin default)

**2.9 Tests E2E Fase 2 (e2e-runner)**
- Playwright: click PTZ → popover abre → joystick envía request → response 200
- Simula evento WS → verifica bbox aparece en tile correcto → desaparece tras 3s
- Sparkline: fetch mock con 3 eventos → verifica 3 barras en SVG

**2.10 Perf profiling 60fps (perf-profiler)**
- Medir FPS overlay con 16 cámaras cada una recibiendo 5 det/s
- Si <55fps, optimizar: reusar canvas context, reducir precisión de float, etc.

### Gate Fase 2
- [ ] Bbox IA visibles en grid con 16+ cámaras
- [ ] Sparkline renderiza con datos reales de eventos
- [ ] PTZ inline funciona en al menos 1 Hikvision y 1 Dahua
- [ ] 60fps sostenido en overlay con 4×4
- [ ] Endpoint `/events/density` con test integration
- [ ] Migration 031 aplicada sin errores

---

## FASE 3 — Unificación de Control

**Propósito**: Panel de contexto per-cámara. Mapping explícito. Two-way audio.

### Agentes
- `architect` (diseño del panel + mapping strategy)
- `db-migration` (migración camera_links)
- `module-scaffold`
- `integration-tester` (cross-module flows)
- `security-reviewer` (two-way audio + ARI)

### Tareas

**3.1 Migración 032 — `camera_links` (db-migration)**
- Archivo: `backend/apps/backend-api/src/db/migrations/032_camera_links.sql`
  ```sql
  CREATE TABLE camera_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    camera_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    linked_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL CHECK (link_type IN ('intercom','door','iot_relay','sensor')),
    priority INT NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (camera_id, linked_device_id, link_type)
  );
  CREATE INDEX idx_camera_links_camera ON camera_links(camera_id);
  CREATE INDEX idx_camera_links_tenant ON camera_links(tenant_id);
  ALTER TABLE camera_links ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON camera_links USING (tenant_id = current_tenant_id());
  ```
- Drizzle schema: `db/schema/camera-links.ts`
- Exportar en `db/schema/index.ts`

**3.2 Módulo backend `camera-links` (module-scaffold)**
- Ruta: `backend/apps/backend-api/src/modules/camera-links/`
- Endpoints:
  - `GET /camera-links/:cameraId` → lista dispositivos linkeados con info enriquecida (name, type, status)
  - `POST /camera-links` → crea link (role ≥ supervisor)
  - `DELETE /camera-links/:id` → elimina
- Schemas Zod en `schemas.ts`
- Service usa Drizzle + join con `devices`
- Audit logs en cada mutación

**3.3 UI admin para mapping (module-scaffold)**
- Archivo: `src/pages/admin/CameraLinksPage.tsx`
- Tabla editable: por cámara muestra links actuales + botón "Agregar link"
- Multi-select de dispositivos compatibles por `link_type`
- Persistencia via API

**3.4 Servicio frontend `camera-links-api.ts` (module-scaffold)**
- Archivo: `src/services/camera-links-api.ts`
- React Query hooks: `useCameraLinks(cameraId)`, `useCreateLink`, `useDeleteLink`

**3.5 Componente `CameraContextPanel.tsx` (architect + module-scaffold)**
- Archivo: `src/components/liveview/CameraContextPanel.tsx`
- Tabs: `Acceso | Citofonía | IoT | Eventos | Personas | Acciones`
- **Acceso**: Lista puertas linkeadas → botón "Abrir" (reusa `deviceControlApi.openGate`); log de últimos 10 accesos de la cámara
- **Citofonía**: Si hay intercom linkeado → botón "📞 Llamar" + `IntercomPushToTalk` embebido
- **IoT**: Lista relays/sensores linkeados → toggles; estado en vivo via canal `devices`
- **Eventos**: Últimos 30 eventos de la cámara con thumbnail (usa `/events?camera_id=X`)
- **Personas**: Últimas personas detectadas (join `camera_detections` + `access_people`)
- **Acciones**: Botones rápidos → ejecutar `automation_rules` aplicables a esta cámara
- Prop `cameraId: string | null`; si null, muestra placeholder

**3.6 Integrar panel en `LiveViewPage`**
- Reemplaza panel derecho actual (Events + DoorControl + RelayPanel) por `<CameraContextPanel cameraId={selectedCameraId} />`
- Mantiene tabs antiguas como fallback si feature flag off

**3.7 Two-way audio — TURN + signaling (security-reviewer + module-scaffold)**
- Validar `coturn` instalado en VPS (Fase 0.4)
- Backend nuevo endpoint `POST /intercom/push-to-talk/:deviceId`:
  - Autentica (role ≥ operator)
  - Crea bridge Asterisk ARI entre el SIP del intercom y un SIP dinámico (webrtc-gateway)
  - Retorna `iceServers` + `sipUri` para que browser use `JsSIP`
- Rate limit 5/min por user

**3.8 Componente `IntercomPushToTalk.tsx` (module-scaffold)**
- Archivo: `src/components/liveview/IntercomPushToTalk.tsx`
- Estados: `idle | connecting | talking | ended | error`
- Usa `JsSIP` (instalar `jssip@3.10.x`)
- Botón "🎙️ Mantener para hablar" (push-to-talk) o toggle continuo
- Muestra waveform del mic local con `AnalyserNode`
- Al soltar → cierra SIP session → `DELETE /intercom/push-to-talk/:sessionId`

**3.9 Tests integration flow (integration-tester)**
- `backend/apps/backend-api/src/__tests__/integration/camera-context.test.ts`:
  - Crea cámara + intercom + door
  - Link los tres vía `/camera-links`
  - Fetch `/camera-context/:cameraId` → valida respuesta completa
  - Abre puerta → audit log persistido
  - Inicia intercom call → session creada

**3.10 Tests E2E Fase 3 (e2e-runner)**
- Click en cámara → panel abre con tabs populated
- Click "Abrir" en puerta linkeada → confirma toast + log aparece
- Push-to-talk: permite mic → habla → soltar → session cierra

### Gate Fase 3
- [ ] Migration 032 aplicada en staging
- [ ] Panel muestra datos reales de al menos 3 cámaras con links completos
- [ ] Two-way audio end-to-end: Asterisk ARI + browser ICE + TURN
- [ ] Security review passed (no leak de SIP creds al frontend, TURN auth rotada)
- [ ] E2E verde

---

## FASE 4 — Profesionalización UX

**Propósito**: Floor plan interactivo, Scene Composer, AI Copilot.

### Agentes
- `architect` (scene composer state machine)
- `module-scaffold`
- `tdd-guide`
- `integration-tester` (AI copilot + automation-engine)

### Tareas

**4.1 Componente `FloorPlanView.tsx` (module-scaffold)**
- Archivo: `src/components/liveview/FloorPlanView.tsx`
- Fetch: `GET /floor-plans/:siteId` (crear si no existe) + `GET /floor-plan-positions?site_id=X`
- Renderiza imagen de fondo (cloudinary/R2) + íconos de cámara posicionados absolutos
- Colores en vivo:
  - Verde = online + sin eventos recientes
  - Amarillo = evento hace <5min (medium/high)
  - Rojo pulsante = evento crítico <60s
  - Gris = offline
- Suscribe canal `events` WebSocket para updates
- Click ícono → selecciona cámara en grid (actualiza `selectedCameraId`)
- Modo edit (role ≥ supervisor): drag para re-posicionar, `PUT /floor-plan-positions/:id`

**4.2 Backend `floor-plans` routes (module-scaffold si faltan)**
- Validar endpoints existen; si no, crear en `modules/floor-plans/`:
  - `GET /floor-plans/:siteId`
  - `POST /floor-plans/upload` (multipart, guarda en storage)
  - `GET /floor-plan-positions?site_id=...`
  - `PUT /floor-plan-positions/:id`

**4.3 Migración 033 — `user_scenes` (db-migration)**
- Archivo: `backend/apps/backend-api/src/db/migrations/033_user_scenes.sql`
  ```sql
  CREATE TABLE user_scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    layout JSONB NOT NULL,
    is_shared BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_user_scenes_tenant_user ON user_scenes(tenant_id, user_id);
  ALTER TABLE user_scenes ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON user_scenes USING (tenant_id = current_tenant_id());
  CREATE POLICY user_own_or_shared ON user_scenes
    USING (user_id = current_user_id() OR is_shared = true);
  ```

**4.4 Componente `SceneComposer.tsx` (architect + module-scaffold)**
- Archivo: `src/components/liveview/SceneComposer.tsx`
- Drag-and-drop (`react-dnd` o `@dnd-kit/core`) de widgets:
  - `CameraTileWidget` (reusa SmartCameraCell)
  - `DoorButtonWidget`
  - `IntercomButtonWidget`
  - `IotToggleWidget`
  - `EventsListWidget`
- Grid 12 columnas estilo dashboard
- Guardar como escena: `POST /user-scenes`
- Cargar escena: `GET /user-scenes/:id` → restore layout
- Sidebar muestra "Mis Escenas" + "Compartidas" (si `is_shared`)

**4.5 Módulo backend `user-scenes` (module-scaffold)**
- `modules/user-scenes/` con CRUD estándar
- Validación schema: layout debe matchear estructura estricta (no eval JSON arbitrario)

**4.6 AI Copilot overlay (architect + integration-tester)**
- Archivo: `src/components/liveview/AiCopilotBanner.tsx`
- Se monta en cada `SmartCameraCell`, suscribe canal `live-view-events` filtro `severity >= high`
- Cuando llega detección crítica (merodeo, arma, intrusión):
  - Banner top del tile: "⚠️ Merodeo detectado. Hace 3s"
  - Acciones contextuales (fetch de `automation_rules` aplicables):
    - "🔊 Accionar sirena" → ejecuta rule via `POST /automation-rules/:id/execute`
    - "🚪 Bloquear puerta" → link a door en `camera_links` + `POST /intercom/door/close`
    - "📞 Llamar supervisor" → `POST /intercom/sessions/initiate`
    - "🚨 Crear incidente" → `POST /incidents`
- Dismissable con X; auto-dismiss 60s

**4.7 Endpoint `GET /automation-rules/applicable?camera_id=X` (module-scaffold)**
- Filtra rules donde `conditions.camera_id` match o wildcard
- Retorna sólo las que el usuario puede ejecutar (role check)

**4.8 Tests E2E Fase 4 (e2e-runner)**
- Floor plan: abre sitio con plano + 5 cámaras → valida íconos posicionados
- Scene composer: crea escena "SalaControl" con 4 cámaras + 2 puertas + 1 IoT → guarda → recarga → restaura idéntica
- AI copilot: simula evento WS severity=critical → verifica banner aparece → click acción → request correcto

### Gate Fase 4
- [ ] Floor plan renderiza con estado RT (>2 colores diferentes simultáneos)
- [ ] Scene composer guarda y restaura layouts
- [ ] AI copilot responde a al menos 3 tipos de detección con acciones distintas
- [ ] Migration 033 aplicada
- [ ] Tests E2E verdes

---

## FASE 5 — Compliance, Recording, QA Final

**Propósito**: Grabación on-demand, cobertura tests >80%, refactor total LiveViewPage.

### Agentes
- `module-scaffold`
- `db-migration`
- `tdd-guide`
- `e2e-runner`
- `security-reviewer`
- `refactor-cleaner`
- `doc-updater`

### Tareas

**5.1 Migración 034 — `live_recordings` (db-migration)**
- Archivo: `backend/apps/backend-api/src/db/migrations/034_live_recordings.sql`
  ```sql
  CREATE TABLE live_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    camera_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    started_by UUID NOT NULL REFERENCES profiles(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_sec INT,
    storage_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('recording','uploading','ready','failed')),
    reason TEXT,
    file_size_bytes BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ALTER TABLE live_recordings ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON live_recordings USING (tenant_id = current_tenant_id());
  ```

**5.2 Worker `recording-worker.ts` (module-scaffold)**
- Archivo: `backend/apps/backend-api/src/workers/recording-worker.ts`
- Escucha Redis cola `recording:start`
- Lanza `ffmpeg -rtsp_transport tcp -i <rtsp> -t <duration> -c copy /tmp/rec_<id>.mp4`
- Al terminar: sube a S3/R2 → actualiza `live_recordings.storage_url` + `status='ready'`
- Failure handling: si falla, `status='failed'` + razón

**5.3 Endpoints recording (module-scaffold)**
- `POST /live-recordings/start` → body `{ camera_id, duration_sec, reason }` → enqueue worker
- `GET /live-recordings?camera_id=X` → lista
- `GET /live-recordings/:id/download` → signed URL

**5.4 Botón Grabar en `SmartCameraCell` (module-scaffold)**
- Overlay icon `<Circle>` rojo pulsante cuando está grabando
- Click → dialog con duración (1/5/15 min) + reason
- Submit → `POST /live-recordings/start`
- Confirmación toast con link a `/recordings/:id`

**5.5 Refactor total `LiveViewPage.tsx` (refactor-cleaner)**
- Extraer a hooks:
  - `useLiveViewLayout` (gridSize, page, layouts saved)
  - `useLiveViewFilters` (site, camera type, status, search)
  - `useLiveViewSelection` (selected camera, multi-select for scene)
- Componentes extraídos:
  - `Sidebar.tsx` (ya parcialmente)
  - `CameraGrid.tsx` (Fase 1)
  - `CameraContextPanel.tsx` (Fase 3)
  - `FloorPlanView.tsx` (Fase 4)
  - `SceneComposer.tsx` (Fase 4)
  - `LiveViewToolbar.tsx` (grid selector, quality default, scene dropdown)
- Objetivo: `LiveViewPage.tsx` queda como shell <300 líneas, sólo composición

**5.6 Tests unitarios exhaustivos (tdd-guide)**
- Todos los hooks nuevos con cobertura ≥85%
- Todos los componentes nuevos con snapshot + interacciones clave
- Mocks para WebSocket, fetch IMOU, Asterisk ARI

**5.7 Tests E2E completos (e2e-runner)**
- `tests/e2e/live-view-golden-path.spec.ts`: flujo completo operador en turno
- `tests/e2e/live-view-grid-sizes.spec.ts`: 1×1, 2×2, 4×4, 8×8
- `tests/e2e/live-view-context-panel.spec.ts`: abrir puerta, llamar intercom, togglear IoT
- `tests/e2e/live-view-scene.spec.ts`: crear, guardar, compartir escena
- `tests/e2e/live-view-recording.spec.ts`: iniciar grabación, esperar ready, descargar

**5.8 Security review (security-reviewer)**
- Audit endpoints nuevos: rate limits, RBAC, RLS
- Validación: URLs de grabaciones en S3 con firma, TTL 15min
- Two-way audio: sin leaks de SIP creds, TURN auth rotating

**5.9 Documentación (doc-updater)**
- Actualizar `README.md` con features Live View
- Guía operador: `docs/guides/live-view-operator.md`
- Guía admin: `docs/guides/live-view-admin.md` (mapping, scenes, recording retention)
- Codemap: `docs/CODEMAPS/live-view.md`

**5.10 Perf final (perf-profiler)**
- Objetivo: 100 cámaras en scene composer custom, FPS >25, memoria <3GB
- Reporte comparativo baseline vs post-Fase 5

### Gate Fase 5
- [ ] Cobertura Vitest >80% sobre `src/components/liveview/*`, `src/hooks/useLive*`, `modules/camera-links`, `modules/user-scenes`, `modules/live-recordings`
- [ ] Playwright 5 suites verdes
- [ ] Security review sin críticos
- [ ] Docs publicadas
- [ ] LiveViewPage.tsx <300 líneas
- [ ] Perf report cumple objetivos

---

## FASE 6 — Deploy, Calibración, Cierre

**Propósito**: Deploy controlado a producción, monitoring, rollback plan.

### Agentes
- `deploy-rollback`
- `monitor-observe`
- `incident-response`
- `doc-updater`

### Tareas

**6.1 Deploy staging (deploy-rollback)**
- Merge `feat/live-view-pro` → `staging`
- Build Docker backend + frontend
- Deploy vía GitHub Actions `deploy-staging.yml`
- Smoke tests automáticos post-deploy

**6.2 Rollback plan documentado (deploy-rollback)**
- Feature flags off → reverse behavior sin rollback de código
- DB migrations: scripts `down/` preparados (camera_links, user_scenes, live_recordings)
- Playbook en `docs/runbooks/live-view-rollback.md`

**6.3 Canary deploy production (deploy-rollback)**
- Activar feature flags gradualmente:
  - Día 1: 1 tenant piloto, todas flags off excepto A1/A5
  - Día 3: Activar A2/A3/A4 para piloto
  - Día 5: Activar B1/B2/B3/B5 para piloto
  - Día 7: Activar C1/C2/C3 para piloto
  - Día 10: Roll-out a todos los tenants
- En cada paso, monitorear error rate + latencia

**6.4 Monitoring dashboards (monitor-observe)**
- Grafana paneles:
  - FPS promedio `/live-view` (via custom metric frontend → backend)
  - Latencia video por protocolo (MSE vs HLS)
  - Concurrent IMOU sessions
  - Errors `/imou-live/bind` rate
  - PTZ commands rate
  - Two-way audio session duration

**6.5 Alertas Prometheus/Alertmanager (monitor-observe)**
- `imou_live_bind_error_rate > 5%` → warning
- `go2rtc_panic > 0` → critical
- `live_recording_failed_rate > 10%` → warning
- `turn_server_down` → critical

**6.6 Post-mortem y lessons learned (incident-response)**
- Documentar incidentes durante canary
- Iterar en runbooks

**6.7 Cierre final (doc-updater)**
- `docs/plans/LIVE_VIEW_PRO_COMPLETED.md` con métricas vs objetivos
- Actualizar CLAUDE.md con nuevos módulos/comandos
- Memoria `project_liveview_pro.md` en `~/.claude/projects/.../memory/`

### Gate Fase 6
- [ ] Staging verde 72h
- [ ] Canary completado sin incidents críticos
- [ ] Todos los tenants usando Live View Pro
- [ ] Métricas objetivo alcanzadas
- [ ] Documentación entregada

---

## Matriz de Archivos

### Frontend (src/)
```
src/
├── components/
│   ├── liveview/                              # NUEVO directorio
│   │   ├── CameraGrid.tsx                     # Fase 1
│   │   ├── CameraContextPanel.tsx             # Fase 3
│   │   ├── DetectionOverlay.tsx               # Fase 2
│   │   ├── EventTimelineSparkline.tsx         # Fase 2
│   │   ├── PtzInlineControl.tsx               # Fase 2
│   │   ├── IntercomPushToTalk.tsx             # Fase 3
│   │   ├── FloorPlanView.tsx                  # Fase 4
│   │   ├── SceneComposer.tsx                  # Fase 4
│   │   ├── AiCopilotBanner.tsx                # Fase 4
│   │   ├── LiveViewToolbar.tsx                # Fase 5
│   │   └── widgets/                           # Fase 4
│   │       ├── CameraTileWidget.tsx
│   │       ├── DoorButtonWidget.tsx
│   │       ├── IntercomButtonWidget.tsx
│   │       ├── IotToggleWidget.tsx
│   │       └── EventsListWidget.tsx
│   └── video/
│       └── SmartCameraCell.tsx                # Refactor Fase 1+2+5
├── hooks/
│   ├── useImouLive.ts                         # Fase 1
│   ├── useCameraStream.ts                     # Fase 1
│   ├── useVirtualCameraGrid.ts                # Fase 1
│   ├── useDetectionStream.ts                  # Fase 2
│   ├── useLiveViewLayout.ts                   # Fase 5
│   ├── useLiveViewFilters.ts                  # Fase 5
│   └── useLiveViewSelection.ts                # Fase 5
├── services/
│   ├── camera-links-api.ts                    # Fase 3
│   ├── user-scenes-api.ts                     # Fase 4
│   └── live-recordings-api.ts                 # Fase 5
├── stores/                                    # NUEVO
│   └── useLiveViewPreferencesStore.ts         # Fase 1
├── lib/
│   └── feature-flags.ts                       # Fase 0
└── pages/
    ├── LiveViewPage.tsx                       # Refactor Fase 5 (<300 líneas)
    └── admin/
        └── CameraLinksPage.tsx                # Fase 3
```

### Backend (backend/apps/backend-api/src/)
```
src/
├── db/
│   ├── migrations/
│   │   ├── 031_device_capabilities.sql        # Fase 2
│   │   ├── 032_camera_links.sql               # Fase 3
│   │   ├── 033_user_scenes.sql                # Fase 4
│   │   └── 034_live_recordings.sql            # Fase 5
│   └── schema/
│       ├── camera-links.ts                    # Fase 3
│       ├── user-scenes.ts                     # Fase 4
│       └── live-recordings.ts                 # Fase 5
├── modules/
│   ├── camera-links/                          # Fase 3
│   │   ├── routes.ts
│   │   ├── service.ts
│   │   └── schemas.ts
│   ├── user-scenes/                           # Fase 4
│   ├── live-recordings/                       # Fase 5
│   └── events/
│       └── routes.ts                          # Añadir /density en Fase 2
├── workers/
│   └── recording-worker.ts                    # Fase 5
└── modules/intercom/
    └── routes.ts                              # Añadir /push-to-talk Fase 3
```

### Infra VPS
```
/etc/go2rtc/go2rtc.yaml                        # Fase 0: hardware=vaapi
/etc/turnserver.conf                           # Fase 0: coturn config
/usr/local/bin/imou-live-server.js             # Fase 0: IMOU_LIVE_MAX=20
/etc/systemd/system/coturn.service             # Fase 0
/etc/nginx/sites-enabled/aionseg.co            # Fase 3: /turn/ proxy si necesario
```

---

## Matriz Agentes × Fases

| Agente                  | F0  | F1  | F2  | F3  | F4  | F5  | F6  |
|-------------------------|-----|-----|-----|-----|-----|-----|-----|
| architect               | ✓   | ✓   | ✓   | ✓   | ✓   |     |     |
| planner                 | ✓   |     |     |     |     |     |     |
| module-scaffold         |     | ✓   | ✓   | ✓   | ✓   | ✓   |     |
| db-migration            |     |     | ✓   | ✓   | ✓   | ✓   |     |
| tdd-guide               |     | ✓   | ✓   |     |     | ✓   |     |
| code-reviewer           |     | ✓   | ✓   | ✓   | ✓   | ✓   |     |
| api-docs-generator      |     |     | ✓   | ✓   | ✓   | ✓   |     |
| integration-tester      |     |     |     | ✓   | ✓   | ✓   |     |
| security-reviewer       |     |     |     | ✓   |     | ✓   |     |
| perf-profiler           | ✓   | ✓   | ✓   |     |     | ✓   | ✓   |
| e2e-runner              |     | ✓   | ✓   | ✓   | ✓   | ✓   |     |
| refactor-cleaner        |     |     |     |     |     | ✓   |     |
| build-error-resolver    | ✓   |     |     |     |     |     |     |
| doc-updater             | ✓   |     |     |     |     | ✓   | ✓   |
| deploy-rollback         |     |     |     |     |     |     | ✓   |
| monitor-observe         | ✓   |     |     |     |     |     | ✓   |
| incident-response       |     |     |     |     |     |     | ✓   |

---

## Matriz Dependencias

| Tarea        | Depende de          |
|--------------|---------------------|
| F1.1 useImouLive | F0.4 IMOU_LIVE_MAX=20 |
| F1.2 useCameraStream | F1.1 |
| F1.3 virtualization | F0.2 react-window |
| F1.4 SmartCameraCell refactor | F1.1, F1.2 |
| F1.5 CameraGrid extract | F1.3, F1.4 |
| F2.1 useDetectionStream | WebSocket plugin existente |
| F2.2 DetectionOverlay | F2.1 |
| F2.4 /events/density | backend Fastify (existe) |
| F2.7 PTZ inline | F2.8 capabilities migration |
| F3.1 camera_links migration | RLS global (ya aplicada) |
| F3.5 CameraContextPanel | F3.1, F3.2, F3.4 |
| F3.7 two-way audio | F0.4 coturn instalado |
| F4.1 FloorPlanView | floor_plans table existente |
| F4.3 user_scenes migration | F3.1 |
| F4.4 SceneComposer | F4.3, F4.5, F1.4 |
| F4.6 AI Copilot | F2.1, F3.1 (camera_links) |
| F5.1 live_recordings migration | - |
| F5.2 recording-worker | F5.1, Redis, S3/R2 |
| F5.5 refactor LiveViewPage | F1-F4 componentes extraídos |
| F6.x deploy | F5 gate verde |

---

## Métricas finales objetivo

| Métrica                           | Baseline | Objetivo F5 |
|-----------------------------------|----------|-------------|
| Cámaras simultáneas en grid       | 25       | 100+        |
| Dahua IMOU concurrentes           | 7-8      | 20+         |
| Latencia video MSE                | 1-3s     | 0.5-1s      |
| FPS overlay IA (16 tiles)         | N/A      | >55fps      |
| Click → abrir puerta              | 3        | 1           |
| Detecciones IA visibles en grid   | 0%       | 100%        |
| Cobertura Vitest Live View        | ~0%      | >80%        |
| Líneas LiveViewPage.tsx           | 1400     | <300        |
| Playwright E2E flows              | 0        | 5           |
| Uptime two-way audio              | N/A      | >99%        |
| Recording success rate            | N/A      | >95%        |

---

## Autorización por fase

Cada fase se inicia con el mensaje **"autoriza Fase N"** del usuario.

Secuencia esperada:
1. Usuario autoriza Fase 0 → ejecuto → reporte gate → espero autorización
2. Usuario autoriza Fase 1 → ejecuto → gate → espero
3. ... y así hasta Fase 6

**Flag de interrupción**: en cualquier momento usuario puede decir "detén Fase N" y congelo ejecución con estado reproducible.

**Flag de rollback**: `rollback Fase N` revierte cambios de esa fase sin tocar fases previas (via feature flags o git revert por sub-branch).

---

## Entrega final

Al completar Fase 6:
- Live View Pro en producción en todos los tenants
- Documentación completa para operador, admin, dev
- Dashboards de monitoring activos
- Runbooks de incident response
- 100% de los ítems del informe original cubiertos
- Ningún punto omitido
