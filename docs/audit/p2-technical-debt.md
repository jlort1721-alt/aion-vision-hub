# P2 Technical Debt Tracker

**Created:** 2026-04-20 (during PROMPT 1 Fase B closure)
**Owner:** TBD
**Reviewed:** 2026-04-20

Tracks technical debt deferred from P1 closure. Each item is a candidate P2 ticket with enough context that a follow-up agent or engineer can pick it up without re-doing the research.

---

## 1. Typecheck errors heredados pre-P1

### 1.1 Status

`pnpm typecheck` reports **178 TypeScript errors across 35 files**. Verified these EXIST on `main` (pre-B2/B3) via `git checkout main && pnpm typecheck`. Same count. **Not a regression from remediation work.**

### 1.2 Baseline gate mechanism (D.3)

The B3.1 build pipeline uses a **non-regression gate** instead of demanding zero errors:

```bash
pnpm typecheck 2>&1 | tee /tmp/typecheck.log
ERR_COUNT=$(grep -cE "^src/[^ ]+\.ts[x]?\([0-9]+,[0-9]+\): error TS" /tmp/typecheck.log || true)
BASELINE=178
if [ "$ERR_COUNT" -gt "$BASELINE" ]; then
    echo "REGRESSION: $ERR_COUNT errors (baseline $BASELINE)"
    exit 1
fi
echo "baseline preserved: $ERR_COUNT / $BASELINE errors"
```

Rationale: blocking merges on 178 pre-existing errors stops P1 closure indefinitely. Blocking only on NEW errors (count > baseline) forces all future PRs to maintain or reduce the count. When the count reaches 0, we remove the gate entirely. As of this writing the baseline is frozen at **178** on `main` + `remediation/2026-04-aion-full-audit` (identical).

### 1.3 Error distribution

Top 10 error codes:

| Code | Count | Category |
|---|---|---|
| `TS2322` | 68 | Type not assignable |
| `TS1117` | 30 | Duplicate property in object literal (mostly `i18n/*.ts`) |
| `TS2339` | 28 | Property does not exist on type |
| `TS2345` | 21 | Argument type not assignable |
| `TS2578` | 5 | Unused `@ts-expect-error` directive (stale test code) |
| `TS2538` | 4 | Type cannot be used as index |
| `TS2304` | 4 | Cannot find name |
| `TS2365` | 3 | Operator cannot be applied |
| `TS18046` | 3 | Element implicitly has `any` type |
| `TS2739` | 2 | Missing properties on type |

Concentrations (files with >= 5 errors):

| File | Count | Notes |
|---|---|---|
| `src/i18n/en.ts` | 15 | TS1117 — duplicate keys across translation entries |
| `src/i18n/es.ts` | 15 | Mirror of en.ts |
| `src/pages/OperationsPanelPage.tsx` | 17 | Type drift in state handlers |
| `src/pages/IncidentsPage.tsx` | 12 | Missing types on severity enums |
| `src/pages/DomoticsPage.tsx` | 10 | External device payload types |
| `src/pages/OperationalReportsPage.tsx` | 9 | Chart props |
| `src/pages/ShiftsPage.tsx` | 7 | Calendar props |
| `src/pages/ContractsPage.tsx` | 6 | Form state types |
| `src/pages/CompliancePage.tsx` | 6 | idem |
| `src/test/lib/push-notifications.test.ts` | 5 | **TS2578 stale `@ts-expect-error`** — easiest to fix (just remove the directives) |
| `src/pages/TrainingPage.tsx` | 5 | Video player types |
| `src/pages/SystemHealthPage.tsx` | 5 | Metrics types |

### 1.4 Proposed P2 tickets (not created yet)

Each of these is a self-contained, bite-sized ticket:

**P2-TD-001 — Remove stale `@ts-expect-error` in push-notifications.test.ts**
- Files: `src/test/lib/push-notifications.test.ts`
- Lines: 59, 70, 80, 114, 182
- Effort: 15 min
- Fix: delete the 5 `@ts-expect-error` directives (tests now compile clean without them).
- Why easy: no interface changes, just unused suppressions.

**P2-TD-002 — Dedup translation keys in i18n/{en,es}.ts**
- Files: `src/i18n/en.ts`, `src/i18n/es.ts`
- Errors: 30 × TS1117 (duplicate object keys)
- Effort: 30-45 min
- Fix: merge duplicate keys, keep the last declaration per convention, or flag duplicates as a bug (behavior: object literal uses last value — likely the intended one).
- Why mid: need to verify that the duplicate pairs have identical values OR that the "last wins" picked the intended translation.

