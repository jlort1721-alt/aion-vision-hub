# REMEDIACIÓN AION — Plan Maestro de Cierre

**Objetivo único:** Cerrar los hallazgos FX pendientes reales, llevar cobertura de tests a ≥ 80% en el módulo de tool handlers, desplegar todo a producción con E2E verde y entregar reporte PDF final. Esto parte desde el punto donde quedó la sesión 2026-04-15 (Fases 0-1 completas + Stream A/B.1/E cerrados).

**Principio de ejecución:** Fases secuenciales con gates verificables. Cada fase tiene agentes y sub-agentes asignados. Autorización explícita del usuario entre fases mediante el mensaje **"autoriza Fase N"**. Ningún ítem se omite.

**Estado de entrada:**
- Branch: `remediation/2026-04-aion-full-audit` (HEAD en `35efa75`).
- Tag seguridad: `pre-remediation-20260415-155113`.
- Backup prod verificado: `/var/backups/aion/20260415-205328/` (422 MB).
- Migraciones aplicadas a prod: `030_fk_indices`, `031_event_notify_triggers`.
- Supabase eliminado del runtime (verificado grep).
- Memoria Claude Code actualizada.

---

## FASE 0 — Re-baseline y preparación para cierre

**Propósito:** partir desde estado reproducible, refrescar el diff entre lo ya entregado y lo pendiente, y asegurar toolchain local + acceso VPS antes de cualquier cambio.

### Agentes
- `monitor-observe` — captura de métricas actuales (prod health, PM2 restart counts, error rate 24h, DB connection pool)
- `build-error-resolver` — valida que `pnpm install`, `pnpm typecheck`, `pnpm --filter @aion/backend-api build` están verdes en la branch
- `planner` — sincroniza plan vs handover + todo list
- `doc-updater` — snapshot en `docs/remediation-2026-04/OPERATION_LOG.md`

### Tareas

**0.1 Verificar estado del workspace y VPS**
- `git fetch --all --prune`; checkout `remediation/2026-04-aion-full-audit`; `git pull`.
- `ssh aion-vps 'pm2 list; uptime; df -h; free -h'` y contraste vs `VPS_SCAN.md`.
- Si PM2 o servicios degradados → incident-response sub-agent antes de seguir.

**0.2 Refresh de dependencias**
- `pnpm install --frozen-lockfile` (raíz y backend).
- `pnpm --filter @aion/backend-api test --run` baseline; documenta tests verdes/rojos actuales.
- `pnpm --filter aion-vision-hub test --run` idem frontend.

**0.3 Nuevo backup pre-operación**
- `ssh aion-vps 'TS=$(date +%Y%m%d-%H%M%S); sudo mkdir -p /var/backups/aion/$TS; sudo chown ubuntu:ubuntu /var/backups/aion/$TS; sudo -u postgres pg_dumpall | gzip > /var/backups/aion/$TS/pre-fase2.sql.gz; sudo tar -czf /var/backups/aion/$TS/var-www.tar.gz -C /var/www aionseg; echo $TS > /var/backups/aion/LATEST_PRE_FASE2'`.
- Registrar el TS en `OPERATION_LOG.md`.

**0.4 Feature flags para rollback rápido**
- Ampliar `src/lib/feature-flags.ts` (si no existe, crear) con:
  - `FX_033_CLIP_EXPORT_UI`
  - `FX_042_ALERTS_SEED`
  - `FX_031_DVR_TIME_SYNC`
  - `FX_064_IOT_SCENES_UI`
  - `FX_083_ASTERISK_AMI`
  - `FX_108_DOCUMENTS_CLEANUP`
  - `FX_I18N_BATCH_2026_04`
  - `NOTIFY_WS_BRIDGE` (para encender el consumo del `LISTEN aion_event` de la migración 031)
- Todas default `false`. Persistencia: `tenants.settings.feature_flags` (JSON) y override por env `VITE_FF_*`.

**0.5 Sincronizar TODO list con plan maestro**
- TodoWrite con 1 entrada por fase y sub-tareas críticas.
- Entradas F2-F8 inicialmente `pending`, F0 `in_progress`.

### Gate Fase 0
- [ ] Branch limpia, `git status` sin modificados fuera de `tsconfig.tsbuildinfo`.
- [ ] Tests backend y frontend corren (aunque algunos rojos, queda medido).
- [ ] Backup `pre-fase2` creado y verificado (tamaño > 0).
- [ ] Feature flags desplegados en código (no en prod aún).
- [ ] VPS saludable según health checks.
- [ ] TodoWrite sincronizado.

---

## FASE 1 — Stream B.2: Migración de deduplicación de tablas

**Propósito:** Eliminar duplicidad `audit_log`/`audit_logs`, decidir canonica entre `intercoms`/`intercom_devices` y `site_admins`/`site_administrators`. Dejar una sola fuente de verdad por concepto.

### Agentes
- `db-migration` (liderazgo)
- `integration-tester` (validar código que referencia las tablas obsoletas)
- `Explore` (sub-agent: grep cruzado de uso en backend + frontend)
- `security-reviewer` (revisar RLS de tablas sobrevivientes)
- `code-reviewer`

### Tareas

**1.1 Auditoría de uso real en código**
- Sub-agent Explore busca: `audit_log` (sin s), `intercoms` vs `intercom_devices`, `site_admins` vs `site_administrators` en `backend/**`, `src/**`, migraciones, seeds.
- Reporte: `docs/remediation-2026-04/DEDUPE_USAGE_REPORT.md` con matriz archivo × tabla.

**1.2 Diseño migración 032**
- Archivo: `backend/apps/backend-api/src/db/migrations/032_deprecate_duplicates.sql`.
- Pasos (todo en una transacción, idempotente):
  1. `INSERT INTO audit_logs (...) SELECT ... FROM audit_log ON CONFLICT DO NOTHING;` (copiar filas no duplicadas, con columna `legacy_source='audit_log'`).
  2. `INSERT INTO <intercom_canon> ... FROM <intercom_legacy> ON CONFLICT DO NOTHING;` (dirección se decide en 1.1).
  3. `INSERT INTO <site_admins_canon> ... FROM <legacy> ON CONFLICT DO NOTHING;`.
  4. Renombrar tablas viejas a `<nombre>_deprecated_20260416` (no `DROP` en esta migración, dejar reversible).
- Registrar en `schema_migrations`.

