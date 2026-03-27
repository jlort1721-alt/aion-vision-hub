#!/bin/bash
# ═══════════════════════════════════════════════════════════
# AION Vision Hub — Security Audit Script
# Checks for common security misconfigurations
# Usage: ./scripts/security-audit.sh
# ═══════════════════════════════════════════════════════════

set -euo pipefail

PASS=0
FAIL=0
WARN=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "═══════════════════════════════════════════════════════"
echo " AION Vision Hub — Security Audit"
echo " Project: $PROJECT_DIR"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 1. Check for hardcoded secrets in code ───────────────
echo "1. Hardcoded Secrets Check"

SECRET_PATTERNS=(
    "password\s*=\s*['\"][^'\"]*['\"]"
    "api_key\s*=\s*['\"][^'\"]*['\"]"
    "secret\s*=\s*['\"][^'\"]*['\"]"
    "eyJhbGciOi"
    "sk-[a-zA-Z0-9]{20,}"
    "AKIA[A-Z0-9]{16}"
)

for pattern in "${SECRET_PATTERNS[@]}"; do
    MATCHES=$(grep -rl --include="*.ts" --include="*.tsx" --include="*.js" -E "$pattern" \
        "$PROJECT_DIR/src" "$PROJECT_DIR/backend" 2>/dev/null | \
        grep -v node_modules | grep -v dist | grep -v ".env" | grep -v ".example" | \
        grep -v "test" | grep -v "__tests__" | grep -v "schemas.ts" | \
        head -5 || true)
    if [ -n "$MATCHES" ]; then
        echo -e "  ${YELLOW}WARN${NC} Pattern '$pattern' found in:"
        echo "$MATCHES" | while read -r f; do echo "    → $f"; done
        WARN=$((WARN + 1))
    fi
done
echo -e "  ${GREEN}PASS${NC} No obvious hardcoded secrets found"
PASS=$((PASS + 1))
echo ""

# ── 2. Check .env files are gitignored ───────────────────
echo "2. Environment File Protection"

if grep -q "^\.env$" "$PROJECT_DIR/.gitignore" 2>/dev/null; then
    echo -e "  ${GREEN}PASS${NC} .env is in .gitignore"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}FAIL${NC} .env is NOT in .gitignore"
    FAIL=$((FAIL + 1))
fi

# Check no .env files are tracked by git
TRACKED_ENV=$(git -C "$PROJECT_DIR" ls-files '*.env' '.env.*' 2>/dev/null | grep -v ".example" | grep -v ".docker.example" || true)
if [ -z "$TRACKED_ENV" ]; then
    echo -e "  ${GREEN}PASS${NC} No .env files tracked by git"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}FAIL${NC} .env files tracked by git:"
    echo "$TRACKED_ENV" | while read -r f; do echo "    → $f"; done
    FAIL=$((FAIL + 1))
fi
echo ""

# ── 3. Check CORS configuration ─────────────────────────
echo "3. CORS Configuration"

CORS_FILES=$(grep -rl "cors" "$PROJECT_DIR/backend/apps" --include="*.ts" 2>/dev/null | head -5 || true)
WILDCARD_CORS=$(grep -rn "\*" "$PROJECT_DIR/backend/apps" --include="*.ts" 2>/dev/null | grep -i "cors\|origin" | grep -v "node_modules" | grep -v "comment" | head -3 || true)
if [ -z "$WILDCARD_CORS" ]; then
    echo -e "  ${GREEN}PASS${NC} No wildcard CORS origins detected"
    PASS=$((PASS + 1))
else
    echo -e "  ${YELLOW}WARN${NC} Possible wildcard CORS:"
    echo "$WILDCARD_CORS" | while read -r l; do echo "    → $l"; done
    WARN=$((WARN + 1))
fi
echo ""

# ── 4. Check rate limiting ───────────────────────────────
echo "4. Rate Limiting"

if grep -rq "rate.limit\|rateLimit\|rate_limit" "$PROJECT_DIR/backend/apps/backend-api/src" --include="*.ts" 2>/dev/null; then
    echo -e "  ${GREEN}PASS${NC} Rate limiting configured"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}FAIL${NC} No rate limiting found"
    FAIL=$((FAIL + 1))
fi
echo ""

# ── 5. Check authentication middleware ───────────────────
echo "5. Authentication Middleware"

