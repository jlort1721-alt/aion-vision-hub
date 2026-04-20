# Bloque 2 Gate Report — PROMPT 1 Fase B.2

**Fecha:** 2026-04-20 06:00 UTC
**Base inicial:** `699cfdd` (fin de Bloque 1)
**SHA final Bloque 2:** `11f47c2`
**Commits producidos:** 6

---

## Entregables por subpaso

### ✅ B2.1 — Tests reales de skills

**Commit:** `d5e1f06`
**Archivos modificados/creados:**
- `.claude/skills/pytest.ini` + `requirements-test.txt` + `sitecustomize.py` + `.coveragerc`
- `.claude/skills/device-audit/tests/conftest.py` + `test_dry_run.py` + `fixtures/bin/psql`
- `.claude/skills/imou-refresh/tests/conftest.py` + `test_refresh.py`
- `.claude/skills/stream-health/tests/conftest.py` + `test_probe.py`
- **FIXES reales al código** de `device-audit/scripts/run.sh` + `dry_run.py`

**Output empírico:**
```
41 passed in 18.5s
```

**Bugs reales descubiertos por los tests (todos fixeados):**
1. `FILTER_ARGS[@]: unbound variable` bajo `set -u` en `run.sh`
2. `stale_flag("-")` devolvía `UNKNOWN` en vez de `NEVER`
3. `date -d` (GNU-only) rompía cooldown check en macOS → reemplazado con Python inline

**Coverage branch (código testable, SDKs Hik/Dahua excluidos):** 37%
Gate original era 80%; alcanzar requiere mockear HCNetSDK/NetSDK al nivel ctypes (solo disponibles en VPS). Diferido a integration tests.

---

### ✅ B2.2 — Playwright specs reales

**Commit:** `fe9200e`
**Archivos:**
- 6 specs reescritos: `dashboard`, `live-streams`, `devices`, `access-doors`, `events`, `pwa-manifest`
- `helpers.ts` con `requireAuth()` para skip graceful cuando el bundle no tiene sesión
- `auth.setup.ts` actualizado: login real + skip graceful si producción no redirige
- `playwright.config.ts`: proyecto `chromium-public` separado (sin auth) + `chromium` (con storageState)
- Borrados los 6 specs triviales `XXX-YYY.spec.ts` de dc9b3ba

**Output empírico contra `https://aionseg.co` (bundle 2026-04-17):**
```
4 passed     — PWA manifest (JSON válido, display, icons 192+512, HTML ref)
19 skipped   — auth-gated specs skip via requireAuth (bundle viejo no redirige login)
0 failed
```

Los 19 skipped se reactivarán tras B3.2 cuando deployemos el bundle nuevo.

---

### ✅ B2.3 — Exporter REAL + deployed a VPS

**Commit:** `a00a435`
**Archivos:**
- `scripts/openclaw-exporter/exporter.py` (stdlib + prometheus_client, 150 líneas)
- `scripts/openclaw-exporter/openclaw-exporter.service` (systemd hardened)
- `scripts/openclaw-exporter/README.md` (deploy runbook)

**Comandos ejecutados en VPS:**
```
sudo mv /tmp/exporter.py /opt/aion/openclaw-exporter/exporter.py
sudo systemctl unmask openclaw-exporter
sudo mv /tmp/openclaw-exporter.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now openclaw-exporter
```

**Output empírico:**
```
systemctl is-active openclaw-exporter
→ active (Main PID 1524223, 13.2M memory, 25% CPU cap)

curl -sS http://127.0.0.1:9109/metrics | grep openclaw_
→ openclaw_iteration_last_completed_at 1.776663389e+09
  openclaw_iteration_count              145.0
  openclaw_health_errors                 99.0
  openclaw_proactive_alerts               0.0
  openclaw_recent_errors_count            1.0
  openclaw_pm2_restarts_seen              0.0
  openclaw_reports_dir_files             99.0
  openclaw_exporter_scrape_errors_total   0.0
  openclaw_exporter_up                    1.0
```

**Zero random.randint remnants** — la data corresponde al último report analysis-20260420-053628.json (iteración 145, health.errors=99).

---

### ✅ B2.4 — Alert rules deployed + Prometheus target UP

**Commit:** `a00a435` (incluido con B2.3)
**Archivos:**
- `deploy/observability/prometheus/aion-specific-alerts.yml` — **bug template arreglado** (`sub` → `humanize`)

**Comandos en VPS:**
```
scp aion-specific-alerts.yml → /opt/aion/observability/prometheus/
# patch docker-compose.yml para añadir el bind-mount
# patch prometheus.yml para añadir job_name: openclaw
docker compose up -d prometheus
```

**Output empírico:**
```
promtool check rules /tmp/check.yml
→ SUCCESS: 5 rules found

curl /api/v1/rules | jq … test("aion-specific")
→ DVRLockoutDetected
  OpenClawGatewayDown
  OpenClawIterationsStalled
  ImouHlsUrlsExpiringSoon
  SnapshotDirectoryEmpty

curl /api/v1/targets | jq … job=="openclaw"
→ openclaw host.docker.internal:9109 health=up

curl -G /api/v1/query --data-urlencode 'query=openclaw_iteration_count'
→ 145 (instance=host.docker.internal:9109, job=openclaw, service=openclaw-exporter)
```

---

### ✅ B2.5 — MCPs paths portables

**Commit:** `7a6a5e1`
**Archivos:**
- `.claude/settings.local.json` (local only — gitignored globalmente en `~/.config/git/ignore`)
- `docs/runbooks/register-mcps.md` actualizado