**1.3 Refactor código que apuntaba a las tablas legacy**
- Reemplazar referencias según reporte 1.1.
- Tests unitarios y de integración actualizados.

**1.4 Dry run y aplicación a prod**
- Dry run con `BEGIN; ... ROLLBACK;` en prod para verificar plan.
- Aplicar en transacción real.
- Verificar `schema_migrations` versión 032.

**1.5 Post-aplicación: smoke tests prod**
- `curl https://aionseg.co/api/health`, `/api/v1/incidents?limit=1`, `/api/v1/devices?limit=1`, `/api/intercom/calls?limit=1`.
- Sin errores 500 durante 10 min.

### Gate Fase 1
- [ ] Migración 032 aplicada; tablas legacy renombradas con sufijo `_deprecated_20260416`.
- [ ] Código sin referencias a las tablas legacy (grep limpio).
- [ ] Tests backend verdes post-refactor.
- [ ] `audit_logs` recibe todas las escrituras nuevas.
- [ ] No hay 500 en prod en 10 min de observación.

---

## FASE 2 — Stream C.1: FX-033 Export de clips (frontend wiring)

**Propósito:** Completar la funcionalidad "Exportar clip" en `PlaybackPage.tsx`. Backend (`POST /clips/export` + Zod + integración go2rtc) ya existe. Solo falta UI + worker asíncrono si resulta que el endpoint devuelve un job.

### Agentes
- `Explore` (sub-agent: inspeccionar firma del endpoint y tabla `clip_exports`)
- `module-scaffold` (componente + dialog)
- `tdd-guide` (tests primero)
- `e2e-runner` (Playwright spec)
- `code-reviewer`

### Tareas

**2.1 Mapear contrato backend existente**
- Explore: leer `backend/apps/backend-api/src/modules/clips/routes.ts` y `service.ts`. Documentar: inputs (camera_id, from, to, format, reason), output (id, status, signed_url, expires_at).

**2.2 Tabla `clip_exports` schema check**
- Verificar columnas ya existentes. Si falta `signed_url`, `expires_at`, `ready_at`, `file_size_bytes`, crear migración `033_clip_exports_schema.sql` (idempotente, `ADD COLUMN IF NOT EXISTS`).

**2.3 Worker de export asíncrono (si no existe)**
- `backend/apps/backend-api/src/workers/clip-export-worker.ts` — patrón de `detection-worker.ts`.
- Loop `setInterval(10s)`:
  - `SELECT * FROM clip_exports WHERE status='pending' LIMIT N`.
  - Invocar go2rtc `GET /api/frame.mp4?src=<stream>&from=<ts>&to=<ts>` via ffmpeg.
  - Guardar a `/var/www/aionseg/exports/<id>.mp4`; calcular `file_size_bytes`.
  - `UPDATE clip_exports SET status='ready', storage_url=..., ready_at=NOW()`.
- Registrar en `ecosystem.config.js` como `clip-export-worker`.

**2.4 Componente `ExportClipDialog.tsx`**
- Archivo: `src/components/playback/ExportClipDialog.tsx`.
- Props: `{ cameraId, streamKey, defaultRange?: [Date, Date] }`.
- Form: rango (DatePicker desde/hasta), formato (`mp4` | `mkv`), motivo (textarea obligatorio para audit).
- Submit → `apiClient.post('/api/clips/export', payload)` → toast con id del job.
- Polling `useQuery(['clip-export', id], { refetchInterval: (data) => data?.status === 'ready' ? false : 3000 })`.
- Cuando `status === 'ready'` → muestra botón "Descargar" (`signed_url`).

**2.5 Botón + wire en `PlaybackPage.tsx`**
- Agregar botón "Exportar clip" en la toolbar.
- `ExportClipDialog` controlled por estado local.
- Bloquear botón si no hay rango seleccionado en el timeline.

**2.6 Página `ExportsListPage.tsx`** (opcional en fase, puede unificar con C.8)
- Lista exports del usuario con filtros por estado, descarga, copia URL.

**2.7 Tests**
- Vitest: `src/components/playback/__tests__/ExportClipDialog.test.tsx` (form válido/inválido, submit mock, polling).
- Backend test: `clip-export-worker.test.ts` con mock ffmpeg.
- Playwright: `tests/e2e/clip-export.spec.ts` — login, playback, seleccionar rango, exportar, esperar ready, descargar.

**2.8 Flag + rollback**
- Render condicional por `FX_033_CLIP_EXPORT_UI`.

### Gate Fase 2
- [ ] Export end-to-end funcional en staging con al menos 2 cámaras (1 IMOU, 1 Hikvision).
- [ ] Worker `clip-export-worker` estable con 0 restarts en 1h.
- [ ] Tests Vitest + Playwright verdes.
- [ ] Audit log registra cada export con user + reason.

---

## FASE 3 — Stream C.2: FX-042 / FX-043 / FX-044 Alertas completas

**Propósito:** Cerrar el loop de alertas: reglas → canales → políticas de escalamiento → instancias disparadas → notificaciones entregadas.

### Agentes
- `Explore` (audit UI + backend existentes)
- `module-scaffold` (scripts seed + cualquier endpoint faltante)
- `tdd-guide`
- `integration-tester` (dispara evento → verifica notificación)
- `e2e-runner`

### Tareas

**3.1 Auditoría detallada**
- Explore: inventario completo de `AlertsPage.tsx`, `NotificationTemplatesPage.tsx`, `modules/alerts/`, `modules/notification-templates/`, `workers/notification-dispatcher.ts`. Reporte en `docs/remediation-2026-04/ALERTS_AUDIT.md`.

**3.2 Migración 034 — schema confirmation**
- Verificar `alert_rules`, `alert_channels`, `alert_escalations`, `alert_escalation_steps`, `alert_instances`.
- Si faltan columnas (`template_id`, `last_triggered_at`, `escalation_state`) → `034_alerts_schema_fix.sql` (idempotente).

**3.3 Seed de datos de prueba**
- `backend/apps/backend-api/src/scripts/seed-alert-samples.ts`:
  - 3 `alert_rules` (evento crítico, offline prolongado, acceso no autorizado).
  - 3 `alert_channels` (email ops, WhatsApp supervisor, webhook n8n).
  - 1 `alert_escalation` con 3 steps.
  - Flag `--tenant <uuid>` para no contaminar otros tenants.
