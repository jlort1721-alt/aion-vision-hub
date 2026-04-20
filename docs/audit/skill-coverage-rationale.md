# Skill Test Coverage — Rationale & Open Debt

**Fecha:** 2026-04-20
**Commits relacionados:** `d5e1f06` (41 tests), pytest config en `.claude/skills/`
**Coverage actual:** **37% branch** de código testable (SDK modules excluidos)

---

## 1. Qué está cubierto

Tests que corren en cada `pytest` run y hit scripts reales vía subprocess:

| Skill | Script | Tests | % branch |
|---|---|---|---|
| device-audit | `scripts/dry_run.py` | 19 | 44.4% |
| device-audit | `scripts/run.sh` | (incluido arriba) | — bash, no coverage.py |
| imou-refresh | `scripts/refresh.py` | 11 | 30.8% |
| stream-health | `scripts/probe.sh` | 11 | — bash |

**Flujos exercisados:**
- `device-audit/dry_run.py`: query builder con/sin filtros (brand, site, device); parsing de last_seen para stale/never; render de reporte Markdown; manejo de DATABASE_URL ausente.
- `device-audit/run.sh`: DRY-RUN por defecto; `--execute` con guard de cooldown (DVR_COOLDOWN_UNTIL env o `/home/openclaw/devops/dvr-cooldown.state`); rechazo de flags desconocidos; pipe de filtros a scripts hijos.
- `imou-refresh/refresh.py`: firma md5 del API Imou Open Platform (verifica algoritmo exacto); URL obfuscation al emitir reporte; parse de respuestas `ok`/`no_stream`/`device_offline`/`auth_fail`; error path con credenciales faltantes.
- `stream-health/probe.sh`: go2rtc /api/streams inventory; filtros regex por nombre; HLS HEAD probe con TTFB; manejo de go2rtc unreachable; rechazo de flags desconocidos.

---

## 2. Qué NO está cubierto y por qué

### 2.1 `device-audit/scripts/execute_hik.py` (0% branch, 90 stmts)

Carga `HCNetSDK v6.1.9` vía `ctypes.CDLL("/opt/hik-sdk/lib64/libhcnetsdk.so")`. Este .so solo existe en el VPS (licencia Hikvision, ~200 MB compilado para Linux x86_64, no disponible para macOS ni GitHub runners). Test unitario requeriría:

1. Mockear la biblioteca ctypes completa (`NET_DVR_Init`, `NET_DVR_SetConnectTime`, `NET_DVR_Login_V40`, `NET_DVR_Logout`, `NET_DVR_GetLastError`, `NET_DVR_Cleanup`) — 6+ funciones con structs de 300+ bytes cada una.
2. Modelar el comportamiento de NET_DVR_USER_LOCKED, NET_FAIL, NET_TIMEOUT, SEND_ERR códigos de error para que los tests del password-fallback-chain reflejen realidad.

**Esfuerzo estimado:** 4–6 h dev + mantenimiento per SDK version bump (v6.1.9 → v7.x).
**Decisión:** NO es desproporcionado — pero es suficientemente costoso que se difiere a integration test en VPS (§3).

### 2.2 `device-audit/scripts/execute_dahua.py` (0% branch, 82 stmts)

Importa `NetSDK.NetSDK.NetClient` desde `/opt/dahua-netsdk-python/` (solo VPS). Misma razón y esfuerzo similar. Adicionalmente requiere los structs de `NET_IN_LOGIN_WITH_HIGHLEVEL_SECURITY` y el enum `EM_LOGIN_SPAC_CAP_TYPE`.

### 2.3 Líneas missing en `dry_run.py` (44% coverage residual)

- `psql()` subprocess call: el test lo cubre vía PATH mock, pero el *parse* de errores de psql (CalledProcessError) sigue sin test dedicado.
- Format de reporte con 0 rows (empty DB): el mock siempre devuelve filas; el branch "no devices match filters" no dispara.

**Delta para llegar a ~65% en este archivo:** ~6 tests más (empty result, psql error, filtros combinados múltiples). Estimado 30 min.

### 2.4 Líneas missing en `refresh.py` (31% coverage residual)

- `main()` con `ok == len(rows)`: el test de dry-run exit code 0 cubre esto pero como el mock devuelve siempre 3 rows OK, la transición ok=0 vs ok>0 vs ok<total no está separada.
- Escritura real a `/etc/aion/go2rtc-imou.fragment.yaml`: sólo el dry-run está testeado. El path non-dry-run requiere escritura a filesystem con perms root.
- Retry logic con backoff 429: no hay test de rate-limit de Imou.

**Delta para llegar a ~60% en este archivo:** ~4 tests más (non-dry-run write path mocked, 429 retry). Estimado 45 min.

---