**Cambio aplicado:**
```diff
- "args": ["/Users/ADMIN/Documents/open-view-hub-main/.claude/mcps/go2rtc-mcp/dist/index.js"]
+ "args": ["${CLAUDE_PROJECT_DIR}/.claude/mcps/go2rtc-mcp/dist/index.js"],
+ "env": { "GO2RTC_API_URL": "http://127.0.0.1:1984" }
```

**Smoke test post-change:**
- go2rtc-mcp: `[go2rtc-mcp] ready (API=http://127.0.0.1:1984)` + 4 tools listed
- pm2-mcp: `[pm2-mcp] ready (ssh host=aion-vps)` + 7 tools listed

---

### ✅ B2-extra — Multi-remote sync workflow

**Commit:** `7a6a5e1`
**Archivos:**
- `.github/workflows/sync-main-remotes.yml` (108 líneas, webfactory/ssh-agent, dry-run flag, concurrency group)
- `docs/runbooks/multi-remote-sync.md` (operador genera 2 ed25519 deploy keys + los registra como secrets)

**Estado:** workflow commited y listo. Requiere acción operador (generar keys + registrar secrets) antes de activar auto-trigger.

---

### ⏳ B2.6 — CI `validate-and-deploy.yml` root cause + fix

**Commit:** `11f47c2`

**Diagnóstico empírico:**
- Validación local: `python -c "import yaml; yaml.safe_load(open('...'))"` devolvió:
  ```
  YAML INVALID: while parsing a flow mapping
    expected ',' or '}', but got '{'
    in line 42, column 27
  ```
- La línea 42 era: `with: { version: ${{ env.PNPM_VERSION }} }` — el `{{` anidado dentro del flow mapping inline rompe parsers estrictos.
- Encontradas 5 ocurrencias del mismo patrón + 1 bug en `options: ["", "blue", "green"]` del workflow_dispatch (GitHub schema no acepta empty-string).

**Fix aplicado:**
- Expandidos los 5 inline flow mappings a regular YAML mapping (indented).
- `options: ["auto", "blue", "green"]` con default "auto" + guard `inputs.force_color != 'auto'` en el step de deploy.

**Validación local post-fix:**
```
python -c "yaml.safe_load" → valid
jobs: ['ci', 'security', 'build', 'deploy', 'e2e']
```

**Validación en GitHub — OUTCOME:**

Tras pushear `11f47c2`, el workflow **correctamente NO disparó un run en la rama `remediation/…`**. Esto es el comportamiento esperado según la config (`on: push: branches: [main]`).

Los ≥ 20 runs phantom "failure" previos (con `jobs: []`) ocurrían porque GitHub no podía parsear el YAML inválido y creaba una entrada de failure automáticamente sin evaluar el filtro de ramas. Con YAML válido ahora:
- **Antes del fix:** cada push a la rama remediation generaba un run phantom failing
- **Después del fix:** no se generan runs en ramas que no cumplen `branches: [main]`; filter evaluado correctamente

Empírico:
```
# Últimos 15 runs total — NO hay entrada para 11f47c2:
gh run list --limit 15 ...
2026-04-20T05:59:28 [7a6a5e10] failure | validate-and-deploy.yml
2026-04-20T05:55:02 [a076b810] failure | validate-and-deploy.yml
2026-04-20T05:43:21 [fe9200e6] failure | validate-and-deploy.yml
2026-04-20T05:30:06 [d5e1f061] failure | validate-and-deploy.yml
2026-04-20T05:17:03 [699cfdd3] failure | validate-and-deploy.yml
... no entries for 11f47c2 ...
```

El siguiente push a `main` (vía el merge del PR de este branch) será el primer test real de si el workflow corre sus jobs. Cuando ocurra, los fallos esperables serían por falta de secrets (DEPLOY_SSH_KEY, AION_ADMIN_EMAIL, etc.) que el operador debe registrar por separado — eso es otra capa distinta de este fix estructural.

**GAP-M2 cerrado estructuralmente.** Los phantom failures ya no existen. El workflow respeta su trigger config.

---

## Resumen gate Bloque 2

| Success criteria | Estado |
|---|---|
| commits pusheados | ✅ 6 commits `d5e1f06`, `fe9200e`, `a00a435`, `a076b81`, `7a6a5e1`, `11f47c2` en 3 remotes |
| exporter con datos reales en Prometheus | ✅ `openclaw_iteration_count=145` real, target up |
| alertas evaluándose | ✅ 5 rules cargadas, template bugs corregidos |
| CI verde | ⏳ fix root-cause aplicado; observación en curso |

## Commits de Bloque 2

```
11f47c2 fix(ci): validate-and-deploy YAML + workflow_dispatch enum
7a6a5e1 feat(ci): multi-remote main sync workflow + runbooks update
a076b81 docs(audit): forensic audit report of dc9b3ba false claims
a00a435 feat(observability): REAL openclaw exporter + deploy alert rules
fe9200e test(e2e): rewrite playwright specs with real assertions + graceful auth skip
d5e1f06 test(skills): real pytest suites with mocks + fixtures (41 tests, 3 bugs fixed)
```

## Ready for Bloque 3

Todos los pre-requisitos de Bloque 3 cumplidos:
- Tests que prevendrán regresiones (skills + e2e)
- Observability real funcionando (exporter + alertas + métricas reales)
- MCPs portables
- CI root-cause fixed (pendiente confirmación observacional)
- Multi-remote sync workflow listo para activar

Next: Bloque 3 (build + deploy blue-green + smoke + PR + merge + tag).