- Runnable con `pnpm --filter @aion/backend-api exec tsx src/scripts/seed-alert-samples.ts --tenant <uuid>`.

**3.4 UI de creación/edición — wiring final**
- Revisar que `AlertsPage.tsx` usa `alerts-api.ts` real y no mocks.
- Formularios Zod + RHF para las 3 entidades.
- Validaciones: no permitir rule sin canal, no escalation sin steps.

**3.5 Backend: disparo real**
- `workers/notification-dispatcher.ts`:
  - Listener `LISTEN aion_event` (consume triggers migración 031).
  - Evalúa reglas matching (tenant_id + event_type + condiciones JSON).
  - Inserta `alert_instance` + envía por cada `alert_channel` asociado.
  - Aplica `alert_escalation` si `response_sla_sec` vencido sin ACK.

**3.6 Tests integration**
- `__tests__/integration/alerts-flow.test.ts`:
  - Inserta evento en `events`.
  - Espera 5s.
  - Verifica `alert_instance` creada + `communication_logs` con el envío.

**3.7 E2E Playwright**
- `tests/e2e/alerts-crud.spec.ts`: crear regla, crear canal, crear policy, disparar, verificar en panel.

**3.8 Flag + rollback**
- `FX_042_ALERTS_SEED` controla sólo el seed automático; las alertas en sí siempre activas.

### Gate Fase 3
- [ ] Al menos 1 alerta end-to-end (evento → canal → instancia registrada).
- [ ] UI CRUD completo para las 3 entidades.
- [ ] E2E verde.
- [ ] Seed reproducible.

---

## FASE 4 — Stream C.3: FX-031 Sync hora DVR

**Propósito:** Garantizar que los timestamps en grabaciones Hikvision y Dahua coinciden con la fecha real del sitio. Hoy algunos DVR reportan `01-19-1970` (FX-031 del documento de revisión).

### Agentes
- `Explore` (ver clientes existentes)
- `module-scaffold`
- `tdd-guide`
- `api-docs-generator` (documentar nuevos endpoints)
- `code-reviewer`

### Tareas

**4.1 Extensión cliente Hikvision ISAPI**
- `backend/apps/backend-api/src/services/hikvision-isapi.ts`:
  - `setDeviceTime(isoTimestamp: string): Promise<void>` — `PUT /ISAPI/System/time` con XML `<Time><timeMode>NTP</timeMode><localTime>...</localTime><timeZone>...</timeZone></Time>`.
  - `getDeviceTime(): Promise<{ localTime: string; timeZone: string }>` — `GET /ISAPI/System/time`.
  - `setNtpServer(host: string, port: number): Promise<void>` — `PUT /ISAPI/System/time/ntpServers`.

**4.2 Extensión cliente Dahua CGI**
- `backend/apps/backend-api/src/services/dahua-cgi.ts`:
  - `setDeviceTime(isoTimestamp: string): Promise<void>` — `GET /cgi-bin/global.cgi?action=setCurrentTime&time=YYYY-MM-DD%20HH:mm:ss`.
  - `getDeviceTime(): Promise<string>` — `GET /cgi-bin/global.cgi?action=getCurrentTime`.
  - `setNtpServer(host: string)` — `GET /cgi-bin/configManager.cgi?action=setConfig&NTP.Address=<host>`.

**4.3 Worker `dvr-time-sync-worker.ts`**
- `backend/apps/backend-api/src/workers/dvr-time-sync-worker.ts`.
- `setInterval(6 * 60 * 60 * 1000)` (6h). Plus primer run al arranque tras 60s delay.
- Consulta `devices WHERE vendor IN ('hikvision','dahua') AND status='online'`.
- Para cada uno:
  - Compara hora servidor vs hora device (`getDeviceTime`).
  - Si drift > 30s → `setDeviceTime(new Date().toISOString())`; inserta entrada en `device_audit_log` con `action='time_sync'`, drift antes/después.
- Métrica Prometheus: `dvr_time_drift_seconds{vendor,device}`.

**4.4 Endpoint manual para operador**
- `POST /api/devices/:id/time-sync` (role ≥ supervisor) — ejecuta el sync en on-demand.
- Devuelve `{ drift_before_sec, drift_after_sec, synced_at }`.

**4.5 UI — botón en `DevicesPage.tsx`**
- Dropdown "Acciones" → "Sincronizar hora" → llama endpoint → toast con resultado.

**4.6 Registro en PM2**
- Agregar `dvr-time-sync-worker` en `ecosystem.config.js` (autorestart, 128 MB max mem).

**4.7 Tests**
- Unit: mocks HTTP, verificar XML/querystring correctos.
- Integration: DVR mock server que responde a `/ISAPI/System/time`.

**4.8 Flag**
- `FX_031_DVR_TIME_SYNC` default `true` en staging, `false` en prod hasta verificar 48h.

### Gate Fase 4
- [ ] Worker activo en staging con 3+ DVRs reales.
- [ ] Audit log con sincronizaciones registradas.
- [ ] Drift < 5s después de 24h.
- [ ] Tests verdes.

---

## FASE 5 — Stream C.4: FX-064 / FX-065 Escenas + programación IoT

**Propósito:** Frontend para las tablas ya existentes `iot_scenes`, `iot_scene_actions`, `iot_schedules`. Backend 100% listo.

### Agentes
- `Explore` (contrato backend)
- `module-scaffold` (5 componentes React)
- `tdd-guide`
- `e2e-runner`
- `code-reviewer`

### Tareas

**5.1 Mapear contrato**
- Explore: `modules/scenes/` y `modules/schedules/`. Documentar en `docs/remediation-2026-04/IOT_SCENES_API.md`.

**5.2 Página `ScenesPage.tsx`**
- `src/pages/domotics/ScenesPage.tsx`.
- Tabla con escenas del tenant: nombre, # acciones, último ejecutado, estado.
- Botones: Crear, Editar, Ejecutar, Duplicar, Eliminar.

**5.3 Componente `SceneEditor.tsx`**
- `src/components/domotics/SceneEditor.tsx`.
- Form: nombre, descripción, disparador manual/evento.
- Lista editable de acciones: `device_id` (combobox con `iot_devices`), `action` (toggle/dimmer/setting), `params` (JSON editor restringido).
- Preview de orden de ejecución + delay opcional por acción.
- Submit → `POST /api/scenes` o `PUT /api/scenes/:id`.

