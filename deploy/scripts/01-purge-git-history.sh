#!/usr/bin/env bash
###############################################################################
# 01-purge-git-history.sh
#
# Purges leaked secrets from git history using BFG Repo-Cleaner.
# Targets both aion-platform and aionseg-platform repositories.
#
# Prerequisites:
#   - Java 8+ installed (java -version)
#   - Git installed
#   - Write access to both GitHub repos
#   - Run from a clean working directory (e.g., /tmp/purge-workspace)
#
# Usage:
#   chmod +x 01-purge-git-history.sh
#   ./01-purge-git-history.sh
###############################################################################
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BFG_VERSION="1.14.0"
BFG_JAR="bfg-${BFG_VERSION}.jar"
BFG_URL="https://repo1.maven.org/maven2/com/madgag/bfg/${BFG_VERSION}/${BFG_JAR}"

WORK_DIR="${WORK_DIR:-/tmp/purge-workspace-$(date +%s)}"

FILES_TO_PURGE=(
  "CREDENTIALS.md"
  "monitoring-import.ts"
  ".env.production.aionseg"
  ".env.production"
  ".env"
)

REPOS=(
  "https://github.com/jlort1721-alt/aion-platform.git"
  "https://github.com/jlort1721-alt/aionseg-platform.git"
)

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
log()   { printf '\n\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
warn()  { printf '\n\033[1;33m[WARN]\033[0m  %s\n' "$*"; }
err()   { printf '\n\033[1;31m[ERROR]\033[0m %s\n' "$*"; }
ok()    { printf '\n\033[1;32m[OK]\033[0m    %s\n' "$*"; }

check_java() {
  if ! command -v java &>/dev/null; then
    err "Java is required but not installed. Install JRE 8+ and retry."
    exit 1
  fi
  log "Java detected: $(java -version 2>&1 | head -1)"
}

check_git() {
  if ! command -v git &>/dev/null; then
    err "Git is required but not installed."
    exit 1
  fi
  log "Git detected: $(git --version)"
}

# ---------------------------------------------------------------------------
# Step 0: Pre-flight checks
# ---------------------------------------------------------------------------
log "=== BFG Git History Purge Script ==="
log "Work directory: ${WORK_DIR}"

check_java
check_git

mkdir -p "${WORK_DIR}"
cd "${WORK_DIR}"

# ---------------------------------------------------------------------------
# Step 1: Download BFG Repo-Cleaner if not already present
# ---------------------------------------------------------------------------
if [[ ! -f "${BFG_JAR}" ]]; then
  log "Downloading BFG Repo-Cleaner v${BFG_VERSION}..."
  if ! curl -fSL -o "${BFG_JAR}" "${BFG_URL}"; then
    err "Failed to download BFG jar from ${BFG_URL}"
    exit 1
  fi
  ok "BFG jar downloaded."
else
  log "BFG jar already present at ${WORK_DIR}/${BFG_JAR}"
fi

# Verify the jar is valid
if ! java -jar "${BFG_JAR}" --version &>/dev/null; then
  err "BFG jar appears corrupt. Delete ${BFG_JAR} and re-run."
  exit 1
fi
ok "BFG jar verified."

# ---------------------------------------------------------------------------
# Step 2: Process each repository
# ---------------------------------------------------------------------------
for REPO_URL in "${REPOS[@]}"; do
  REPO_NAME=$(basename "${REPO_URL}" .git)
  MIRROR_DIR="${WORK_DIR}/${REPO_NAME}.git"

  log "============================================================"
  log "Processing repository: ${REPO_NAME}"
  log "URL: ${REPO_URL}"
  log "============================================================"

  # ---- Clone as bare mirror ----
  if [[ -d "${MIRROR_DIR}" ]]; then
    warn "Mirror directory ${MIRROR_DIR} already exists. Removing it."
    rm -rf "${MIRROR_DIR}"
  fi

  log "Cloning bare mirror..."
  if ! git clone --mirror "${REPO_URL}" "${MIRROR_DIR}"; then
    err "Failed to clone ${REPO_URL}. Check credentials and URL."
    exit 1
  fi
  ok "Mirror cloned to ${MIRROR_DIR}"

  # ---- Run BFG for each file to purge ----
  for FILE in "${FILES_TO_PURGE[@]}"; do
    log "Purging '${FILE}' from ${REPO_NAME} history..."
    java -jar "${WORK_DIR}/${BFG_JAR}" \
      --delete-files "${FILE}" \
      --no-blob-protection \
      "${MIRROR_DIR}" || {
        warn "BFG returned non-zero for '${FILE}' — file may not exist in history. Continuing."
      }
  done

  # ---- Clean up reflog and garbage collect ----
  log "Expiring reflog and pruning objects in ${REPO_NAME}..."
  cd "${MIRROR_DIR}"

  git reflog expire --expire=now --all
  git gc --prune=now --aggressive

  ok "Reflog expired and objects pruned for ${REPO_NAME}."

  # ---- Verify purge: grep for known sensitive strings ----
  log "Verifying purge — scanning for residual sensitive file names..."
  FOUND_RESIDUAL=0

  for FILE in "${FILES_TO_PURGE[@]}"; do
    if git log --all --diff-filter=A --name-only --pretty=format: 2>/dev/null | grep -q "${FILE}"; then
      err "RESIDUAL FOUND: '${FILE}' still appears in ${REPO_NAME} history!"
      FOUND_RESIDUAL=1
    fi
  done

  # Also do a full-text search for common secret patterns
  if git log --all -p 2>/dev/null | grep -qiE '(CREDENTIALS\.md|\.env\.production)'; then
    warn "Possible residual content detected in diffs. Review manually."
    FOUND_RESIDUAL=1
  fi

  if [[ ${FOUND_RESIDUAL} -eq 0 ]]; then
    ok "Verification passed: no residual sensitive files found in ${REPO_NAME}."
  else
    err "Verification FAILED for ${REPO_NAME}. Review output above before force pushing."
    warn "You may need to run BFG with --replace-text for embedded secrets."
  fi

  cd "${WORK_DIR}"

  # ---- Force push ----
  log "Ready to force-push ${REPO_NAME}."
  echo ""
  echo "  ┌─────────────────────────────────────────────────────────────┐"
  echo "  │  WARNING: Force push will rewrite ALL remote history.       │"
  echo "  │  All collaborators must re-clone after this operation.      │"
  echo "  └─────────────────────────────────────────────────────────────┘"
  echo ""
  read -rp "  Force-push ${REPO_NAME} to origin? (yes/no): " CONFIRM

  if [[ "${CONFIRM}" == "yes" ]]; then
    log "Force-pushing ${REPO_NAME}..."
    cd "${MIRROR_DIR}"
    if git push --force; then
      ok "Force push completed for ${REPO_NAME}."
    else
      err "Force push failed for ${REPO_NAME}. Check credentials and branch protections."
      exit 1
    fi
    cd "${WORK_DIR}"
  else
    warn "Skipped force-push for ${REPO_NAME}. Mirror is at: ${MIRROR_DIR}"
    warn "To push manually later:  cd ${MIRROR_DIR} && git push --force"
  fi

  log "Finished processing ${REPO_NAME}."
done

# ---------------------------------------------------------------------------
# Post-purge instructions
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "  POST-PURGE CHECKLIST"
echo "============================================================"
echo ""
echo "  1. ALL collaborators must delete their local clones and re-clone:"
echo "       rm -rf aion-platform aionseg-platform"
echo "       git clone https://github.com/jlort1721-alt/aion-platform.git"
echo "       git clone https://github.com/jlort1721-alt/aionseg-platform.git"
echo ""
echo "  2. Rotate ALL credentials that were in the purged files:"
echo "       - PostgreSQL passwords"
echo "       - Redis password"
echo "       - JWT secret"
echo "       - Admin password hash"
echo "       - Session secrets"
echo "       Run: ./02-rotate-credentials.sh"
echo ""
echo "  3. Verify on GitHub that the files no longer appear in history:"
echo "       https://github.com/jlort1721-alt/aion-platform/search?q=CREDENTIALS"
echo "       https://github.com/jlort1721-alt/aionseg-platform/search?q=CREDENTIALS"
echo ""
echo "  4. Invalidate any GitHub Personal Access Tokens that may have"
echo "     been exposed in the purged files."
echo ""
echo "  5. Add these patterns to .gitignore if not already present:"
echo "       .env"
echo "       .env.production"
echo "       .env.production.*"
echo "       CREDENTIALS.md"
echo ""
echo "  6. Clean up the work directory when satisfied:"
echo "       rm -rf ${WORK_DIR}"
echo ""
echo "============================================================"
ok "Purge script completed. Review all output above."
