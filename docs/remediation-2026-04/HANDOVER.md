# HANDOVER — Remediación AION 2026-04

Este documento enumera lo que queda pendiente después de la sesión 2026-04-15 y cómo retomarlo sin duplicar trabajo.

## Estado al cierre de la sesión

### Completado
- **Fase 0** Pre-vuelo: branch `remediation/2026-04-aion-full-audit`, tag `pre-remediation-20260415-155113`, backup 422M en `/var/backups/aion/20260415-205328/`, SSH `aion-vps` operativo.
- **Fase 1** Auditoría: 7 docs en `docs/remediation-2026-04/`.
- **Stream A** Supabase ELIMINADO: dir `supabase/` borrado (archivo en `docs/remediation-2026-04/archive/`), `src/integrations/supabase/client.ts` degradado a Proxy de error, `.env*` limpios, guardrail endurecido.
- **Stream B parcial** — Migraciones aplicadas a prod:
  - `030_fk_indices` (35 índices)
  - `031_event_notify_triggers` (pg_notify en events/incidents/alert_instances)
- **Stream E** Memoria Claude Code actualizada: `project_remediation_2026_04.md`, `reference_vps_ssh.md`, `MEMORY.md` reindexado.
- **Quick wins prod**: VPS-001 resuelto (openclaw-onboard zombie killed).

### Pendiente — Streams C/D/F/G

Ver `~/.claude/plans/glowing-sparking-biscuit.md` para detalle.

| Stream | Trabajo | Esfuerzo estimado | Prioridad |
|---|---|---|---|
| C.1 | FX-033 Export clips — botón + dialog en PlaybackPage (backend ya tiene `POST /clips/export`) | 2-4 h | alta |
| C.2 | FX-042/043/044 Alertas — script seed + E2E | 3-5 h | media |
| C.3 | FX-031 DVR time sync — `setTime` en Hikvision/Dahua clients + worker PM2 | 4-6 h | alta |
| C.4 | FX-064/065 Escenas IoT — ScenesPage, SchedulesPage, SceneEditor, ScheduleEditor (backend ya 100%) | 6-10 h | media |
| C.5 | FX-083 Asterisk AMI — servicio AMI + worker `asterisk-call-logger` + UI historial | 8-14 h | alta |
| C.6 | FX-108 Documentos — solo limpieza imports muertos (ya funcional) | 30 min | baja |
| C.7 | FX-047 Export incidentes PDF — verificar endpoint existente, agregar template si falta | 2-3 h | baja |
| C.8 | I18N batch — 150+ keys en 15 archivos | 4-6 h | baja |
| D | Tests 8 handlers Opus-tier (open_gate, trigger_relay, reboot_device, activate_emergency_protocol, audit_compliance_template, hikvision_ptz_control, generate_incident_summary, check_visitor_blacklist) | 8-12 h | alta |
| B.2 | Migración 032 deprecate duplicates (audit_log→audit_logs, intercoms/intercom_devices, site_admins/site_administrators) | 2-3 h | media |
| F | Deploy al VPS (git pull, pnpm install, build, pm2 restart, health checks 1h) | 1-2 h | — |
| G | Playwright E2E prod + reporte PDF + PR merge + tag release | 3-5 h | — |

**Total estimado pendiente: 45-70 horas de trabajo técnico dirigido.**

## Cómo retomar

### Antes de empezar
```bash
cd /Users/ADMIN/Documents/open-view-hub-main
git fetch --all
git checkout remediation/2026-04-aion-full-audit
git pull
ssh aion-vps 'hostname; uptime; pm2 list | wc -l'
```

### Flujo por FX
1. **Verificar** que no esté ya implementado (`grep` en `src/` y `backend/`).
2. Leer sección correspondiente en `~/.claude/plans/glowing-sparking-biscuit.md`.
3. Implementar con tests.
4. Agregar entrada en `docs/remediation-2026-04/OPERATION_LOG.md`.
5. Commit con formato `feat(FX-NNN): ...` o `fix(FX-NNN): ...`.
6. Push.

### Deploy (cuando haya un bloque cerrado)
```bash
# 1. Backup adicional en el VPS
ssh aion-vps 'TS=$(date +%Y%m%d-%H%M%S); sudo mkdir -p /var/backups/aion/$TS; sudo chown ubuntu:ubuntu /var/backups/aion/$TS; sudo -u postgres pg_dumpall | gzip > /var/backups/aion/$TS/pre-deploy.sql.gz'

# 2. VPS pull
ssh aion-vps 'cd /var/www/aionseg && git fetch && git checkout remediation/2026-04-aion-full-audit && git pull && pnpm install --frozen-lockfile && pnpm --filter @aion/backend-api build'

# 3. Migraciones nuevas
ssh aion-vps 'sudo -u postgres psql aionseg_prod -f /var/www/aionseg/backend/apps/backend-api/src/db/migrations/<NNN>_<nombre>.sql'

# 4. Restart servicios afectados
ssh aion-vps 'pm2 restart aionseg-api detection-worker notification-dispatcher'

# 5. Health check
curl -fsS https://aionseg.co/api/health
```

## Verificación "sin Supabase"

```bash
# 0 imports en runtime
grep -rE "@supabase/supabase-js|supabase\\.(from|storage|auth|rpc|channel)\\(" \
  src/ backend/apps/backend-api/src/ --include="*.ts" --include="*.tsx" | \
  grep -v "no-supabase-bypass.test.ts" | grep -v "//.*supabase"
# -> 0 resultados en código ejecutable

# supabase/ no existe
ls supabase/ 2>/dev/null && echo "FAIL" || echo "OK: borrado"
```

## Backup de esta operación

- **Git:** branch `remediation/2026-04-aion-full-audit` en remoto, tag `pre-remediation-20260415-155113` también.
- **DB prod:** `/var/backups/aion/20260415-205328/` (postgres-full 5.6M + aionseg_prod.dump 6.2M).
- **Código prod:** `/var/backups/aion/20260415-205328/var-www-aionseg.tar.gz` (160M).
- **Archivo Supabase:** `docs/remediation-2026-04/archive/supabase-legacy-20260415.tar.gz` (117K).