**5.4 Página `SchedulesPage.tsx`**
- Lista cron-schedules con nombre, expresión cron, escena asociada, próximo disparo.

**5.5 Componente `ScheduleEditor.tsx`**
- Cron builder amigable (cada X horas / horario fijo / días de la semana).
- Validación server-side vía `POST /api/schedules/validate-cron`.

**5.6 Servicios frontend**
- `src/services/scenes-api.ts`, `src/services/schedules-api.ts` con React Query.

**5.7 Rutas**
- Añadir rutas `/domotics/scenes`, `/domotics/scenes/:id`, `/domotics/schedules`, `/domotics/schedules/:id` al router y sidebar.

**5.8 Tests**
- Vitest para cada componente (snapshot + interacción).
- Playwright `tests/e2e/iot-scenes.spec.ts`: crear escena con 2 acciones, ejecutar, verificar estado devices cambió.

**5.9 Flag**
- `FX_064_IOT_SCENES_UI`.

### Gate Fase 5
- [ ] 1+ escena real creada con 2+ acciones ejecuta correctamente contra eWeLink/Hikvision.
- [ ] 1+ schedule dispara en horario configurado.
- [ ] UI cubre CRUD completo sin 500.
- [ ] Tests verdes.

---

## FASE 6 — Stream C.5: FX-083 Historial de llamadas (Asterisk AMI)

**Propósito:** La tabla `intercom_calls` existe pero nadie la alimenta. Implementar integración Asterisk AMI para capturar eventos de llamada y persistir historial.

### Agentes
- `architect` (diseño cliente AMI + reconexión + feature flag)
- `module-scaffold`
- `security-reviewer` (creds AMI, exposición, rate limit)
- `integration-tester`
- `e2e-runner`
- `code-reviewer`

### Tareas

**6.1 Diseño del cliente AMI**
- `backend/apps/backend-api/src/services/asterisk-ami.ts`.
- Usa `asterisk-ami-client` (npm) con reconexión exponencial (1s → 30s max).
- Logging estructurado (`pino`): `ami_connected`, `ami_event`, `ami_disconnected`.
- Eventos a capturar: `Newchannel`, `DialBegin`, `DialEnd`, `Hangup`, `Bridge`.

**6.2 Worker `asterisk-call-logger.ts`**
- `backend/apps/backend-api/src/workers/asterisk-call-logger.ts`.
- Monta cliente AMI con credenciales `AMI_HOST`, `AMI_PORT=5038`, `AMI_USER`, `AMI_SECRET`.
- Correlaciona eventos por `Uniqueid`; al recibir `Hangup`:
  - Resolver `device_id` del intercom (lookup `intercom_devices` por SIP URI).
  - `INSERT INTO intercom_calls (device_id, direction, from_uri, to_uri, started_at, ended_at, duration_sec, status, audit_json)`.
- Feature flag `ENABLE_CALL_LOGGER=false` por defecto.

**6.3 Endpoint historial**
- `modules/intercom/routes.ts`:
  - `GET /api/intercom/calls?device_id=&from=&to=&status=&limit=&cursor=` — paginación por cursor.
  - `GET /api/intercom/calls/:id` — detalle + grabación si existe (campo `recording_url`).
- Schemas Zod + audit.

**6.4 UI historial**
- `src/pages/CallHistoryPage.tsx` (o tab en `IntercomPage.tsx`).
- Tabla con filtros: dispositivo, fecha, dirección, estado.
- Reproductor embebido si `recording_url` presente (usa `<audio>` estándar).

**6.5 Service frontend**
- `src/services/intercom-calls-api.ts` con React Query + infinite scroll.

**6.6 Configuración VPS**
- Ajustar `/etc/asterisk/manager.conf` (role aionapi, secret en secrets manager, permit 127.0.0.1/32, read system,call,log,verbose, write system,call,originate).
- Reload Asterisk con `asterisk -rx "manager reload"`.
- Registrar credenciales en `/var/www/aionseg/.env` (no en repo).

**6.7 Security review**
- Verificar que las creds AMI no se exponen en logs ni API responses.
- Rate limit en `/api/intercom/calls`: 60 req/min por usuario.

**6.8 Tests**
- Mock cliente AMI → simular secuencia de eventos → verificar row en `intercom_calls`.
- Integration: con Asterisk test instance (opcional) o mock TCP server emulando AMI.
- Playwright: login operador, abre historial, verifica filtros y detalle.

**6.9 Registro PM2**
- `ecosystem.config.js` agregar `asterisk-call-logger` con `autorestart: true`, `max_memory_restart: 200M`.

### Gate Fase 6
- [ ] Worker conectado a AMI con 0 desconexiones en 1h.
- [ ] 10+ `intercom_calls` registradas desde tráfico real.
- [ ] Endpoint devuelve historial paginado correcto.
- [ ] UI filtra y reproduce grabaciones.
- [ ] Security review sin críticos.
- [ ] Tests verdes.

---

## FASE 7 — Stream C.6 / C.7 / C.8: Documentos cleanup, Export PDF incidentes, I18N batch

**Propósito:** Cerrar FX cosméticos y tareas de pulido que no requieren arquitectura mayor.

### Agentes
- `refactor-cleaner` (C.6 cleanup de imports muertos)
- `Explore` (C.7 verificar endpoint PDF existente)
- `module-scaffold` (C.7 si hay que crear)
- `doc-updater`
- `code-reviewer`
- `e2e-runner`

### Tareas

**7.1 C.6 — Limpieza `DocumentsPage.tsx`**
- Quitar cualquier referencia a `supabase.storage` (ya inoperante).
- Confirmar que todas las rutas consumen `/api/database-records`.
- Test E2E upload + download + delete.

**7.2 C.7 — Export PDF de incidente**
- Explore: `backend/apps/backend-api/src/workers/reports-worker.ts` + `modules/reports/`. Verificar si ya hay template `incident`.
- Si existe:
  - Crear endpoint `GET /api/incidents/:id/pdf` que invoca el worker síncronamente (timeout 30s) o devuelve job id.
  - Reusar firma de URL igual que `clip_exports`.
- Si no existe:
  - Template Handlebars/`puppeteer`/`pdfkit` en `backend/apps/backend-api/src/services/pdf-renderer/incident.ts`.
  - Layout: encabezado marca, datos del incidente, timeline (eventos relacionados), evidencias (snapshots), firmas.
- Botón "Exportar PDF" en `IncidentsPage.tsx` y detail view.

