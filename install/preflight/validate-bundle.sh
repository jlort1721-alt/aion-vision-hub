#!/usr/bin/env bash
# install/preflight/validate-bundle.sh — pre-flight validation of the entire bundle.
# Validates syntax of all shell, Python, JS, JSON, YAML, SQL and TypeScript files.
# Runs locally (no VPS access needed). Exits non-zero on any failure.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PASS=0; FAIL=0
declare -a FAILURES=()

check() {
  local desc="$1" cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    echo "  ✓ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $desc"
    FAIL=$((FAIL + 1))
    FAILURES+=("$desc")
  fi
}

echo "════════════════════════════════════════════════════════════════════"
echo "AION Platform — Bundle Validation"
echo "════════════════════════════════════════════════════════════════════"

# ---- Bash scripts -----------------------------------------------------------
echo ""
echo "Bash scripts (bash -n):"
while IFS= read -r f; do
  check "$f" "bash -n '$f'"
done < <(find install bundles -name "*.sh" -type f | sort)

# ---- Python files -----------------------------------------------------------
echo ""
echo "Python files (py_compile):"
while IFS= read -r f; do
  check "$f" "python3 -m py_compile '$f'"
done < <(find bundles -name "*.py" -type f | sort)

# ---- JavaScript files -------------------------------------------------------
echo ""
echo "JavaScript files (node --check):"
while IFS= read -r f; do
  check "$f" "node --check '$f'"
done < <(find bundles -name "*.js" -type f | sort)

# ---- JSON files -------------------------------------------------------------
echo ""
echo "JSON files (json.tool):"
while IFS= read -r f; do
  check "$f" "python3 -m json.tool < '$f'"
done < <(find bundles -name "*.json" -type f | sort)

# ---- YAML files -------------------------------------------------------------
echo ""
echo "YAML files (yaml.safe_load):"
while IFS= read -r f; do
  # GitHub Actions workflows use ${{ }} expressions that aren't valid YAML
  # to a pure parser. Validate them with a GHA-aware tool if available.
  if [[ "$f" == *.github/workflows/* ]]; then
    if command -v actionlint >/dev/null 2>&1; then
      check "$f (actionlint)" "actionlint '$f'"
    else
      echo "  ⊘ $f (skipped — install actionlint to validate GHA workflows)"
    fi
    continue
  fi
  check "$f" "python3 -c \"import yaml,sys; list(yaml.safe_load_all(open('$f')))\""
done < <(find bundles -name "*.yml" -o -name "*.yaml" -type f | sort)

# ---- SQL files (sqlparse-based) --------------------------------------------
echo ""
echo "SQL files (sqlparse):"
if python3 -c "import sqlparse" 2>/dev/null; then
  while IFS= read -r f; do
    check "$f" "python3 -c \"import sqlparse; sqlparse.parse(open('$f').read())\""
  done < <(find bundles -name "*.sql" -type f | sort)
else
  echo "  (sqlparse not installed — install with: pip install sqlparse)"
fi

# ---- TypeScript (tsc --noEmit) ---------------------------------------------
echo ""
echo "TypeScript files (tsc --noEmit):"
if [[ -d bundles/all-specs ]] && command -v npm >/dev/null 2>&1; then
  pushd bundles/all-specs >/dev/null
  if [[ ! -f tsconfig.json ]]; then
    cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "noEmit": true, "types": ["node"]
  }
}
JSON
  fi
  # Install minimal deps for tsc to find types
  if [[ ! -d node_modules ]]; then
    echo "  installing TS deps (one-time)..."
    npm install --silent --no-package-lock --no-save \
      typescript@5 @types/node @playwright/test 2>&1 | tail -3
  fi
  if ./node_modules/.bin/tsc --noEmit 2>&1 | tee /tmp/tsc.log | grep -q error; then
    echo "  ✗ TypeScript errors:"
    head -20 /tmp/tsc.log | sed 's/^/    /'
    FAIL=$((FAIL + 1)); FAILURES+=("typescript-specs")
  else
    echo "  ✓ all *.spec.ts and fixtures.ts compile cleanly"
    PASS=$((PASS + 1))
  fi
  popd >/dev/null
else
  echo "  (skipped — npm or all-specs/ not available)"
fi

# ---- Summary ---------------------------------------------------------------
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "Summary: $PASS passed, $FAIL failed"
echo "════════════════════════════════════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Failures:"
  for f in "${FAILURES[@]}"; do
    echo "  - $f"
  done
  exit 1
fi

echo "✅ All bundle files valid."
exit 0
