---
name: device-audit
description: Dry-run SDK device auditor for 28 Hikvision (HCNetSDK) + 13 Dahua (NetSDK Python) registered in aionseg backend. Default is DRY-RUN (inventory only); real SDK login only with --execute + cooldown check.
---

# device-audit

Auditor de estado SDK para los 41 dispositivos físicos registrados en `aionseg_prod.devices`.

**Marca principal:** seguridad ante saturación de sesiones DVR/NVR. Por defecto **no contacta** a ningún equipo — sólo inventario + health de tabla + último evento por device. La modalidad real (`--execute`) exige:
1. Flag explícito `--execute`.
2. Lectura de `/home/openclaw/devops/dvr-cooldown.state` o variable `DVR_COOLDOWN_UNTIL` — si el timestamp UTC es futuro, el skill aborta.
3. Spacing mínimo entre logins (1.5 s Hikvision, 2.0 s Dahua).

## Cuándo usar

- Tras cambios en passwords masivos (actualizar `device.password_alt`).
- Diagnóstico pre-release ("¿cuántos devices login OK hoy?").
- Follow-up de incidente de lockout DVR (confirmar recovery).

## Cuándo NO usar

- Si hay cooldown DVR activo y el usuario no puede confirmar reposo ≥ 4 h.
- Si hay operación de producción (live view activo) que satura sesiones.
- Inmediatamente después de un deploy del backend (esperar estabilización).

## Modos

| Modo | Flag | Efecto |
|---|---|---|
| Dry-run (default) | — | Inventario desde DB + health columns + último evento, sin login SDK |
| Ejecutar | `--execute` | Login real SDK con safety checks, genera reporte con channels + firmware |
| Filtro marca | `--brand=hikvision\|dahua` | Limita al subset |
| Filtro sitio | `--site=<slug>` | Limita al sitio (p. ej. `portal-plaza`) |
| Un solo device | `--device=<id>` | UUID del device |

## Invocación

```bash
# Dry-run todos
bash .claude/skills/device-audit/scripts/run.sh

# Dry-run solo Hikvision
bash .claude/skills/device-audit/scripts/run.sh --brand=hikvision

# Real (requiere cooldown limpio)
bash .claude/skills/device-audit/scripts/run.sh --execute --brand=hikvision
```

## Output

Genera `/tmp/device-audit-<YYYYMMDD-HHMM>.md` usando `templates/report.md.tpl`.

Columnas: `device_name | brand | site | ip:port | last_seen_db | dry_status | (login_ok|channels|firmware si --execute)`.

## Safety guards implementadas

1. **DVR_COOLDOWN_UNTIL check** en `run.sh` antes de permitir `--execute`.
2. **Max sesiones concurrentes: 1** (loop secuencial, nunca xargs -P).
3. **Timeout 5 s** por login (NET_DVR_SetConnectTime 5000 ms / NetSDK timeout 5).
4. **Logout immediate** tras capturar info (no se mantiene sesión abierta).
5. **Password fallback chain**: `device.password` → `device.password_alt` → `device.password_alt2`. Al primer login OK rompe.

## Salida esperada ejemplo

```
DRY-RUN @ 2026-04-20T02:45
device_name            brand       site              ip:port          last_event    dry_status
portal-plaza-dvr1      hikvision   portal-plaza      10.0.0.5:8000    12m ago       IN-DB
danubios-nvr           dahua       danubios          AJ00421PAZF2E60  2h ago        IN-DB
terrazino-ipc-01       dahua       terrazino         AL02505PAJ638AA  5h ago        IN-DB-STALE
...

Total: 41 | in DB: 41 | stale (>6h last_event): 7
Cooldown state: DVR_COOLDOWN_UNTIL=2026-04-19T06:00Z (expired) — --execute allowed
```

## Archivos

- `SKILL.md` — este archivo
- `scripts/run.sh` — orquestador bash (parsea flags, llama python)
- `scripts/dry_run.py` — consulta DB y genera reporte sin SDK
- `scripts/execute_hik.py` — real login HCNetSDK ctypes (sólo con --execute)
- `scripts/execute_dahua.py` — real login NetSDK Python 2.0.0.1 (sólo con --execute)
- `templates/report.md.tpl` — plantilla Markdown de salida

## Dependencias

- `psql` client (DB en localhost o VPN).
- `python3` (para `--execute` con ctypes).
- `HCNetSDK v6.1.9` en `/opt/hik-sdk/lib64/` (solo VPS).
- `NetSDK Python 2.0.0.1` en `/opt/dahua-netsdk-python/` (solo VPS).

## Notas

- El skill detecta si corre en local (solo dry-run disponible) o en el VPS (ejecuta real si `--execute`).
- `DATABASE_URL` se toma de `/etc/aion/secrets/device-credentials.env` en VPS o `$DATABASE_URL` local.
- Nunca commitea el reporte (rutas en `/tmp`).