**7.3 C.8 — I18N batch**
- Extraer strings en inglés de:
  - `PlaybackPage.tsx`
  - `LiveViewPage.tsx`
  - `IncidentsPage.tsx`
  - `EventsPage.tsx`
  - `DomoticsPage.tsx`
  - `CommunicationsPage.tsx`
  - `AutomationPage.tsx`
  - `IntegrationsPage.tsx`
  - `ScheduledReportsPage.tsx`
  - `OperationalDashboardPage.tsx`
  - `TrainingPage.tsx`
  - `WhatsAppPage.tsx`
  - `IntercomPage.tsx`
  - `AdminPage.tsx`
  - `NotificationTemplatesPage.tsx`
- Crear `src/i18n/es/fix-batch-2026-04.json` y su espejo `src/i18n/en/fix-batch-2026-04.json`.
- Registrar el namespace en el sistema `react-i18next`.
- Refactor cada página para consumir `t('fix-batch-2026-04.playback.setStart')`, etc.
- Script automático: `pnpm exec tsx scripts/extract-i18n.ts --page src/pages/PlaybackPage.tsx` que genera sugerencias de keys — iterar manual.

**7.4 Lint rule para prevenir regresiones**
- Instalar `eslint-plugin-i18next`.
- Config: `"i18next/no-literal-string": ["error", { "markupOnly": true, "ignoreAttribute": ["className","data-testid"] }]`.
- Añadir al `.eslintrc.cjs` con severity `warn` inicialmente para no romper CI.

**7.5 E2E**
- `tests/e2e/i18n-smoke.spec.ts`: recorrer 15 páginas y buscar strings en inglés obvios (whitelist permitida).

### Gate Fase 7
- [ ] `DocumentsPage.tsx` sin código muerto.
- [ ] Export PDF de incidente funcional con 1 incidente real.
- [ ] Las 15 páginas del batch I18N sin strings en inglés (verificado por lint).
- [ ] Tests verdes.

---

## FASE 8 — Stream D: Test coverage de tool handlers (Opus tier primero)

**Propósito:** Subir cobertura de `backend/apps/backend-api/src/modules/mcp-bridge/tools/` de 0% a ≥ 50%, con foco en los 8 handlers Opus (irreversibles o auditorías).

### Agentes
- `tdd-guide` (liderazgo metodológico)
- `architect` (patrón de test base reutilizable)
- `module-scaffold` (archivos de test)
- `code-reviewer`

### Tareas

**8.1 Patrón base de test para tool handler**
- `backend/apps/backend-api/src/__tests__/tools/_shared/tool-test-helpers.ts`:
  - `createMockContext(overrides)` que genera `{ tenantId, userId, userEmail, role }`.
  - `expectAuditLog(matcher)` que verifica escritura en `audit_logs` y `agent_tool_logs`.
  - Mock de `pg` Pool con `pg-mem` o mocks manuales (siguiendo `dahua-cgi.test.ts`).
  - Mock HTTP `nock` para llamadas externas (Hikvision ISAPI, eWeLink API).

**8.2 Tests Opus-tier (8 archivos)**
- `open-gate.test.ts` — happy path, permission denied (operator role), device offline, audit.
- `trigger-relay.test.ts` — idem + validación `duration_seconds` 1-300.
- `reboot-device.test.ts` — idem + retry si ISAPI devuelve 503 una vez.
- `activate-emergency-protocol.test.ts` — verifica notificaciones disparadas + incidente creado.
- `audit-compliance-template.test.ts` — mock de template, genera reporte, persiste.
- `hikvision-ptz-control.test.ts` — verifica XML ISAPI correcto por acción.
- `generate-incident-summary.test.ts` — mock LLM response, verifica persistencia.
- `check-visitor-blacklist.test.ts` — 2 paths (blacklisted / clean), audit.

**8.3 Tests Sonnet-tier (11 archivos)**
- Analog pero con énfasis en input shape y output shape. Un archivo por handler.

**8.4 Tests Haiku-tier (26 archivos, en tandas)**
- Generar con script si todos siguen patrón `query_*` / `get_*` (mock DB devuelve rows, verifica shape).

**8.5 Cobertura**
- `vitest --coverage` con threshold en `vitest.config.ts`:
  ```ts
  coverage: {
    thresholds: {
      'backend/apps/backend-api/src/modules/mcp-bridge/tools/**': { lines: 50, branches: 40 }
    }
  }
  ```
- CI falla si cae bajo 50%.

**8.6 CI integration**
- GitHub Actions workflow `.github/workflows/backend-tests.yml` corre `pnpm test --coverage` en PR.

### Gate Fase 8
- [ ] 8 handlers Opus: 100% lines, 80% branches.
- [ ] Módulo `mcp-bridge/tools` cobertura global ≥ 50%.
- [ ] CI verde con thresholds aplicados.
- [ ] 0 tests flaky en 3 corridas consecutivas.

---

## FASE 9 — Stream F: Deploy a producción + health checks extensos

**Propósito:** Llevar todo lo acumulado (Fases 1-8) a prod con plan de rollback probado.

### Agentes
- `deploy-rollback` (liderazgo)
- `db-migration` (supervisión migración en prod)
- `monitor-observe`
- `incident-response` (standby)
- `security-reviewer`

### Tareas

**9.1 Pre-deploy checklist**
- Branch compila localmente (`pnpm build`).
- Tests verdes (backend + frontend).
- Migraciones 032 y subsiguientes (si aplica) idempotentes y con `DOWN` script o equivalente.
- Feature flags documentados y default `false` en prod.
- Backup `pg_dumpall` reciente (< 2h).

**9.2 Snapshot git y DB**
- Tag `pre-deploy-fase9-<TS>`.
- `pg_dump -Fc aionseg_prod > /var/backups/aion/<TS>/pre-deploy-fase9.dump`.

**9.3 Merge a main local**
- `git checkout main; git merge --no-ff remediation/2026-04-aion-full-audit`.
- Abrir PR a main en GitHub para revisión; merge squash.

**9.4 Deploy VPS**
```
ssh aion-vps '
  cd /var/www/aionseg
  git fetch --all
  git checkout main
  git pull
  pnpm install --frozen-lockfile
  pnpm --filter @aion/backend-api build
  pnpm --filter aion-vision-hub build
  for m in 032 033 034 035 036; do
    sudo -u postgres psql aionseg_prod -v ON_ERROR_STOP=1 -f backend/apps/backend-api/src/db/migrations/${m}_*.sql 2>/dev/null || true
  done
  pm2 reload ecosystem.config.js --update-env
  pm2 save
  sudo systemctl reload nginx
'
```

