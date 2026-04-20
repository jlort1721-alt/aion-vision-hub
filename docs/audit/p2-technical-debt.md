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

## 2. Other P2 items (referenced from other runbooks)

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
