#!/usr/bin/env bash
# =============================================================================
# audit-autocommit.sh — companero de AUDIT_INFLIGHT_CHANGES.md
# -----------------------------------------------------------------------------
# Revisa cada repo AION, agrupa los cambios por scope y crea commits limpios
# con Conventional Commits. NO hace push automatico — solo deja los commits
# locales para que una persona (o el pipeline CI) los revise y pushee.
#
# Uso:
#   ./audit-autocommit.sh              # dry-run (muestra que commitearia)
#   ./audit-autocommit.sh --execute    # realmente commitea
#   ./audit-autocommit.sh --execute --push  # + push al remote
# =============================================================================
set -Eeuo pipefail

EXECUTE=0
PUSH=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=1; shift ;;
    --push)    PUSH=1;    shift ;;
    -h|--help) sed -n '1,20p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

REPOS=(api frontend agent model-router vision-hub comms worker scheduler tests ops db qa)

# Map file path → commit scope + type
classify() {
  local path="$1"
  case "$path" in
    *test*|*spec*|*.test.*|*.spec.*)  echo "test:tests" ;;
    *migration*|*.sql)                echo "feat:db" ;;
    *README*|*.md|docs/*)             echo "docs:docs" ;;
    *package.json|*pnpm-lock*|*.lock) echo "chore:deps" ;;
    *.github/*|*ci/*|Dockerfile*)     echo "ci:ci" ;;
    *config*|*.env*|.eslintrc*|*.yml) echo "chore:config" ;;
    *.ts|*.tsx|*.js|*.jsx|src/*)      echo "fix:code" ;;  # conservative default
    *)                                 echo "chore:misc" ;;
  esac
}

for r in "${REPOS[@]}"; do
  DIR="/opt/aion/$r"
  [[ -d "$DIR/.git" ]] || continue
  cd "$DIR"

  if [[ -z "$(git status --porcelain)" ]]; then
    continue
  fi

  echo ""
  echo "== $r ==================================================================="

  # Run project's local lint/typecheck gate BEFORE committing
  if [[ -f package.json ]]; then
    if grep -q '"lint"' package.json; then
      echo "  → lint"
      pnpm lint 2>/dev/null || { echo "  lint failed — skipping repo"; continue; }
    fi
    if grep -q '"typecheck"' package.json; then
      echo "  → typecheck"
      pnpm typecheck 2>/dev/null || { echo "  typecheck failed — skipping repo"; continue; }
    fi
  fi

  # Group changed files by (type, scope)
  declare -A GROUPS=()
  while IFS= read -r line; do
    local_path="${line:3}"
    [[ -z "$local_path" ]] && continue
    key="$(classify "$local_path")"
    GROUPS[$key]+="$local_path"$'\n'
  done < <(git status --porcelain)

  for key in "${!GROUPS[@]}"; do
    type="${key%%:*}"
    scope="${key##*:}"
    files="${GROUPS[$key]}"
    count="$(echo -n "$files" | grep -c '^' || true)"
    msg="${type}(${scope}): update ${count} file(s) via audit-autocommit"

    echo "  ${type}(${scope}) — ${count} files"
    if [[ "$EXECUTE" -eq 1 ]]; then
      echo "$files" | xargs -I {} git add "{}"
      git commit -m "$msg" -m "Auto-grouped by audit-autocommit.sh. Review before pushing." \
        || echo "    (nothing to commit for this group)"
    else
      echo "    would run: git add <${count} files> && git commit -m '${msg}'"
    fi
  done

  if [[ "$EXECUTE" -eq 1 && "$PUSH" -eq 1 ]]; then
    echo "  → push origin main"
    git push origin HEAD:main
  fi
done

echo ""
echo "Done. ($( [[ $EXECUTE -eq 1 ]] && echo 'committed' || echo 'DRY RUN' ))"