**9.5 Post-deploy smoke tests**
- `curl -fsS https://aionseg.co/api/health` — 200.
- `curl -fsS -X POST https://aionseg.co/api/auth/login -d '{...}'` — token.
- `curl -N https://aionseg.co/api/events/stream -H 'Authorization: Bearer <tok>'` — primer frame SSE/WS.
- `curl https://aionseg.co/api/v1/incidents?limit=1` — 200.
- `curl https://aionseg.co/api/intercom/calls?limit=1` — 200.

**9.6 Health watch 1h**
- `monitor-observe`: tail `pm2 logs` + error rate nginx, CPU, mem.
- Prometheus query: tasa de 5xx, latencia p95.
- Umbrales: 5xx < 0.5%, p95 < 1s, sin OOM.

**9.7 Rollback plan**
- Documentado en `docs/runbooks/remediation-rollback.md`:
  1. `git checkout <tag pre-deploy>` en VPS.
  2. `pnpm install` + `pnpm build`.
  3. Revertir migración 032 con `032_deprecate_duplicates_DOWN.sql` (renombra back tables).
  4. `pm2 reload`.
- Probado al menos una vez en staging.

**9.8 Canary gradual (opcional por tenant)**
- Activar flags `FX_*` sólo para tenant piloto 24h.
- Si verde → activar para todos.

### Gate Fase 9
- [ ] Deploy exitoso con 0 downtime percibido.
- [ ] Smoke tests verdes.
- [ ] 1h de monitoring sin alertas.
- [ ] Rollback probado.
- [ ] PR mergeado a main + tag `release/aion-v2026.04.<día>`.

---

## FASE 10 — Stream G: E2E Playwright contra producción + reporte final

**Propósito:** Validar flujos críticos contra aionseg.co real y entregar reporte ejecutivo PDF.

### Agentes
- `e2e-runner` (liderazgo)
- `integration-tester`
- `doc-updater`
- `monitor-observe` (snapshots de métricas para el reporte)
- `code-reviewer`

### Tareas

**10.1 Configuración Playwright prod**
- `playwright.config.ts` con proyecto `prod`:
  - `baseURL: process.env.PROD_URL ?? 'https://aionseg.co'`.
  - Workers = 2 (no saturar prod).
  - Credentials test user en `.env.e2e` (no versionado).

**10.2 Specs**
- Existentes: `auth`, `advanced-ai`, `ai-assistant`, `live-view`, `reports`, `events`, `devices-iot`, `patrol`, `dashboard`, `communications`, `access-control`, `operator-flows` (12 specs).
- Nuevos por fase:
  - `clip-export.spec.ts` (Fase 2)
  - `alerts-crud.spec.ts` (Fase 3)
  - `dvr-time-sync.spec.ts` (Fase 4)
  - `iot-scenes.spec.ts` (Fase 5)
  - `intercom-call-history.spec.ts` (Fase 6)
  - `incident-pdf.spec.ts` (Fase 7)
  - `i18n-smoke.spec.ts` (Fase 7)

**10.3 Corrida**
- `PROD_URL=https://aionseg.co pnpm test:e2e:prod --reporter=html`.
- Screenshots + videos + trace para todos los fallos.
- HTML report guardado en `docs/remediation-2026-04/playwright-report/`.

**10.4 Quarantine de flakies**
- Si algún test falla 1 de 3 → `test.fixme` con razón + ticket.
- Umbral global: ≤ 5% flaky.

**10.5 Reporte final `REPORTE_REMEDIACION_AION.md`**
- Secciones obligatorias:
  1. Resumen ejecutivo (estado inicial → final, métricas clave).
  2. Tabla 200 FX con estado final (RESUELTO / MANTENIDO / BLOQUEADO).
  3. Supabase eliminado: checklist verificaciones (grep vacío, supabase/ no existe, 0 .env vars, guardrail endurecido).
  4. Migraciones aplicadas (030-0NN) con hashes y timestamps.
  5. Workers nuevos en PM2 (`clip-export-worker`, `dvr-time-sync-worker`, `asterisk-call-logger`) con uptime post-deploy.
  6. Test coverage antes / después (0% → ≥ 50% en `mcp-bridge/tools/`).
  7. E2E: 12 existentes + 7 nuevos, snapshot del HTML report.
  8. Health checks snapshot (24h post-deploy).
  9. Riesgos residuales y plan de seguimiento.
  10. Anexos: `OPERATION_LOG.md`, `HANDOVER.md`, backups, tags.

**10.6 Conversión a PDF**
- `pandoc docs/remediation-2026-04/REPORTE_REMEDIACION_AION.md -o REPORTE_REMEDIACION_AION.pdf --pdf-engine=xelatex -V mainfont="Helvetica"`.
- Alternativa: `npx md-to-pdf`.
- Copiar al VPS: `scp REPORTE_REMEDIACION_AION.pdf aion-vps:/var/backups/aion/<TS>/`.

**10.7 PR final a main + tag release**
- Si Fase 9 mergeó ya, aquí solo se crea tag `release/aion-v2026.04.<día>`.
- Release notes en GitHub con link al PDF.

**10.8 Notificación**
- Mensaje al canal de Isabella (WhatsApp o similar): link al PR, link al PDF, resumen en 3 bullets.

### Gate Fase 10
- [ ] E2E completo: ≥ 18 specs verdes, ≤ 1 quarantined.
- [ ] Reporte MD + PDF generados y almacenados en backup.
- [ ] Tag `release/aion-v2026.04.<día>` en GitHub.
- [ ] Notificación entregada.

---

## FASE 11 — Cierre, actualización de memoria y retrospectiva

**Propósito:** Persistir aprendizajes, actualizar memoria Claude Code y cerrar la operación.

### Agentes
- `doc-updater`
- `continuous-learning` (skill, no agente, pero aplicable)
- `planner`

### Tareas