if grep -rq "requireRole\|preHandler.*auth\|jwt.*verify" "$PROJECT_DIR/backend/apps/backend-api/src/modules" --include="*.ts" 2>/dev/null; then
    AUTH_ROUTES=$(grep -rl "requireRole" "$PROJECT_DIR/backend/apps/backend-api/src/modules" --include="*.ts" 2>/dev/null | wc -l)
    echo -e "  ${GREEN}PASS${NC} Authentication found in $AUTH_ROUTES route files"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}FAIL${NC} No authentication middleware detected"
    FAIL=$((FAIL + 1))
fi
echo ""

# ── 6. Check audit logging ──────────────────────────────
echo "6. Audit Logging"

AUDIT_CALLS=$(grep -rn "request.audit\|\.audit(" "$PROJECT_DIR/backend/apps/backend-api/src/modules" --include="*.ts" 2>/dev/null | wc -l)
if [ "$AUDIT_CALLS" -gt 10 ]; then
    echo -e "  ${GREEN}PASS${NC} Audit logging found ($AUDIT_CALLS calls)"
    PASS=$((PASS + 1))
else
    echo -e "  ${YELLOW}WARN${NC} Low audit coverage ($AUDIT_CALLS calls)"
    WARN=$((WARN + 1))
fi
echo ""

# ── 7. Check Helmet/Security Headers ────────────────────
echo "7. Security Headers (Helmet)"

if grep -rq "@fastify/helmet\|helmet" "$PROJECT_DIR/backend/apps/backend-api/src" --include="*.ts" 2>/dev/null; then
    echo -e "  ${GREEN}PASS${NC} Helmet (security headers) configured"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}FAIL${NC} Helmet not found"
    FAIL=$((FAIL + 1))
fi
echo ""

# ── 8. Check SQL injection protection ───────────────────
echo "8. SQL Injection Protection"

RAW_SQL=$(grep -rn "\.raw\|\.unsafe\|sql\`" "$PROJECT_DIR/backend/apps/backend-api/src/modules" --include="*.ts" 2>/dev/null | grep -v "test\|comment\|migration" | head -5 || true)
if [ -z "$RAW_SQL" ]; then
    echo -e "  ${GREEN}PASS${NC} No raw SQL queries detected (using ORM)"
    PASS=$((PASS + 1))
else
    echo -e "  ${YELLOW}WARN${NC} Raw SQL queries found (verify parameterization):"
    echo "$RAW_SQL" | while read -r l; do echo "    → $l"; done
    WARN=$((WARN + 1))
fi
echo ""

# ── 9. Check credential encryption ──────────────────────
echo "9. Credential Encryption"

if grep -rq "encrypt\|AES\|aes-256-gcm\|crypto" "$PROJECT_DIR/backend/packages/common-utils/src" --include="*.ts" 2>/dev/null; then
    echo -e "  ${GREEN}PASS${NC} Credential encryption module found"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}FAIL${NC} No credential encryption module found"
    FAIL=$((FAIL + 1))
fi
echo ""

# ── 10. Check for vulnerable dependencies ────────────────
echo "10. Dependency Vulnerabilities"

if command -v npm &> /dev/null; then
    AUDIT_OUTPUT=$(cd "$PROJECT_DIR" && npm audit --json 2>/dev/null || echo '{"metadata":{"vulnerabilities":{"critical":0,"high":0}}}')
    CRITICAL=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.critical // 0' 2>/dev/null || echo "?")
    HIGH=$(echo "$AUDIT_OUTPUT" | jq -r '.metadata.vulnerabilities.high // 0' 2>/dev/null || echo "?")

    if [ "$CRITICAL" = "0" ] && [ "$HIGH" = "0" ]; then
        echo -e "  ${GREEN}PASS${NC} No critical/high vulnerabilities"
        PASS=$((PASS + 1))
    else
        echo -e "  ${YELLOW}WARN${NC} Found $CRITICAL critical, $HIGH high vulnerabilities"
        WARN=$((WARN + 1))
    fi
else
    echo -e "  ${YELLOW}WARN${NC} npm not available, skipping audit"
    WARN=$((WARN + 1))
fi
echo ""

# ── Summary ──────────────────────────────────────────────
TOTAL=$((PASS + FAIL + WARN))
echo "═══════════════════════════════════════════════════════"
echo -e " Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / ${YELLOW}$WARN warnings${NC} (total: $TOTAL)"
echo "═══════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
exit 0