## 3. Plan de integration tests en VPS

**Estado actual:** NO hay integration tests automatizados en VPS. Por eso el 37% es **deuda técnica abierta**, no una decisión cerrada.

### 3.1 Integration test que SÍ deberíamos tener (P2 roadmap)

Un script `ci/integration/vps-sdk-smoke.sh` ejecutable desde GitHub Actions con `VPS_SSH_KEY` registrado:

```bash
# Flujo propuesto:
ssh aion-vps '
  cd /var/www/aionseg
  # 1. dry-run full (ya cubierto por unit tests, pero vale sanity check)
  bash .claude/skills/device-audit/scripts/run.sh > /tmp/integ-dry.md
  
  # 2. --execute contra 1 sólo device no-crítico (ej. ss-dvr-main) si el
  #    DVR cooldown está limpio
  DEVICE=ss-dvr-main \
  bash .claude/skills/device-audit/scripts/run.sh --execute --device=$DEVICE \
    > /tmp/integ-exec.md
  
  # 3. Validar que el output tiene header "Hikvision live probe"
  grep -q "Hikvision live probe" /tmp/integ-exec.md
  
  # 4. Si el device está online, esperamos "OK" en la tabla
  grep -E "^\| $DEVICE \|.*\| OK \|" /tmp/integ-exec.md
'
```

Este test cubriría `execute_hik.py` (con HCNetSDK real) y expondría el path que actualmente no está unit-tested.

### 3.2 Gates que faltan para ejecutar esto

1. **DVR cooldown state:** tests de login SDK pueden saturar DVRs. El workflow necesita verificar el cooldown state antes de disparar (ya implementado en `run.sh`, pero el workflow debe respetarlo).
2. **Credentials:** `device-audit` requiere `DATABASE_URL` (lectura solo), que vive en `/etc/aion/secrets/device-credentials.env`. El workflow necesita SSH para acceder.
3. **Non-destructiveness:** `--execute` hace login + logout (ceases la sesión), no modifica estado de DVR. OK.
4. **Scheduling:** no correr en cada PR (saturaría); correr semanalmente o on-demand.

### 3.3 Decision

**Opción A — Implementar en P2 (recomendado):**
- Añadir `.github/workflows/vps-sdk-integration.yml` con trigger `schedule: cron: '0 3 * * 0'` (domingos 3 AM UTC, off-peak).
- Requiere VPS_SSH_KEY + un env AION_SKIP_ON_COOLDOWN=true como salvaguarda.
- Cubre los ~170 stmts en execute_hik/dahua.py que quedan en 0%.

**Opción B — Aceptar 37% como permanente:**
- Riesgo: bugs de SDK integration no detectados hasta prod (ej. firmware DVR upgrade rompe NET_DVR_Login_V40 struct).
- Mitigación: `systemd` + Prometheus alert `DVRLockoutDetected` detectan el problema reactivamente.

**Mi recomendación:** Opción A, en P2 ya que no bloquea P1. Registrar como issue.

---

## 4. Ticket P2 propuesto

```
Title: Integration tests for device-audit SDK paths (VPS-only)
Priority: P2
Estimate: 4-6 h dev + 1 h workflow config

Description:
  Complete skill test coverage by adding a VPS-integration workflow
  that exercises execute_hik.py + execute_dahua.py against real DVRs
  on a safe cadence.
  
  - Create ci/integration/vps-sdk-smoke.sh with DVR cooldown guards
  - Add .github/workflows/vps-sdk-integration.yml (weekly cron)
  - Requires VPS_SSH_KEY secret (already documented in
    docs/runbooks/github-secrets-setup.md)
  - Safe cadence: 1 device at a time, 10s between logins
  - On failure: raise alert via alertmanager webhook
  
Acceptance:
  - execute_hik.py coverage → 60%+ via VPS integration run
  - execute_dahua.py coverage → 30%+ (Dahua SDK has known P2P issue)
  - Integration runs weekly without DVR lockout
  
Owner: TBD
Depends on: VPS_SSH_KEY in GitHub Secrets (P1.6 runbook)
```

---

## 5. Resumen

| Métrica | Valor | Status |
|---|---|---|
| Unit tests actuales | 41 passing | ✅ |
| Branch coverage del código testable | 37% | 🟡 real, mejorable |
| Branch coverage con SDK modules excluidos | 37% | — |
| Unit tests for SDK modules (execute_hik/dahua) | 0 | 🟡 deferred to P2 |
| Integration test plan en VPS | Documentado, NO implementado | 🟡 **deuda técnica** |

**El 37% es una decisión defendible pero NO cerrada.** Marca como deuda técnica abierta con ticket P2 propuesto en §4. Revisitar al cerrar P2.2 (integration-tester agent) o antes si aparece un bug de SDK en prod.