**P2-TD-003 — Align integrations/EWeLink status type contract**
- Files: `src/services/integrations/ewelink.ts`, `src/services/integrations/index.ts`, `src/hooks/use-ewelink.ts`
- Errors: 3 × TS2345 around `{success, message, latencyMs}` vs `{status, message, latencyMs}`
- Effort: 30 min
- Fix: pick one of the two contracts (prefer `status: "ok"|"degraded"|"down"` string union over boolean `success`) and update all callers.
- Why mid: needs a choice. Cross-file. Easy to regress.

**P2-TD-004 — Type Safety Sprint (pages/)**
- Files: ~25 files under `src/pages/`
- Errors: ~130 × TS2322, TS2339, TS2345
- Effort: 6-8 h dev
- Fix: systematic review of each page's props/state types. Many are forms with `any`-typed handlers that should be typed against Zod schemas defined in backend modules.
- Why big: cross-cutting refactor. Could be split into per-page sub-tickets.

### 1.5 How to maintain the gate

On every PR:
1. CI runs `pnpm typecheck` and counts errors.
2. If count > 178 → fail.
3. If count <= 178 → pass + update baseline (lower it).

Store baseline in a committed file `.typecheck-baseline` updated by CI on successful merges to main.

---

---

## 2. Lint baseline pre-P1 (3349)

### 2.1 Status

`pnpm lint` reports **3,349 errors + 245 warnings across the `src/` tree**.
Verified: count was **3,351 on `main`** (pre-B2/B3). C+A autofix reduced by 2
via targeted eslint-disable comments in:

- `src/types/speech-recognition.d.ts:48` — global browser API types require
  `declare var`; added `// eslint-disable-next-line no-var` with justification.
- `tailwind.config.ts:82` — `require("tailwindcss-animate")` is the canonical
  tailwind plugin loader pattern in a Node context; added
  `// eslint-disable-next-line @typescript-eslint/no-require-imports` with justification.

**New baseline: 3349.** Same non-regression strategy as the typecheck gate:
`.lint-baseline` contains `3349`; B3.1 lint gate fails only if current count
exceeds baseline.

### 2.2 Top rules by occurrence

| Rule | Count | Category |
|---|---|---|
| `@typescript-eslint/no-empty-object-type` | **2106** | `{}` used as type (should be `Record<string, never>` or explicit interface) |
| `@typescript-eslint/no-explicit-any` | **1208** | `any` type used (should be narrowed) |
| `@typescript-eslint/no-unused-vars` | 211 | Unused variables/imports |
| `react-hooks/exhaustive-deps` | 21 | Missing deps in `useEffect`/`useMemo` |
| `react-refresh/only-export-components` | 13 | Mixed exports breaking fast refresh |
| `no-empty` | 10 | Empty block |
| `@typescript-eslint/ban-ts-comment` | 5 | `@ts-ignore` misuse |
| `no-useless-escape` | 5 | Unnecessary escape chars in regex/strings |
| `no-case-declarations` | 4 | `const`/`let` inside `case` without `{}` |
| `react-hooks/rules-of-hooks` | 3 | Hook called conditionally |

### 2.3 Proposed P2 tickets

**P2-TD-005 — Eliminate `{}` type usages (no-empty-object-type)**
- Scope: 2106 occurrences, mostly in React component `Props = {}` patterns.
- Effort: 4-6 h via codemod (sed/jscodeshift): `Props = {}` → `Props = Record<string, never>` or empty `{ [key: string]: never }`.
- Mechanical; low-risk once the pattern is agreed.

**P2-TD-006 — Eliminate `any` usages (no-explicit-any)**
- Scope: 1208 occurrences. Not mechanical — each one needs the correct type inferred from context.
- Effort: 3 focused sprints (1 week each), splitting by directory:
  - Sprint 1: `src/hooks/` + `src/services/`
  - Sprint 2: `src/components/`
  - Sprint 3: `src/pages/`
- Highest security/correctness value: backend-facing hooks/services.

**P2-TD-007 — React hooks deps + rules**
- Scope: `react-hooks/exhaustive-deps` (21) + `react-hooks/rules-of-hooks` (3) + `react-refresh/only-export-components` (13).
- Effort: ~3 h.
- Risk: exhaustive-deps fixes can introduce infinite loops if the dep cycles; review carefully.