**11.1 Actualizar memoria**
- Editar `~/.claude/projects/-Users-ADMIN-Documents-open-view-hub-main/memory/project_remediation_2026_04.md` con sección "Cierre" (fecha, tag release, FX finales).
- Crear `feedback_remediation_lessons.md` con 3-5 aprendizajes reusables (cuándo romper en fases, cuándo usar feature flags, cómo evitar doble trabajo con audits tempranos).
- Actualizar `project_current_state.md` para reflejar el nuevo baseline post-remediación (160+ tablas si hubo nuevas, 27+ PM2 con workers agregados, etc.).
- `MEMORY.md` reindexado.

**11.2 Retrospectiva**
- Archivo `docs/remediation-2026-04/RETROSPECTIVE.md` con: qué funcionó, qué no, qué cambiar en futuras remediaciones.

**11.3 Limpieza final**
- Eliminar ramas obsoletas (`git push origin --delete <legacy>`).
- Comprimir `docs/remediation-2026-04/*_RAW.txt` a un solo tar.
- Revocar credenciales temporales que no deban persistir.

**11.4 Actualizar CLAUDE.md**
- Si hubo nuevos módulos, reflejarlos en la sección "Project Structure".
- Actualizar inventario de endpoints/tablas/workers.

### Gate Fase 11
- [ ] Memoria actualizada con cierre.
- [ ] Retro documentada.
- [ ] CLAUDE.md al día.

---

## Matriz de Archivos

### Migraciones nuevas
```
backend/apps/backend-api/src/db/migrations/
├── 032_deprecate_duplicates.sql                # Fase 1
├── 033_clip_exports_schema.sql (opcional)      # Fase 2
├── 034_alerts_schema_fix.sql (si aplica)       # Fase 3
├── 035_* (si aparecen)                         # Fases posteriores
```

### Backend nuevo
```
backend/apps/backend-api/src/
├── workers/
│   ├── clip-export-worker.ts                   # Fase 2
│   ├── dvr-time-sync-worker.ts                 # Fase 4
│   └── asterisk-call-logger.ts                 # Fase 6
├── services/
│   └── asterisk-ami.ts                         # Fase 6
├── scripts/
│   └── seed-alert-samples.ts                   # Fase 3
├── __tests__/
│   └── tools/
│       ├── _shared/tool-test-helpers.ts        # Fase 8
│       ├── open-gate.test.ts                   # Fase 8
│       ├── trigger-relay.test.ts               # Fase 8
│       ├── reboot-device.test.ts               # Fase 8
│       ├── activate-emergency-protocol.test.ts # Fase 8
│       ├── audit-compliance-template.test.ts   # Fase 8
│       ├── hikvision-ptz-control.test.ts       # Fase 8
│       ├── generate-incident-summary.test.ts   # Fase 8
│       └── check-visitor-blacklist.test.ts     # Fase 8
└── services/pdf-renderer/
    └── incident.ts (si no existe)              # Fase 7
```

### Backend modificaciones
```
backend/apps/backend-api/src/
├── services/
│   ├── hikvision-isapi.ts                      # Fase 4 (setTime)
│   └── dahua-cgi.ts                            # Fase 4 (setTime)
├── modules/
│   ├── intercom/routes.ts                      # Fase 6 (/calls)
│   ├── incidents/routes.ts                     # Fase 7 (PDF)
│   └── alerts/routes.ts                        # Fase 3 (polishing si hace falta)
├── workers/
│   └── notification-dispatcher.ts              # Fase 3 (LISTEN aion_event)
└── ecosystem.config.js                         # Fases 2,4,6 (nuevos procesos)
```

### Frontend nuevo
```
src/
├── components/
│   ├── playback/
│   │   └── ExportClipDialog.tsx                # Fase 2
│   └── domotics/
│       ├── SceneEditor.tsx                     # Fase 5
│       └── ScheduleEditor.tsx                  # Fase 5
├── pages/
│   ├── domotics/
│   │   ├── ScenesPage.tsx                      # Fase 5
│   │   └── SchedulesPage.tsx                   # Fase 5
│   └── CallHistoryPage.tsx                     # Fase 6
├── services/
│   ├── scenes-api.ts                           # Fase 5
│   ├── schedules-api.ts                        # Fase 5
│   └── intercom-calls-api.ts                   # Fase 6
├── i18n/
│   ├── es/fix-batch-2026-04.json               # Fase 7
│   └── en/fix-batch-2026-04.json               # Fase 7
└── lib/
    └── feature-flags.ts                        # Fase 0
```

### Frontend modificaciones
```
src/
├── pages/
│   ├── PlaybackPage.tsx                        # Fase 2 (botón exportar)
│   ├── DevicesPage.tsx                         # Fase 4 (sync hora)
│   ├── DocumentsPage.tsx                       # Fase 7 (cleanup)
│   ├── IncidentsPage.tsx                       # Fase 7 (PDF)
│   └── [15 páginas I18N]                       # Fase 7
└── App.tsx / router                            # Fase 5 (rutas IoT)
```

### Tests
```
src/
├── components/playback/__tests__/ExportClipDialog.test.tsx   # Fase 2
├── services/__tests__/scenes-api.test.ts                     # Fase 5
└── ...
tests/e2e/
├── clip-export.spec.ts                         # Fase 2
├── alerts-crud.spec.ts                         # Fase 3
├── dvr-time-sync.spec.ts                       # Fase 4
├── iot-scenes.spec.ts                          # Fase 5
├── intercom-call-history.spec.ts               # Fase 6
├── incident-pdf.spec.ts                        # Fase 7
└── i18n-smoke.spec.ts                          # Fase 7
```

### Infra VPS
```
/etc/asterisk/manager.conf                      # Fase 6 (AMI user)
/var/www/aionseg/.env                           # Fase 6 (AMI creds)
/var/www/aionseg/ecosystem.config.js            # Fases 2,4,6
```

### Documentación
```
docs/remediation-2026-04/
├── DEDUPE_USAGE_REPORT.md                      # Fase 1
├── ALERTS_AUDIT.md                             # Fase 3
├── IOT_SCENES_API.md                           # Fase 5
├── OPERATION_LOG.md                            # (updateado en cada fase)
├── REPORTE_REMEDIACION_AION.md                 # Fase 10
├── REPORTE_REMEDIACION_AION.pdf                # Fase 10
├── RETROSPECTIVE.md                            # Fase 11
└── playwright-report/                          # Fase 10
docs/runbooks/
└── remediation-rollback.md                     # Fase 9
```

