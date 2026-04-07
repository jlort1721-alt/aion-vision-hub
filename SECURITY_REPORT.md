# Reporte de Seguridad — AION Vision Hub

**Fecha:** 2026-04-07
**Tipo:** Auditoria y remediacion

---

## Hallazgos y Estado

| # | Hallazgo | Severidad | Estado | Accion |
|---|----------|:---------:|:------:|--------|
| 1 | .gitignore no cubria deploy/RUNBOOK.sh | CRITICO | ✅ CERRADO | Regla agregada |
| 2 | .gitignore no cubria deploy/go2rtc-*.yaml | CRITICO | ✅ CERRADO | Regla agregada |
| 3 | Archivo duplicado twilio.service 2.ts | ALTO | ✅ CERRADO | Eliminado |
| 4 | FK faltantes en liveViewLayouts/streams/playbackRequests | ALTO | ✅ CERRADO | FK constraints agregados |
| 5 | Sin indexes en audit_logs | ALTO | ✅ CERRADO | 5 indexes agregados |
| 6 | profiles.email sin unique | MEDIO | ✅ CERRADO | Unique (email, tenant_id) |
| 7 | TypeScript noImplicitAny: false | ALTO | ✅ CERRADO | Habilitado strict mode |
| 8 | CI typecheck no bloqueante | ALTO | ✅ CERRADO | `\|\| true` removido |
| 9 | Docker container como root | ALTO | ✅ CERRADO | USER appuser |
| 10 | ESLint no-unused-vars off | MEDIO | ✅ CERRADO | Habilitado como warn |
| 11 | Sin ErrorBoundary global | ALTO | ✅ CERRADO | AppErrorBoundary creado |
| 12 | Sin backend tests en PR | ALTO | ✅ CERRADO | Agregado a pr-check.yml |

## Pendientes del Usuario (requieren acceso a proveedores)

| # | Hallazgo | Severidad | Estado | Accion Requerida |
|---|----------|:---------:|:------:|------------------|
| 13 | Secretos en historial Git | CRITICO | ⏳ PENDIENTE | Ejecutar git filter-repo + force push |
| 14 | API keys comprometidas (OpenAI, Anthropic, etc.) | CRITICO | ⏳ PENDIENTE | Rotar en cada proveedor |
| 15 | JWT_SECRET expuesto | CRITICO | ⏳ PENDIENTE | Generar nuevo con rotate-secrets.sh |
| 16 | Database password expuesto | CRITICO | ⏳ PENDIENTE | Cambiar en Supabase |
| 17 | CREDENTIAL_ENCRYPTION_KEY expuesto | CRITICO | ⏳ PENDIENTE | Rotar + re-encriptar dispositivos |
| 18 | 204 RTSP credentials en go2rtc yamls | CRITICO | ⏳ PENDIENTE | Cambiar passwords en DVR/NVR |
| 19 | 17 device passwords en RUNBOOK.sh | CRITICO | ⏳ PENDIENTE | Cambiar en dispositivos fisicos |

## Herramientas Creadas

- `scripts/rotate-secrets.sh` — Genera nuevos valores y guia de rotacion
- `scripts/reencrypt-credentials.js` — Re-encripta credenciales con nueva key

## Recomendaciones Adicionales

1. Habilitar GitHub Secret Scanning en el repositorio
2. Configurar Dependabot para alertas de vulnerabilidades
3. Usar AWS Secrets Manager o similar para produccion
4. Implementar key rotation automatica trimestral
