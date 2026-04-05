#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Setup DevOps Workspace for OpenClaw on AION VPS
# Creates: git repo clone, staging area, build environment
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "ERROR: Ejecutar como root"; exit 1; }

OPENCLAW_USER="openclaw"
DEVOPS_HOME="/home/${OPENCLAW_USER}/devops"
STAGING_DIR="${DEVOPS_HOME}/staging"
PRODUCTION_DIR="/opt/aion/app"
ROLLBACK_DIR="${DEVOPS_HOME}/rollbacks"
DEPLOY_LOG="${DEVOPS_HOME}/deploy.log"

info()  { echo -e "\033[0;32m[INFO]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[WARN]\033[0m $*"; }

info "=== Setting up DevOps Workspace ==="

# ── 1. Install Node.js + pnpm if missing ──────────────────────
if ! command -v node &>/dev/null; then
    info "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

if ! command -v pnpm &>/dev/null; then
    info "Installing pnpm..."
    npm install -g pnpm@latest
fi

info "Node: $(node --version), pnpm: $(pnpm --version 2>/dev/null || echo 'installing...')"

# ── 2. Install git if missing ─────────────────────────────────
if ! command -v git &>/dev/null; then
    apt-get install -y git
fi

# ── 3. Create workspace structure ─────────────────────────────
info "Creating workspace structure..."

sudo -u "$OPENCLAW_USER" bash <<USEREOF
set -euo pipefail

mkdir -p "${DEVOPS_HOME}"/{staging,rollbacks,plans,reports}
mkdir -p "${DEVOPS_HOME}/.cache"

# Git config for openclaw user
git config --global user.name "OpenClaw DevOps"
git config --global user.email "openclaw@aionseg.co"
git config --global init.defaultBranch main
git config --global pull.rebase false

USEREOF

# ── 4. Clone or sync repo to staging ──────────────────────────
info "Setting up staging area..."

GITHUB_TOKEN=$(grep -m1 '^GITHUB_TOKEN=' "/home/${OPENCLAW_USER}/.openclaw/.env" 2>/dev/null | cut -d= -f2- || echo "")
GITHUB_REPO=$(grep -m1 '^GITHUB_REPO=' "/home/${OPENCLAW_USER}/.openclaw/.env" 2>/dev/null | cut -d= -f2- || echo "jlort1721-alt/aion-platform")

if [[ -d "${STAGING_DIR}/.git" ]]; then
    info "Staging repo already exists, pulling latest..."
    sudo -iu "$OPENCLAW_USER" bash -c "cd ${STAGING_DIR} && git pull origin main" 2>/dev/null || warn "git pull failed (may need GITHUB_TOKEN)"
elif [[ -n "$GITHUB_TOKEN" ]]; then
    info "Cloning repo to staging..."
    sudo -iu "$OPENCLAW_USER" bash -c "git clone https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git ${STAGING_DIR}" 2>/dev/null || warn "git clone failed"
else
    info "No GITHUB_TOKEN — copying production files to staging..."
    rsync -a --exclude='node_modules' --exclude='.env' --exclude='dist' \
        "${PRODUCTION_DIR}/" "${STAGING_DIR}/" 2>/dev/null || true
    sudo -iu "$OPENCLAW_USER" bash -c "cd ${STAGING_DIR} && git init && git add -A && git commit -m 'Initial staging copy from production'" 2>/dev/null || true
fi

chown -R "$OPENCLAW_USER:$OPENCLAW_USER" "${DEVOPS_HOME}"

# ── 5. Create initial rollback snapshot ───────────────────────
info "Creating initial rollback snapshot..."

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ROLLBACK_SNAPSHOT="${ROLLBACK_DIR}/pre-openclaw-${TIMESTAMP}"
mkdir -p "$ROLLBACK_SNAPSHOT"

# Snapshot critical production files (not node_modules)
rsync -a --exclude='node_modules' --exclude='.env' \
    "${PRODUCTION_DIR}/dist/" "${ROLLBACK_SNAPSHOT}/dist/" 2>/dev/null || true
rsync -a --exclude='node_modules' --exclude='.env' \
    "${PRODUCTION_DIR}/backend/apps/backend-api/dist/" "${ROLLBACK_SNAPSHOT}/backend-api-dist/" 2>/dev/null || true

chown -R "$OPENCLAW_USER:$OPENCLAW_USER" "${ROLLBACK_DIR}"

# ── 6. Create deploy lock mechanism ──────────────────────────
info "Setting up deploy lock..."
touch "${DEVOPS_HOME}/.deploy-lock"
chmod 600 "${DEVOPS_HOME}/.deploy-lock"
chown "$OPENCLAW_USER:$OPENCLAW_USER" "${DEVOPS_HOME}/.deploy-lock"

# ── 7. Grant openclaw read access to production dist ──────────
info "Granting read access to production..."
# openclaw can READ production, but NOT write
setfacl -R -m u:openclaw:rX "${PRODUCTION_DIR}" 2>/dev/null || {
    warn "setfacl not available, using group permissions"
    groupadd -f aion-deployers 2>/dev/null || true
    usermod -aG aion-deployers "$OPENCLAW_USER"
    usermod -aG aion-deployers ubuntu
    chmod -R g+r "${PRODUCTION_DIR}" 2>/dev/null || true
}

info ""
info "=== DevOps Workspace Ready ==="
echo "  Staging:   ${STAGING_DIR}"
echo "  Rollbacks: ${ROLLBACK_DIR}"
echo "  Plans:     ${DEVOPS_HOME}/plans"
echo "  Reports:   ${DEVOPS_HOME}/reports"
echo ""
echo "  Next: Configure GITHUB_TOKEN in .env for git push capability"