**P2-TD-008 — Unused vars sweep**
- Scope: 211 occurrences.
- Effort: 1-2 h via `eslint --fix` for truly unused; manual review for intentional `_`-prefixed unused.
- Low-risk, fastest to reduce the count.

**P2-TD-009 — Miscellaneous (24 total across `ban-ts-comment`, `no-useless-escape`, `no-case-declarations`, `no-empty`)**
- Scope: 24 occurrences.
- Effort: 1 h. Mostly pedantic fixes.

### 2.4 Decreasing baseline plan

Target trajectory (indicative):

| Milestone | Target | Tickets |
|---|---|---|
| Sprint 1 (next 2 wk) | < 3000 | TD-008 + TD-009 + half of TD-005 (codemod) |
| Sprint 2 | < 2000 | Rest of TD-005 + TD-007 |
| Sprint 3 | < 1000 | TD-006 sprint 1 (hooks+services) |
| Sprint 4 | < 500 | TD-006 sprint 2+3 (components+pages) |
| Ideal | 0 | Remove `.lint-baseline`, switch gate to strict |

Each PR that reduces the count must also update `.lint-baseline` to the new value (CI enforces).

### 2.5 Gate mechanism

```bash
pnpm lint 2>&1 > /tmp/lint.log || true
# Extract the single number from "✖ N problems (M errors, K warnings)"
LINT_ERRORS=$(grep -oE "[0-9]+ errors?" /tmp/lint.log | head -1 | awk '{print $1}')
LINT_BASELINE=$(cat .lint-baseline)
if [ "$LINT_ERRORS" -gt "$LINT_BASELINE" ]; then
  echo "LINT REGRESSION: $LINT_ERRORS > $LINT_BASELINE"
  exit 1
fi
echo "lint baseline preserved: $LINT_ERRORS / $LINT_BASELINE"
```

---

## 3. Gitleaks findings pendientes de resolver (P1 debt — aceptado por operador)

Decisión del operador 2026-04-20: continuar hacia F0 (audit + eWeLink) aceptando
estos 4 leaks documentados en lugar de bloquear. Deben resolverse antes de que
el repo sea público o compartido con terceros.

### 3.1 Leaks reales committed (4 archivos)

| # | File:Line | Kind | Status | Remediation ticket |
|---|---|---|---|---|
| A | `deploy/openclaw/openclaw.env:8` | `OPENCLAW_GATEWAY_TOKEN=3897843589…db5870e` (64 hex) | ACTIVE en VPS | **P2-SEC-001:** rotar (`openssl rand -hex 32`), actualizar vault + `/home/openclaw/.openclaw/.env` + `openclaw.json.auth.token`, `git rm deploy/openclaw/openclaw.env`, añadir pattern a .gitignore |
| B | `GUIA-ACCIONES-EXTERNAS-AION.md:432` | `admin:seg12345` — Hikvision DVR fallback password (22 devices) | ACTIVE | **P2-SEC-002:** editar doc → `admin:<PASSWORD>` placeholder; decisión operativa sobre rotar password en 22 DVRs |
| C | `.auth/qa-storage-state.json:9` | Supabase JWT session (committed por Gemini dc9b3ba) | Probably expired (JWT TTL ~1h) | **P2-SEC-003:** `git rm .auth/qa-storage-state.json`; añadir `.auth/` a .gitignore (ya estaba en B1.2 commit; verificar efectividad) |
| D | `GUIA-ACCIONES-EXTERNAS-AION.md:253` | `EWELINK_APP_SECRET=uccENe…nev` | **Rotado por operador 2026-04-20**; el viejo valor queda en repo | **P2-SEC-004:** editar doc → `<APP_SECRET>` placeholder; operador ya rotó el valor real en dev.ewelink.cc (confirmado) |

### 3.2 Git history cleanup

Los 4 valores permanecen en commits históricos del branch `remediation/2026-04-aion-full-audit`
(particularmente los commits dc9b3ba y anteriores que introdujeron los archivos).
Purgar el histórico requiere `git filter-repo` o BFG + force-push coordinado a
los 3 remotes — trabajo de 30-60 min, justificable solo si el repo llegara a ser
público o compartido. Mientras los 3 remotes permanezcan privados (jlort1721-alt
scope), el riesgo de exposición es operacional, no público.

