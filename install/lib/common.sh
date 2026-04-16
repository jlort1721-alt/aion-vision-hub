#!/usr/bin/env bash
# install/lib/common.sh — shared logging, error handling, utilities.

# Color output (only if terminal)
if [[ -t 1 ]]; then
  RED=$'\e[31m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'
  BLUE=$'\e[34m'; BOLD=$'\e[1m'; RESET=$'\e[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; BOLD=''; RESET=''
fi

log()  { printf '%s[%s]%s %s\n' "$BLUE"  "$(date +%H:%M:%S)" "$RESET" "$*"; }
warn() { printf '%s[%s] WARN:%s %s\n' "$YELLOW" "$(date +%H:%M:%S)" "$RESET" "$*" >&2; }
err()  { printf '%s[%s] ERROR:%s %s\n' "$RED"   "$(date +%H:%M:%S)" "$RESET" "$*" >&2; }
ok()   { printf '%s[%s] ✓%s %s\n' "$GREEN"  "$(date +%H:%M:%S)" "$RESET" "$*"; }
die()  { err "$*"; exit 1; }

# Confirm prompt — auto-yes in non-interactive mode
confirm() {
  local prompt="${1:-Continue?}"
  [[ "${MODE:-interactive}" == "auto" ]] && return 0
  read -rp "$prompt [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

# Run command with logging; returns command's exit code
run() {
  log "  \$ $*"
  "$@"
}

# Create dir as aion user
ensure_dir() {
  local d="$1"
  if [[ ! -d "$d" ]]; then
    mkdir -p "$d"
    chown "${AION_USER}:${AION_USER}" "$d"
  fi
}

# Check command exists
require_cmd() {
  for c in "$@"; do
    command -v "$c" >/dev/null 2>&1 || die "Required command not found: $c"
  done
}

# Idempotent file install: copy SRC to DST only if different, with backup
install_file() {
  local src="$1" dst="$2" mode="${3:-0644}" owner="${4:-root:root}"
  if [[ -f "$dst" ]] && cmp -s "$src" "$dst"; then
    log "  unchanged: $dst"
    return 0
  fi
  if [[ -f "$dst" ]]; then
    cp -a "$dst" "${dst}.bak.$(date +%s)"
    log "  backed up: ${dst}.bak.*"
  fi
  install -m "$mode" -o "${owner%:*}" -g "${owner#*:}" "$src" "$dst"
  ok "installed: $dst"
}

# Check service is up via systemd
service_up() {
  systemctl is-active --quiet "$1"
}

# Wait for HTTP endpoint to return 2xx
wait_http_ok() {
  local url="$1" max_tries="${2:-30}" sleep_s="${3:-2}"
  for ((i=1; i<=max_tries; i++)); do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$sleep_s"
  done
  return 1
}

# Find the bundles dir (relative to installer)
bundles_dir() {
  echo "${INSTALLER_DIR}/../bundles"
}
