#!/usr/bin/env bash
# install/phases/tests.sh — install Playwright + 10 specs in /opt/aion/qa.
set -Eeuo pipefail
# shellcheck disable=SC1091
source "$(dirname "$0")/../lib/common.sh"

SPECS_DIR="$(bundles_dir)/all-specs"

log "Installing Playwright system deps..."
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq --no-install-recommends \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libpango-1.0-0 libcairo2 libasound2t64 libatspi2.0-0 \
  fonts-liberation fonts-noto-color-emoji 2>&1 | tail -3 || \
  apt-get install -y -qq --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    fonts-liberation fonts-noto-color-emoji 2>&1 | tail -3
ok "Playwright system deps installed"

QA_DIR="$AION_ROOT/qa"

log "Setting up $QA_DIR (under user $AION_USER, NOT root)..."
sudo -u "$AION_USER" bash <<EOF
set -e
mkdir -p "$QA_DIR/tests/e2e" "$QA_DIR/.auth"
cd "$QA_DIR"

# Create package.json if missing
if [[ ! -f package.json ]]; then
  cat > package.json <<'JSON'
{
  "name": "aion-qa",
  "private": true,
  "type": "module",
  "scripts": {
    "test":       "playwright test",
    "test:smoke": "playwright test --project=smoke",
    "test:full":  "playwright test --project=full",
    "report":     "playwright show-report"
  },
  "dependencies": {
    "@playwright/test": "^1.48.0",
    "dotenv": "^16.4.5"
  }
}
JSON
fi

# Install npm deps (idempotent)
npm install --silent 2>&1 | tail -5

# Install Chromium browser
npx playwright install chromium 2>&1 | tail -3
EOF

log "Copying playwright.config.ts and fixtures.ts..."
install_file "$SPECS_DIR/playwright.config.ts" "$QA_DIR/playwright.config.ts" 0644 "${AION_USER}:${AION_USER}"
install_file "$SPECS_DIR/fixtures.ts"          "$QA_DIR/tests/fixtures.ts"    0644 "${AION_USER}:${AION_USER}"

log "Copying 10 Playwright specs..."
for spec in "$SPECS_DIR"/*.spec.ts; do
  name="$(basename "$spec")"
  install_file "$spec" "$QA_DIR/tests/e2e/$name" 0644 "${AION_USER}:${AION_USER}"
done

ok "Specs installed: $(ls "$QA_DIR/tests/e2e/" | wc -l) files"

log "Verifying TypeScript compiles..."
sudo -u "$AION_USER" bash -c "cd '$QA_DIR' && npx tsc --noEmit 2>&1 | tail -10" || \
  warn "tsc reported issues — review above"

log "Verifying Playwright is callable..."
sudo -u "$AION_USER" "$QA_DIR/node_modules/.bin/playwright" --version | head -1

log ""
log "To run E2E tests:"
log "  sudo -u $AION_USER bash -c 'cd $QA_DIR && \\"
log "    set -a; source $AION_ROOT/.env.qa; set +a; \\"
log "    npx playwright test'"

ok "Tests phase complete."