### 3.3 False positives identificados — candidatos a `.gitleaksignore`

Total 15 findings en archivos trackeados que son fixtures/documentación:

```
audit_data.json  lines 271,383,411,439,468,497,525,553,581,669,681
  → device IDs como "hik-186.97.106.252", "dahua-3.134.216.108",
    "identified_by_go2rtc_serial" — no credenciales, meta-markers del audit
backend/apps/backend-api/src/__tests__/credential-encryption.test.ts:5
  → "d7f1279f…" = AES-256 key fixture para unit test del cryptoservice
scripts/smoke-tests.sh:150
  → "dGhlIHNhbXBsZSBub25jZQ==" = base64 "the sample nonce" — fixture
reverse-gateway/test/sim/hikvision_nvr/main.go:28
  → "simkey123456" — fixture simulador
docs/TwilioSetupGuide.md lines 169,175,181,187,193,199
  → literal "YOUR_JWT" placeholder en curl examples
GUIA-ACCIONES-EXTERNAS-AION.md:107
  → "7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" — placeholder
    obvio (xs + prefix telegram fake)
```

**P2-SEC-005:** crear `.gitleaksignore` con fingerprints de estos 15 para que
el gate en futuras PRs no los flaguee como regresión.

### 3.4 Tests baseline commit pendiente

El archivo `.vitest-baseline` (contenido: `failed=32 passed=307`) fue creado
pero quedó untracked en la sesión de gates no-cerrada. Falta:
- `git add .vitest-baseline` + commit + push

**P2-QA-001:** commitear baseline file + documentar el gate mechanism en
p2-technical-debt §4 para consistencia con typecheck + lint.

### 3.5 B3 closure pendiente

Items no ejecutados de B3 (deploy + PR + tag) que quedan abiertos al pivotar
a F0-F4:

- B3.2: deploy blue-green del bundle post-fix (lodash override + tsconfig)
  a producción. Bundle actual en prod = 2026-04-17.
- B3.3: unskip 19 Playwright specs + run contra prod.
- B3.4: smoke manual + screenshots.
- B3.5: PR `remediation/2026-04-aion-full-audit` → `main`, merge, sync,
  tag `v2026.04.20-p1-forensic-closure`.
- B3.6: closure report final.

**P2-REL-001:** ejecutar B3.2-B3.6 tras completar F1-F3. Evaluar si
consolidar en un solo PR grande (B2+B3+F1+F2+F3) o dividir por fase.

---

## 4. Other P2 items (referenced from other runbooks)

| Ticket candidate | Source | Status |
|---|---|---|
| Integration test SDK en VPS (cron weekly) | `docs/audit/skill-coverage-rationale.md` §4 | Proposed, not filed |
| Multi-remote sync workflow activación (2 deploy keys) | `docs/runbooks/multi-remote-sync.md` | Runbook ready, needs operator action |
| WhatsApp bearer rotation (proveedor) | `docs/runbooks/whatsapp-bearer-rotation.md` | Runbook ready, needs credentials |
| G4 Dashboard verification exhaustiva | `docs/audit/2026-04-20-forensic-audit.md` matrix | Partial verification; deferred |
| Política `/var/www/clave/.env` | `docs/audit/2026-04-20-validation-p1-gaps.md` | Project separado, locked 600, no política aún |
| Grafana dashboard OpenClaw exporter | deleted with dc9b3ba revert | Needs rebuild con real metrics |
| Snap-* workers reactivación gradual | Plan inicial Fase 2 P0 | Pending operator (tras validar cooldown DVRs) |
| API key rotation schedule | `docs/runbooks/openclaw-secrets-rotation.md` | Process doc, no automation |
| Hardening P2 roadmap (observability stack, backups S3, docker-compose) | PROMPT 2 | Full plan, deferred |

---

## 3. How to file these as real tickets

The project does not appear to have a GitHub Projects board set up with P2 labels yet. Options:

- **Option A (simplest):** create a GitHub issue per ticket above with labels `P2` + `tech-debt`. No project board needed.
- **Option B:** add GitHub Projects board "AION Roadmap" with columns `P1 Done`, `P2 Backlog`, `P2 In Progress`, `Done`.
- **Option C:** track in this file (current approach) — works for small teams where PRs reference this doc directly.

Choose based on team size and workflow preference. This doc is the canonical source of truth until a ticketing system exists.
