# Phase 0 — Baseline Snapshot

**Date:** 2026-04-16T18:55Z
**Score at start:** 78/100

## VPS Metrics

| Metric | Value |
|---|---|
| Uptime | 1d 14h 15m |
| Load | 1.09 0.93 0.94 |
| Disk | 40G/193G (21%) |
| RAM | 5.3G/15G |
| Swap | 12K/2G |
| PM2 online | 28 |
| PM2 errored | 0 |
| Docker | 10 containers |
| go2rtc | 129 streams |
| Asterisk | 42 PJSIP |
| n8n | healthy |
| Nginx | ok |
| SSL | 75 days |
| PG connections | 28 |
| PG tables | 162 |
| PG size | 129 MB |
| PG max migration | 037 |
| System errors 1h | 1 |
| Nginx 500s 1h | 0 (post migration 037 fix) |

## Git State

| Remote | SHA |
|---|---|
| origin | f8609bb9ad0f (IN SYNC) |
| aion | f8609bb9ad0f (IN SYNC) |
| aionseg | f8609bb9ad0f (IN SYNC) |

- Branch: `remediation/2026-04-aion-full-audit`
- Behind origin/main: 1 commit
- Ahead origin/main: 7 commits

## Backup

- DB: `/var/backups/aion/pre-phase0-20260416-185649/aionseg_prod.dump` (8.5 MB)
- Code: `/var/backups/aion/pre-phase0-20260416-185649/var-www-aionseg.tar.gz` (175 MB)
- Tag: `pre-phase0-snapshot-20260416-135800`

## Critical Issues at Baseline

1. ERR-001 (tenant_id) — RESOLVED by migration 037 (applied earlier today)
2. Migrations 033-036 — APPLIED earlier today
3. Remotes — NOW IN SYNC
4. 3 Live View Pro components not integrated (IntercomPushToTalk, LiveViewEventsPanel, LiveViewOpsPanel)
5. 37 legacy tests failing (supabase mocks)
6. 50 empty tables not audited
7. I18N ES/EN gap: 77 keys
