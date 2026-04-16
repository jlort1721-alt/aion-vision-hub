# Entorno Local — Claude Code Workspace

- **Path:** `/Users/ADMIN/Documents/open-view-hub-main`
- **Branch:** `remediation/2026-04-aion-full-audit` (creada desde `session/5h-20260414-0438`, base commit `27a22c4`)
- **Tag de seguridad:** `pre-remediation-20260415-155113`
- **Working tree sucio antes de branch:**
  - M `backend/apps/backend-api/tsconfig.tsbuildinfo` (artefacto de build, ignorable)
  - ?? `deploy/openclaw/openclaw.env.bak` (NO tocar sin revisar — puede contener secretos)
  - ?? `deploy/openclaw/openclaw.json.bak`
- **Remotes:**
  - `origin` → aion-vision-hub.git (canónico)
  - `aion` → aion-platform.git
  - `aionseg` → aionseg-platform.git
- **Toolchain:** Node 20.19.6, pnpm 9.15.0, npm 10.8.2, Docker 29.1.3, Python 3.9.6
- **Faltante:** `psql` (no instalado local), `timeout` (GNU coreutils). Se mitigan con `ssh aion-vps 'psql ...'` y `ssh ConnectTimeout`.
- **SSH VPS:** alias `aion-vps` → `ubuntu@18.230.40.6` con `~/.ssh/clave-demo-aion.pem` — VERIFICADO OK (`ip-172-31-8-215`, 16h uptime).