### Memoria
```
~/.claude/projects/-Users-ADMIN-Documents-open-view-hub-main/memory/
├── project_remediation_2026_04.md              # Fase 11 actualizar
├── project_current_state.md                    # Fase 11 actualizar
├── feedback_remediation_lessons.md             # Fase 11 nuevo
└── MEMORY.md                                   # Fase 11 reindexar
```

---

## Matriz Agentes × Fases

| Agente                 | F0 | F1 | F2 | F3 | F4 | F5 | F6 | F7 | F8 | F9 | F10 | F11 |
|------------------------|----|----|----|----|----|----|----|----|----|----|-----|-----|
| planner                | ✓  |    |    |    |    |    |    |    |    |    |     | ✓   |
| architect              |    | ✓  |    |    |    |    | ✓  |    | ✓  |    |     |     |
| db-migration           |    | ✓  | ✓  | ✓  |    |    |    |    |    | ✓  |     |     |
| module-scaffold        |    |    | ✓  | ✓  | ✓  | ✓  | ✓  | ✓  | ✓  |    |     |     |
| tdd-guide              |    |    | ✓  | ✓  | ✓  | ✓  |    |    | ✓  |    |     |     |
| code-reviewer          |    | ✓  | ✓  | ✓  | ✓  | ✓  | ✓  | ✓  | ✓  |    | ✓   |     |
| api-docs-generator     |    |    |    |    | ✓  |    | ✓  | ✓  |    |    |     |     |
| integration-tester     |    | ✓  |    | ✓  |    |    | ✓  |    |    |    | ✓   |     |
| security-reviewer      |    | ✓  |    |    |    |    | ✓  |    |    | ✓  |     |     |
| perf-profiler          |    |    |    |    |    |    |    |    |    | ✓  |     |     |
| e2e-runner             |    |    | ✓  | ✓  |    | ✓  | ✓  | ✓  |    |    | ✓   |     |
| refactor-cleaner       |    |    |    |    |    |    |    | ✓  |    |    |     |     |
| build-error-resolver   | ✓  |    |    |    |    |    |    |    |    | ✓  |     |     |
| doc-updater            | ✓  |    |    |    |    |    |    | ✓  |    |    | ✓   | ✓   |
| deploy-rollback        |    |    |    |    |    |    |    |    |    | ✓  |     |     |
| monitor-observe        | ✓  |    |    |    |    |    |    |    |    | ✓  | ✓   |     |
| incident-response      |    |    |    |    |    |    |    |    |    | ✓  |     |     |
| Explore (sub-agent)    | ✓  | ✓  | ✓  | ✓  |    | ✓  |    | ✓  |    |    |     |     |

---

## Matriz Dependencias

| Fase  | Depende de                                    |
|-------|-----------------------------------------------|
| F0    | (ninguna — baseline)                          |
| F1    | F0                                            |
| F2    | F0 (feature flags)                            |
| F3    | Migración 031 (ya aplicada)                   |
| F4    | F0                                            |
| F5    | F0                                            |
| F6    | F0 + VPS Asterisk config                      |
| F7    | F0                                            |
| F8    | F0                                            |
| F9    | **F1-F8 completos**                           |
| F10   | F9                                            |
| F11   | F10                                           |

El único orden estricto es F9 después de todo lo implementable y F10 después de F9. Las Fases F1-F8 son técnicamente paralelizables pero se secuencian para control de cambios y autorización por fase.

---

## Criterios globales de éxito (post-Fase 11)

- **Supabase 0%** — grep + guardrail + ausencia de `supabase/` dir.
- **FX pendientes cerrados** — los 8 bloques C, los 2 B.2 y todos los audits consolidados.
- **Cobertura tests** — ≥ 80% en `mcp-bridge/tools`.
- **Migraciones aplicadas** — 032 en adelante, con `schema_migrations` completo.
- **3 workers nuevos en PM2** — clip-export-worker, dvr-time-sync-worker, asterisk-call-logger.
- **E2E** — 18+ specs verdes en prod.
- **Health checks** — 24h verdes post-deploy.
- **Reporte PDF entregado** — en VPS `/var/backups/aion/<TS>/`.
- **PR merged a main** — con tag release.
- **Memoria Claude Code actualizada** — proyecto, retro, referencias.

---

## Métricas objetivo vs baseline 2026-04-15

| Métrica                                | Baseline          | Objetivo post-cierre |
|----------------------------------------|-------------------|----------------------|
| FX PARTIAL + PENDING                   | 30                | 0                    |
| Supabase footprint runtime             | 1 dir + 2 envs    | 0                    |
| Test coverage mcp-bridge/tools         | 0%                | ≥ 50% (Opus 100%)    |
| PM2 workers AION                       | 26                | 29 (3 nuevos)        |
| Migraciones aplicadas (post-025)       | 031               | 033-036              |
| E2E specs verdes                       | 12                | 18+                  |
| Líneas i18n faltantes (15 páginas)     | 100+              | < 10                 |
| Tablas duplicadas                      | 3 pares           | 0                    |
| `intercom_calls` escrituras/día        | 0                 | > 20 (real traffic)  |
| `clip_exports` escrituras/día          | 0                 | > 5 (uso operadores) |

---

## Autorización por fase

Cada fase arranca cuando el usuario dice **"autoriza Fase N"** (N = 0 a 11).

Secuencia esperada:
1. Autoriza F0 → ejecución → reporte gate → espera.
2. Autoriza F1 → ejecución → reporte gate → espera.
3. … así hasta F11.

**Interrupción:** el usuario puede decir "detén Fase N" y se congela con estado reproducible y commit parcial.

**Rollback:** "rollback Fase N" revierte esa fase aprovechando feature flags (inmediato) o git revert por commits atómicos + migración `DOWN` si la fase tocó BD.

**Skip:** "skip Fase N" registra la fase como NO APLICADA y deja constancia en `OPERATION_LOG.md` — avanza a Fase N+1 sin ejecutar.

---

## Entrega final esperada

- PR `remediation/2026-04-aion-full-audit` → `main` mergeado.
- Tag `release/aion-v2026.04.<día>` en GitHub.
- Branch `remediation/2026-04-aion-full-audit` conservada 30 días, luego se puede borrar.
- `docs/remediation-2026-04/REPORTE_REMEDIACION_AION.pdf` en VPS + repo.
- Monitoreo continuo 7 días post-cierre (`monitor-observe` con alertas).
- 0 hallazgos FX abiertos en el documento de revisión original (o los abiertos explícitamente BLOCKED con razón técnica + plan de seguimiento).
