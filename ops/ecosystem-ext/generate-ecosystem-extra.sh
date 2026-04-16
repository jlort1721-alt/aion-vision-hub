#!/usr/bin/env bash
# =============================================================================
# generate-ecosystem-extra.sh
# -----------------------------------------------------------------------------
# Reads apps-classified.json and emits ecosystem.extra.config.js with proper
# blue-green pairs / singletons / etc.
#
# Usage:
#   ./generate-ecosystem-extra.sh apps-classified.json > /opt/aion/ecosystem.extra.config.js
# =============================================================================
set -Eeuo pipefail

INPUT="${1:?Usage: $0 <apps-classified.json>}"
[[ -f "$INPUT" ]] || { echo "File not found: $INPUT" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq required" >&2; exit 1; }

# Validate categories present
for cat in stateful_blue_green bridge_singleton stateless_singleton; do
  if ! jq -e ".${cat}.apps | type == \"array\"" "$INPUT" >/dev/null; then
    echo "ERROR: $INPUT must have key .${cat}.apps as array" >&2
    exit 1
  fi
done

# Stream output to stdout
cat <<'HEADER'
/**
 * AION Platform — PM2 Ecosystem Extra (generated)
 * -----------------------------------------------------------------------------
 * Manages the 17+ "extra" apps that the v1 ecosystem.config.js doesn't cover.
 * Generated from apps-classified.json — DO NOT EDIT BY HAND.
 *
 * Three deployment strategies:
 *   - stateful_blue_green: blue+green pair on alternate ports, drain before stop
 *   - bridge_singleton:    single instance, graceful shutdown, fast restart
 *   - stateless_singleton: cluster mode safe, SIGTERM re-queues in-flight jobs
 *
 * Run with the original ecosystem too:
 *   pm2 start /opt/aion/ecosystem.config.js       --env production
 *   pm2 start /opt/aion/ecosystem.extra.config.js --env production
 *   pm2 save
 */
const path = require('path');

const LOG_DIR  = '/var/log/aion';
const APP_ROOT = '/opt/aion';

// Common defaults applied to every app
const COMMON = {
  instance_var:               'INSTANCE_ID',
  max_memory_restart:         '1G',
  kill_timeout:               10000,
  listen_timeout:             15000,
  wait_ready:                 false,         // override per app if needed
  autorestart:                true,
  exp_backoff_restart_delay:  2000,
  max_restarts:               15,
  min_uptime:                 '30s',
  merge_logs:                 true,
  time:                       true,
  log_date_format:            'YYYY-MM-DD HH:mm:ss.SSS Z',
  node_args:                  '--enable-source-maps --max-old-space-size=1024',
};

// --- Strategy: blue/green pair (returns 2 PM2 app definitions) -------------
const blueGreenPair = (a) => {
  const make = (color, portOffset) => ({
    ...COMMON,
    ...a,
    name: `${a.name}-${color}`,
    cwd: a.cwd,
    script: a.script,
    instances: a.instances || 1,
    exec_mode: a.exec_mode || 'fork',
    max_memory_restart: a.max_memory_restart || COMMON.max_memory_restart,
    kill_timeout: a.kill_timeout || 30000,   // give drain time
    wait_ready: true,
    env_production: {
      NODE_ENV:     'production',
      DEPLOY_COLOR: color,
      PORT:         a.base_port + portOffset,
      ...(a.env || {}),
    },
    error_file: path.join(LOG_DIR, `${a.name}-${color}.err.log`),
    out_file:   path.join(LOG_DIR, `${a.name}-${color}.out.log`),
    pid_file:   path.join('/var/run/aion', `${a.name}-${color}.pid`),
  });
  return [make('blue', 0), make('green', 1)];
};

// --- Strategy: bridge singleton (1 instance, graceful, no duplicate) -------
const bridgeSingleton = (a) => ({
  ...COMMON,
  ...a,
  name: a.name,
  cwd: a.cwd,
  script: a.script,
  instances: 1,
  exec_mode: 'fork',
  max_memory_restart: a.max_memory_restart || '800M',
  kill_timeout: a.kill_timeout || 15000,
  env_production: {
    NODE_ENV: 'production',
    PORT: a.port,
    ...(a.env || {}),
  },
  error_file: path.join(LOG_DIR, `${a.name}.err.log`),
  out_file:   path.join(LOG_DIR, `${a.name}.out.log`),
});

// --- Strategy: stateless singleton/cluster ----------------------------------
const statelessSingleton = (a) => ({
  ...COMMON,
  ...a,
  name: a.name,
  cwd: a.cwd,
  script: a.script,
  instances: a.instances || 1,
  exec_mode: a.exec_mode || 'fork',
  max_memory_restart: a.max_memory_restart || '600M',
  kill_timeout: a.kill_timeout || 10000,
  env_production: {
    NODE_ENV: 'production',
    ...(a.env || {}),
  },
  error_file: path.join(LOG_DIR, `${a.name}.err.log`),
  out_file:   path.join(LOG_DIR, `${a.name}.out.log`),
});

// --- App definitions (generated below) -------------------------------------
HEADER

# Generate stateful blue/green apps
echo ""
echo "// === STATEFUL BLUE/GREEN ==================================================="
jq -r '.stateful_blue_green.apps[] | select(.name | startswith("REPLACE") | not) | "// " + .name' "$INPUT" 2>/dev/null || true
jq -c '.stateful_blue_green.apps[] | select(.name | startswith("REPLACE") | not)' "$INPUT" \
  | while IFS= read -r app; do
      echo ""
      echo "const $(echo "$app" | jq -r '.name | gsub("-";"_")')_apps = blueGreenPair($app);"
    done

# Generate bridge singletons
echo ""
echo "// === BRIDGE SINGLETONS ====================================================="
jq -c '.bridge_singleton.apps[] | select(.name | startswith("REPLACE") | not)' "$INPUT" \
  | while IFS= read -r app; do
      echo "const $(echo "$app" | jq -r '.name | gsub("-";"_")')_app = bridgeSingleton($app);"
    done

# Generate stateless singletons
echo ""
echo "// === STATELESS WORKERS ====================================================="
jq -c '.stateless_singleton.apps[] | select(.name | startswith("REPLACE") | not)' "$INPUT" \
  | while IFS= read -r app; do
      echo "const $(echo "$app" | jq -r '.name | gsub("-";"_")')_app = statelessSingleton($app);"
    done

# Final module.exports — collect all generated apps
cat <<'FOOTER'

// --- Combine all into module.exports ----------------------------------------
const allApps = [];

// Spread blue/green pairs
FOOTER

jq -r '.stateful_blue_green.apps[] | select(.name | startswith("REPLACE") | not) | .name | gsub("-";"_") | "allApps.push(..." + . + "_apps);"' "$INPUT"

echo ""
echo "// Singletons (bridge + stateless)"
jq -r '.bridge_singleton.apps[] | select(.name | startswith("REPLACE") | not)   | .name | gsub("-";"_") | "allApps.push(" + . + "_app);"' "$INPUT"
jq -r '.stateless_singleton.apps[] | select(.name | startswith("REPLACE") | not) | .name | gsub("-";"_") | "allApps.push(" + . + "_app);"' "$INPUT"

cat <<'FOOTER'

module.exports = { apps: allApps };
FOOTER
