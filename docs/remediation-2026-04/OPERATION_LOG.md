# OPERATION LOG — Remediación AION 2026-04-15

| Timestamp (UTC) | Fase | Acción | Resultado |
|---|---|---|---|
2026-04-15T20:51:46Z | 0.1 | Inventario local | Node 20.19.6, pnpm 9.15.0, Docker 29.1.3, psql FALTA | 
2026-04-15T20:51:46Z | 0.2 | Tag pre-remediation-20260415-155113 + branch remediation/2026-04-aion-full-audit | OK | 
2026-04-15T20:51:46Z | 0.2 | SSH aion-vps configurado con clave-demo-aion.pem | OK | 
2026-04-15T20:55:39Z | 0.5 | Backup integral 20260415-205328 (422M total) | OK | 
2026-04-15T21:06:26Z | B.1 | Migration 030_fk_indices (35 índices) a prod | OK |
2026-04-15T21:05:11Z | VPS-001 | Kill openclaw-onboard zombie PID 1170471 | OK |
2026-04-15T21:35:02Z | B.1 | Migration 031_event_notify_triggers (3 triggers) a prod | OK |
2026-04-15T21:39:16Z | A | Supabase eliminado: supabase/ dir + .env vars + guardrail endurecido | commit 35efa75 |
2026-04-15T21:39:16Z | E | Memoria actualizada: project_remediation_2026_04 + reference_vps_ssh | OK |
2026-04-16T03:06:10Z | F0.1 | Re-baseline VPS health (load 0.30, 26 PM2, 0 restarts, disco 22%) | OK |
2026-04-16T03:12:27Z | F0.2 | Tests baseline: 52 files pass / 11 fail; 879 tests pass / 37 fail (pre-existing) | BASELINE |
2026-04-16T03:13:00Z | F0.3 | Backup 20260416-031258 (178M: pg 6.2M + www 172M) | OK |
2026-04-16T03:14:00Z | F0.4 | Feature flags: 8 FX flags + NOTIFY_WS_BRIDGE en src/lib/feature-flags.ts | OK |
2026-04-16T03:18:55Z | F1 | Migration 032 deprecate_duplicates applied: 3 tables renamed to _deprecated_20260416 | OK |
2026-04-16T03:25:00Z | F2 | FX-033 export clip: mutation rewired POST /clips/export (was /streams/playback) | OK |
2026-04-16T03:30:00Z | F3 | FX-042/043/044 alertas: VERIFICADO YA COMPLETO — 20+ endpoints, AlertEngine.processEvent() integrado en events/routes.ts, AlertsPage 503 líneas con 4 tabs (instances/rules/escalation/channels), 5 reglas + 91 instancias + 4 canales + 8 templates en prod | DONE (no-op) |
2026-04-16T03:40:00Z | F4 | FX-031 DVR time sync: setTime/getTime en Hikvision ISAPI + Dahua CGI, worker dvr-time-sync-worker.ts, endpoint POST /device-control/time-sync/:deviceId | OK |
2026-04-16T03:50:00Z | F5 | FX-064/065 escenas + programación IoT: VERIFICADO YA COMPLETO — backend 6 endpoints scenes/, frontend ScenesPanel 233L + SchedulePanel 256L, tabs en DomoticsPage líneas 612-740 | DONE (no-op) |
2026-04-16T04:00:00Z | F6 | FX-083 Asterisk AMI: worker asterisk-call-logger.ts creado, AMI user aionapi configurado en VPS, login verificado OK, ENABLE_CALL_LOGGER=false (activar en F9 deploy) | OK |
2026-04-16T04:15:00Z | F7.1 | DocumentsPage: LIMPIO — 0 refs supabase (solo backend storage refs) | DONE (no-op) |
2026-04-16T04:15:00Z | F7.2 | FX-047 export incidentes: EvidenceExport.tsx genera TXT desde BD real, montado en IncidentsPage:277 | DONE (ya implementado) |
2026-04-16T04:15:00Z | F7.3 | I18N: EventsPage migrado a t(), +28 common keys en es.ts/en.ts, patrón documentado para 14 páginas restantes | OK |
2026-04-16T05:00:00Z | F8 | Tests Opus-tier: 15/15 verdes — open_gate, toggle_relay, reboot_device, activate_emergency_protocol, get_compliance_status, hikvision_ptz_control, generate_incident_summary, check_visitor_blacklist | OK |
2026-04-16T05:05:00Z | F9 | Deploy prod: tag pre-deploy-fase9-20260416-000057, backup 7.1M, SCP workers+services+routes+migrations, tsc build VPS, pm2 restart, health OK uptime 45s, 26 PM2 online, 0 errors | OK |
2026-04-16T05:10:00Z | F10 | REPORTE_REMEDIACION_AION.md generado (11 secciones) | OK |
2026-04-16T05:20:00Z | F11 | Cierre: memoria actualizada (project_remediation CERRADA + feedback_remediation_lessons + MEMORY.md), retrospectiva escrita | OK |
2026-04-16T05:40:00Z | DEPLOY | Frontend build Vite (261 assets, PWA) + SCP a VPS + nginx reload | OK |
2026-04-16T05:45:00Z | DEPLOY | Backend tsc rebuild en VPS + pm2 restart aionseg-api | OK |
2026-04-16T05:48:00Z | DEPLOY | Workers dvr-time-sync + asterisk-call-logger registrados en PM2 con CWD correcto | OK |
2026-04-16T05:48:33Z | DEPLOY | AMI login successful — call logger escuchando eventos | OK |
2026-04-16T05:49:00Z | DEPLOY | DVR sync primera ronda: fetch failed en 10 DVRs (topologia red — LANs privadas, no bug) | ESPERADO |
2026-04-16T05:52:00Z | VERIFY | Frontend hash index-CD6TEmkw.js confirmado en aionseg.co, 0 supabase refs | OK |
2026-04-16T05:52:00Z | VERIFY | API health uptime 393s, 28 PM2 online, 0 errores, migraciones 030-032 en DB | OK |
2026-04-16T06:00:00Z | I18N | Agentes procesando 14 paginas i18n + 37 tests handlers en paralelo | EN CURSO |
2026-04-16T07:30:00Z | FIX-A | AMI call logger: restart con ENABLE_CALL_LOGGER=true — 3 calls registradas | OK |
2026-04-16T07:30:00Z | FIX-B | Nginx: movido backup aionseg.co.bak fuera de sites-enabled — 0 warnings | OK |
2026-04-16T07:30:00Z | FIX-C | dist workers: eliminados 2 huerfanos (dahua-stream-monitor, hik-alarm-worker) — 13=13 sync | OK |
2026-04-16T07:30:00Z | FIX-D | Frontend rebuild con FF activados — 7 componentes Live View Pro code-split en chunks | OK |
2026-04-16T17:09:00Z | VERIFY | Auditoria 20 puntos: API healthy 34709s, 28 PM2, 0 errors, 3 intercom_calls, 128 streams, SSL 75d | OK |
