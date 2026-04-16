# AUTORIZACION.md — Sesión de remediación AION 5 horas

## Otorgante

**Isabella** — Propietaria, lead developer y responsable técnica de Clave Seguridad CTA y de la plataforma AION (`aionseg.co`).
**Email de la cuenta propietaria:** `jlort1721@gmail.com`

## Beneficiarios

- **Claude Code CLI** — Ejecutor principal, único autorizado a commitear.
- **Codex CLI** — Consultor, segundo par de ojos para refactors / debugging / generación de tests.
- **Gemini CLI** — Revisor de contexto largo / análisis de seguridad estático / generación de seeds masivas.

Estos tres agentes operan coordinados durante una sesión continua de cinco (5) horas en Antigravity sobre el repositorio de AION y el VPS AWS São Paulo.

## Alcance autorizado (sin requerir confirmación adicional)

1. Iniciar sesión en `https://aionseg.co` con la cuenta propietaria, usando la contraseña inyectada por variable de entorno `AION_OWNER_PASSWORD` (nunca commiteada en claro).
2. Ejecutar Playwright E2E con login real contra producción.
3. Ejecutar pruebas de carga moderadas (k6 ≤50 vUsers, ≤5 min) en ventana de bajo tráfico (02:00–05:00 hora Colombia).
4. Ejecutar escaneos de seguridad: `testssl.sh`, `nikto`, ZAP **baseline** (no full-active scan en horario diurno).
5. Acceder al VPS por SSH; leer logs; reiniciar servicios PM2/systemd/Docker; aplicar parches; modificar `.env` local; recargar Nginx tras `nginx -t`.
6. Conectarse a PostgreSQL con credenciales del backend para crear/aplicar migraciones Drizzle, seeds y correcciones puntuales (siempre con backup previo en `./audit/backups/<timestamp>/`).
7. Interactuar con dispositivos físicos integrados (Hikvision ISAPI, Dahua Platform Access, eWeLink, controladores de acceso, Asterisk SIP, LPR, MQTT) cuando estén accesibles desde el VPS.
8. Instalar dependencias, paquetes, herramientas, binarios y servicios necesarios para el avance.
9. Modificar código fuente, configuraciones, variables de entorno, reglas de firewall, cron jobs, workflows n8n.
10. Crear, modificar, reemplazar o eliminar archivos del repositorio y del VPS dentro del ámbito de AION.
11. Enviar mensajes de prueba reales por Twilio (1 WhatsApp + 1 SMS + 1 voz) al número de la propietaria para validar integraciones.
12. Crear hasta cuatro (4) usuarios efímeros de auditoría (`audit_admin`, `audit_supervisor`, `audit_operador`, `audit_guarda`) con contraseñas aleatorias, y eliminarlos al cierre.
13. Tagear releases con `git tag cert-v<N>-<fecha> && git push --tags` al certificar.

## Restricciones

- **No tocar cuentas de usuarios reales** fuera de la propietaria y los 4 efímeros de auditoría.
- **No exfiltrar PII** fuera del VPS (ni logs ni dumps con datos personales en claro).
- **No ejecutar fuzzing destructivo** ni escaneos active full en horario diurno sin autorización adicional.
- **No publicar credenciales** ni secretos en el repositorio. Si se generan tokens nuevos, registrarlos en `./audit/ROTACION_CREDENCIALES.md` y rotarlos al cierre.
- **No mergear a `main`** cambios que rompan tests existentes sin aviso explícito en `STATE.md` y plan de rollback documentado.

## Vigencia

Esta autorización rige durante la sesión de cinco (5) horas y se considera tácitamente prorrogada hasta que se emita el `CERTIFICADO_AION_v<N>.pdf` final con resultado **CERTIFICADO 100%** (o un dictamen alternativo aceptado por la propietaria). Al cierre:

1. Rotar contraseña de `jlort1721@gmail.com`.
2. Eliminar usuarios efímeros de auditoría.
3. Invalidar tokens/sesiones generados durante la sesión.
4. Archivar `./audit/` con el tag de certificación.

## Firma

`Isabella — propietaria` (autorización implícita por colocación de este archivo en la raíz del repo y ejecución del prompt de arranque)

---
**Fecha de inicio de sesión:** se registra automáticamente en `STATE.md` al primer commit.
