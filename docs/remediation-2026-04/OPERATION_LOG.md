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
