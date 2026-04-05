#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# DevOps + Automator Wrappers for OpenClaw
# Development, build, test, deploy, rollback, automation CRUD
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "ERROR: Ejecutar como root"; exit 1; }

WRAPPER_DIR="/usr/local/sbin"
DEVOPS_HOME="/home/openclaw/devops"
STAGING_DIR="${DEVOPS_HOME}/staging"
PRODUCTION_DIR="/opt/aion/app"
ROLLBACK_DIR="${DEVOPS_HOME}/rollbacks"

echo "=== Installing DevOps + Automator Wrappers ==="

# Rate limit helper (reused from install-wrappers.sh)
RATE_LIMIT_FUNC='
_rate_limit() {
    local NAME="$1" MAX="$2" WINDOW="$3"
    local LOCKFILE="/tmp/openclaw-ratelimit/${NAME}.lock"
    local NOW; NOW=$(date +%s)
    local CUTOFF=$((NOW - WINDOW))
    (
        flock -w 2 200 || { echo "ERROR: rate-limit lock timeout"; exit 1; }
        if [[ -f "$LOCKFILE.log" ]]; then
            awk -v c="$CUTOFF" "\$1 >= c" "$LOCKFILE.log" > "$LOCKFILE.tmp" 2>/dev/null || true
            mv -f "$LOCKFILE.tmp" "$LOCKFILE.log" 2>/dev/null || true
        fi
        local COUNT; COUNT=$(wc -l < "$LOCKFILE.log" 2>/dev/null || echo 0); COUNT=$((COUNT + 0))
        if [[ "$COUNT" -ge "$MAX" ]]; then
            echo "ERROR: Rate limit ($MAX/$WINDOW s). Esperar."
            exit 1
        fi
        echo "$NOW" >> "$LOCKFILE.log"
    ) 200>"$LOCKFILE"
}
'

# ─────────────────────────────────────────────────────────────
# 1. aion-git: Safe git operations in staging
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-git" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

STAGING="/home/openclaw/devops/staging"
ACTION="${1:-status}"
shift 2>/dev/null || true

cd "$STAGING" || { echo "ERROR: Staging dir not found"; exit 1; }

case "$ACTION" in
    status)
        git status --short
        ;;
    log)
        LINES="${1:-20}"
        LINES=$(echo "$LINES" | tr -cd '0-9')
        [[ "$LINES" -gt 100 ]] && LINES=100
        git log --oneline -n "$LINES"
        ;;
    diff)
        FILE="${1:-}"
        if [[ -n "$FILE" ]]; then
            # Sanitize file path
            FILE=$(echo "$FILE" | tr -cd 'a-zA-Z0-9/._ -')
            git diff -- "$FILE" 2>/dev/null | head -500
        else
            git diff --stat
        fi
        ;;
    pull)
        git pull origin main 2>&1
        ;;
    branch)
        git branch -a
        ;;
    show)
        COMMIT="${1:-HEAD}"
        COMMIT=$(echo "$COMMIT" | tr -cd 'a-zA-Z0-9^~')
        git show --stat "$COMMIT" 2>/dev/null | head -100
        ;;
    add)
        FILE="${1:-}"
        if [[ -z "$FILE" ]]; then echo "Uso: aion-git add <archivo>"; exit 1; fi
        FILE=$(echo "$FILE" | tr -cd 'a-zA-Z0-9/._ -')
        git add "$FILE" 2>&1
        echo "OK: $FILE staged"
        ;;
    commit)
        MSG="${1:-}"
        if [[ -z "$MSG" ]]; then echo "Uso: aion-git commit 'mensaje'"; exit 1; fi
        # Prefix all OpenClaw commits
        git commit -m "[openclaw] $MSG" 2>&1
        ;;
    push)
        git push origin main 2>&1
        ;;
    stash)
        git stash 2>&1
        ;;
    stash-pop)
        git stash pop 2>&1
        ;;
    read)
        FILE="${1:-}"
        if [[ -z "$FILE" ]]; then echo "Uso: aion-git read <archivo>"; exit 1; fi
        FILE=$(echo "$FILE" | tr -cd 'a-zA-Z0-9/._ -')
        if [[ -f "$FILE" ]]; then
            cat "$FILE" | head -2000
        else
            echo "ERROR: File not found: $FILE"
            exit 1
        fi
        ;;
    find)
        PATTERN="${1:-}"
        if [[ -z "$PATTERN" ]]; then echo "Uso: aion-git find '<patron>'"; exit 1; fi
        PATTERN=$(echo "$PATTERN" | tr -cd 'a-zA-Z0-9._ *?/-')
        find . -path './node_modules' -prune -o -name "$PATTERN" -print 2>/dev/null | head -50
        ;;
    grep)
        PATTERN="${1:-}"
        if [[ -z "$PATTERN" ]]; then echo "Uso: aion-git grep '<patron>'"; exit 1; fi
        grep -rn --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' \
            "$PATTERN" . 2>/dev/null | grep -v node_modules | head -100
        ;;
    edit)
        FILE="${1:-}"
        SEARCH="${2:-}"
        REPLACE="${3:-}"
        if [[ -z "$FILE" || -z "$SEARCH" || -z "$REPLACE" ]]; then
            echo "Uso: aion-git edit <archivo> '<buscar>' '<reemplazar>'"
            exit 1
        fi
        FILE=$(echo "$FILE" | tr -cd 'a-zA-Z0-9/._ -')
        if [[ ! -f "$FILE" ]]; then echo "ERROR: $FILE no existe"; exit 1; fi
        # Create backup before edit
        cp "$FILE" "$FILE.bak"
        sed -i "s|${SEARCH}|${REPLACE}|g" "$FILE"
        echo "OK: Edited $FILE"
        diff "$FILE.bak" "$FILE" || true
        rm -f "$FILE.bak"
        ;;
    write)
        FILE="${1:-}"
        if [[ -z "$FILE" ]]; then echo "Uso: aion-git write <archivo> (content via stdin)"; exit 1; fi
        FILE=$(echo "$FILE" | tr -cd 'a-zA-Z0-9/._ -')
        # Read content from stdin
        cat > "$FILE"
        echo "OK: Written $FILE ($(wc -c < "$FILE") bytes)"
        ;;
    *)
        echo "aion-git — Git operations in staging"
        echo ""
        echo "  Lectura:"
        echo "    status          Git status"
        echo "    log [N]         Last N commits (max 100)"
        echo "    diff [file]     Show changes"
        echo "    branch          List branches"
        echo "    show [commit]   Show commit details"
        echo "    read <file>     Read file content"
        echo "    find <pattern>  Find files by name"
        echo "    grep <pattern>  Search in code"
        echo ""
        echo "  Escritura:"
        echo "    pull            Pull from origin"
        echo "    add <file>      Stage file"
        echo "    commit <msg>    Commit staged changes"
        echo "    push            Push to origin"
        echo "    stash/stash-pop Stash changes"
        echo "    edit <f> <s> <r> Search-replace in file"
        echo "    write <file>    Write file from stdin"
        exit 1
        ;;
esac
WRAPPER

# ─────────────────────────────────────────────────────────────
# 2. aion-build: Build pipeline in staging
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-build" <<WRAPPER
#!/usr/bin/env bash
set -euo pipefail

${RATE_LIMIT_FUNC}
_rate_limit "aion-build" 6 3600  # Max 6 builds/hour

STAGING="/home/openclaw/devops/staging"
TARGET="\${1:-all}"

cd "\$STAGING" || { echo "ERROR: Staging not found"; exit 1; }

echo "=== AION Build Pipeline ==="
echo "Target: \$TARGET"
echo "Time: \$(date)"

case "\$TARGET" in
    backend)
        echo "--- Installing backend dependencies ---"
        cd backend
        pnpm install --frozen-lockfile 2>&1 | tail -5
        echo "--- Building backend ---"
        npx turbo build 2>&1
        echo ""
        echo "OK: Backend built"
        ;;
    frontend)
        echo "--- Installing frontend dependencies ---"
        pnpm install --frozen-lockfile 2>&1 | tail -5
        echo "--- Building frontend ---"
        pnpm build 2>&1
        echo ""
        echo "OK: Frontend built"
        ;;
    all)
        echo "--- Installing all dependencies ---"
        pnpm install --frozen-lockfile 2>&1 | tail -5
        echo "--- Building backend ---"
        cd backend
        npx turbo build 2>&1
        cd ..
        echo "--- Building frontend ---"
        pnpm build 2>&1
        echo ""
        echo "OK: Full build complete"
        ;;
    *)
        echo "Uso: aion-build [backend|frontend|all]"
        exit 1
        ;;
esac

echo "Build finished at \$(date)"
WRAPPER

# ─────────────────────────────────────────────────────────────
# 3. aion-test: Run test suite
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-test" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

STAGING="/home/openclaw/devops/staging"
TARGET="${1:-all}"

cd "$STAGING" || { echo "ERROR: Staging not found"; exit 1; }

echo "=== AION Test Suite ==="
echo "Target: $TARGET"

case "$TARGET" in
    backend)
        cd backend
        npx turbo test 2>&1
        ;;
    frontend)
        pnpm test -- --run 2>&1
        ;;
    all)
        echo "--- Frontend tests ---"
        pnpm test -- --run 2>&1 || echo "WARN: Frontend tests had failures"
        echo ""
        echo "--- Backend tests ---"
        cd backend
        npx turbo test 2>&1 || echo "WARN: Backend tests had failures"
        ;;
    smoke)
        echo "--- Smoke tests against production ---"
        bash scripts/smoke-test.sh "http://127.0.0.1:3000" 2>&1
        ;;
    security)
        echo "--- Security audit ---"
        bash scripts/security-audit.sh 2>&1
        ;;
    pre-deploy)
        echo "--- Pre-production checks ---"
        bash scripts/pre-production-check.sh 2>&1
        ;;
    *)
        echo "Uso: aion-test [backend|frontend|all|smoke|security|pre-deploy]"
        exit 1
        ;;
esac

echo ""
echo "Tests finished at $(date)"
WRAPPER

# ─────────────────────────────────────────────────────────────
# 4. aion-deploy: Deploy from staging to production
#    WITH pre-checks, post-checks, auto-rollback
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-deploy" <<WRAPPER
#!/usr/bin/env bash
set -euo pipefail

${RATE_LIMIT_FUNC}
_rate_limit "aion-deploy" 3 3600  # Max 3 deploys/hour

STAGING="/home/openclaw/devops/staging"
PRODUCTION="/opt/aion/app"
ROLLBACK_DIR="/home/openclaw/devops/rollbacks"
DEPLOY_LOG="/home/openclaw/devops/deploy.log"
LOCKFILE="/home/openclaw/devops/.deploy-lock"
COMPONENT="\${1:-all}"
REASON="\${2:-openclaw-improvement}"

log() { echo "[\$(date '+%Y-%m-%d %H:%M:%S')] \$*" | tee -a "\$DEPLOY_LOG"; }

# ── Acquire deploy lock ───────────────────────────────────────
(
    flock -w 10 200 || { echo "ERROR: Deploy already in progress"; exit 1; }

    log "=== DEPLOY START: \$COMPONENT — \$REASON ==="

    # ── 1. Pre-flight checks ─────────────────────────────────
    log "Phase 1: Pre-flight checks..."

    # Health must be OK before deploying
    if ! /usr/local/sbin/aion-health >/dev/null 2>&1; then
        log "ABORT: AION health check failed pre-deploy"
        exit 1
    fi
    log "  Pre-deploy health: OK"

    # Staging must have built artifacts
    case "\$COMPONENT" in
        backend)
            if [[ ! -d "\$STAGING/backend/apps/backend-api/dist" ]]; then
                log "ABORT: Backend not built. Run aion-build backend first."
                exit 1
            fi
            ;;
        frontend)
            if [[ ! -d "\$STAGING/dist" ]]; then
                log "ABORT: Frontend not built. Run aion-build frontend first."
                exit 1
            fi
            ;;
        all)
            if [[ ! -d "\$STAGING/backend/apps/backend-api/dist" ]] || [[ ! -d "\$STAGING/dist" ]]; then
                log "ABORT: Not fully built. Run aion-build all first."
                exit 1
            fi
            ;;
        *)
            log "ABORT: Invalid component '\$COMPONENT'. Use: backend, frontend, all"
            exit 1
            ;;
    esac
    log "  Build artifacts: present"

    # ── 2. Create rollback snapshot ───────────────────────────
    log "Phase 2: Creating rollback snapshot..."
    TIMESTAMP=\$(date +%Y%m%d-%H%M%S)
    ROLLBACK_SNAP="\${ROLLBACK_DIR}/\${TIMESTAMP}-\${COMPONENT}"
    mkdir -p "\$ROLLBACK_SNAP"

    case "\$COMPONENT" in
        backend|all)
            rsync -a --exclude='node_modules' \
                "\${PRODUCTION}/backend/apps/backend-api/dist/" \
                "\${ROLLBACK_SNAP}/backend-api-dist/" 2>/dev/null || true
            rsync -a --exclude='node_modules' \
                "\${PRODUCTION}/backend/apps/edge-gateway/dist/" \
                "\${ROLLBACK_SNAP}/edge-gateway-dist/" 2>/dev/null || true
            ;;
    esac
    case "\$COMPONENT" in
        frontend|all)
            rsync -a "\${PRODUCTION}/dist/" "\${ROLLBACK_SNAP}/frontend-dist/" 2>/dev/null || true
            ;;
    esac

    echo "\$COMPONENT" > "\${ROLLBACK_SNAP}/.component"
    echo "\$REASON" > "\${ROLLBACK_SNAP}/.reason"
    log "  Rollback saved: \$ROLLBACK_SNAP"

    # ── 3. Deploy ─────────────────────────────────────────────
    log "Phase 3: Deploying \$COMPONENT..."

    case "\$COMPONENT" in
        backend|all)
            rsync -a --delete --exclude='node_modules' --exclude='.env' \
                "\${STAGING}/backend/apps/backend-api/dist/" \
                "\${PRODUCTION}/backend/apps/backend-api/dist/" 2>&1
            rsync -a --delete --exclude='node_modules' --exclude='.env' \
                "\${STAGING}/backend/apps/edge-gateway/dist/" \
                "\${PRODUCTION}/backend/apps/edge-gateway/dist/" 2>&1
            log "  Backend dist synced"

            # Restart PM2 processes
            su - ubuntu -c "pm2 restart backend-api" 2>&1
            su - ubuntu -c "pm2 restart edge-gateway" 2>&1
            log "  PM2 processes restarted"
            ;;
    esac

    case "\$COMPONENT" in
        frontend|all)
            rsync -a --delete \
                "\${STAGING}/dist/" \
                "\${PRODUCTION}/dist/" 2>&1
            log "  Frontend dist synced"
            ;;
    esac

    # ── 4. Post-deploy health check ───────────────────────────
    log "Phase 4: Post-deploy health check (waiting 10s)..."
    sleep 10

    HEALTH_OK=false
    for ATTEMPT in 1 2 3; do
        if /usr/local/sbin/aion-health >/dev/null 2>&1; then
            HEALTH_OK=true
            break
        fi
        log "  Health check attempt \$ATTEMPT failed, waiting 10s..."
        sleep 10
    done

    if [[ "\$HEALTH_OK" == "true" ]]; then
        log "Phase 4: Health OK after deploy"

        # Run smoke test
        HTTP_CODE=\$(curl -sf --max-time 10 -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/health 2>/dev/null || echo "000")
        if [[ "\$HTTP_CODE" == "200" ]]; then
            log "Phase 4: Smoke test PASS (HTTP \$HTTP_CODE)"
        else
            log "WARN: Smoke test returned HTTP \$HTTP_CODE"
        fi

        log "=== DEPLOY SUCCESS: \$COMPONENT ==="

        # Clean old rollbacks (keep last 10)
        ls -dt "\${ROLLBACK_DIR}"/*/ 2>/dev/null | tail -n +11 | xargs rm -rf 2>/dev/null || true

    else
        log "FAIL: Health check failed after 3 attempts — ROLLING BACK"

        # ── 5. Auto-rollback ──────────────────────────────────
        case "\$COMPONENT" in
            backend|all)
                if [[ -d "\${ROLLBACK_SNAP}/backend-api-dist" ]]; then
                    rsync -a --delete \
                        "\${ROLLBACK_SNAP}/backend-api-dist/" \
                        "\${PRODUCTION}/backend/apps/backend-api/dist/" 2>&1
                fi
                if [[ -d "\${ROLLBACK_SNAP}/edge-gateway-dist" ]]; then
                    rsync -a --delete \
                        "\${ROLLBACK_SNAP}/edge-gateway-dist/" \
                        "\${PRODUCTION}/backend/apps/edge-gateway/dist/" 2>&1
                fi
                su - ubuntu -c "pm2 restart backend-api" 2>&1
                su - ubuntu -c "pm2 restart edge-gateway" 2>&1
                ;;
        esac
        case "\$COMPONENT" in
            frontend|all)
                if [[ -d "\${ROLLBACK_SNAP}/frontend-dist" ]]; then
                    rsync -a --delete \
                        "\${ROLLBACK_SNAP}/frontend-dist/" \
                        "\${PRODUCTION}/dist/" 2>&1
                fi
                ;;
        esac

        sleep 5
        if /usr/local/sbin/aion-health >/dev/null 2>&1; then
            log "=== ROLLBACK SUCCESS — production restored ==="
        else
            log "=== ROLLBACK FAILED — MANUAL INTERVENTION REQUIRED ==="
        fi
        exit 1
    fi

) 200>"\$LOCKFILE"
WRAPPER

# ─────────────────────────────────────────────────────────────
# 5. aion-rollback: Manual rollback to previous version
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-rollback" <<WRAPPER
#!/usr/bin/env bash
set -euo pipefail

${RATE_LIMIT_FUNC}
_rate_limit "aion-rollback" 5 3600

ROLLBACK_DIR="/home/openclaw/devops/rollbacks"
PRODUCTION="/opt/aion/app"
SNAPSHOT="\${1:-latest}"

# List available rollbacks
if [[ "\$SNAPSHOT" == "list" ]]; then
    echo "=== Available Rollbacks ==="
    ls -dt "\${ROLLBACK_DIR}"/*/ 2>/dev/null | while read -r DIR; do
        COMP=\$(cat "\${DIR}/.component" 2>/dev/null || echo "?")
        REASON=\$(cat "\${DIR}/.reason" 2>/dev/null || echo "?")
        echo "  \$(basename "\$DIR")  [\$COMP]  \$REASON"
    done
    exit 0
fi

# Find snapshot
if [[ "\$SNAPSHOT" == "latest" ]]; then
    SNAP_DIR=\$(ls -dt "\${ROLLBACK_DIR}"/*/ 2>/dev/null | head -1)
else
    SNAP_DIR="\${ROLLBACK_DIR}/\${SNAPSHOT}"
fi

if [[ -z "\$SNAP_DIR" || ! -d "\$SNAP_DIR" ]]; then
    echo "ERROR: Snapshot not found: \$SNAPSHOT"
    echo "Usa: aion-rollback list"
    exit 1
fi

COMPONENT=\$(cat "\${SNAP_DIR}/.component" 2>/dev/null || echo "all")
echo "=== Rolling back to \$(basename "\$SNAP_DIR") [\$COMPONENT] ==="

case "\$COMPONENT" in
    backend|all)
        [[ -d "\${SNAP_DIR}/backend-api-dist" ]] && rsync -a --delete \
            "\${SNAP_DIR}/backend-api-dist/" \
            "\${PRODUCTION}/backend/apps/backend-api/dist/" 2>&1
        [[ -d "\${SNAP_DIR}/edge-gateway-dist" ]] && rsync -a --delete \
            "\${SNAP_DIR}/edge-gateway-dist/" \
            "\${PRODUCTION}/backend/apps/edge-gateway/dist/" 2>&1
        su - ubuntu -c "pm2 restart backend-api" 2>&1
        su - ubuntu -c "pm2 restart edge-gateway" 2>&1
        echo "Backend restored + restarted"
        ;;
esac
case "\$COMPONENT" in
    frontend|all)
        [[ -d "\${SNAP_DIR}/frontend-dist" ]] && rsync -a --delete \
            "\${SNAP_DIR}/frontend-dist/" \
            "\${PRODUCTION}/dist/" 2>&1
        echo "Frontend restored"
        ;;
esac

sleep 5
/usr/local/sbin/aion-health || echo "WARN: Health check failed post-rollback"
WRAPPER

# ─────────────────────────────────────────────────────────────
# 6. aion-automation: CRUD automation rules via AION API
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-automation" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-list}"
shift 2>/dev/null || true

API_KEY=$(grep -m1 '^AION_API_KEY=' /home/openclaw/.openclaw/.env 2>/dev/null | cut -d= -f2- || echo "")
if [[ -z "$API_KEY" ]]; then echo "ERROR: AION_API_KEY not set"; exit 1; fi

API="http://127.0.0.1:3000"
AUTH="-H \"X-API-Key: ${API_KEY}\""

api_get() {
    curl -sf --max-time 10 -H "X-API-Key: ${API_KEY}" "${API}${1}" 2>/dev/null
}

api_post() {
    curl -sf --max-time 10 -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" \
        -X POST "${API}${1}" -d "${2}" 2>/dev/null
}

api_patch() {
    curl -sf --max-time 10 -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" \
        -X PATCH "${API}${1}" -d "${2}" 2>/dev/null
}

case "$ACTION" in
    list)
        echo "=== Automation Rules ==="
        api_get "/automation/rules?limit=50" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    stats)
        echo "=== Automation Stats ==="
        api_get "/automation/stats" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    system-status)
        echo "=== Automation System ==="
        api_get "/automation/system/status" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    system-toggle)
        ENABLED="${1:-}"
        if [[ -z "$ENABLED" ]]; then echo "Uso: aion-automation system-toggle true|false"; exit 1; fi
        api_post "/automation/system/toggle" "{\"enabled\":$ENABLED}" | jq '.' 2>/dev/null
        ;;
    get)
        RULE_ID="${1:-}"
        if [[ -z "$RULE_ID" ]]; then echo "Uso: aion-automation get <rule-id>"; exit 1; fi
        api_get "/automation/rules/${RULE_ID}" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    create)
        RULE_JSON="${1:-}"
        if [[ -z "$RULE_JSON" ]]; then
            echo "Uso: aion-automation create '<json>'"
            echo "Ejemplo: aion-automation create '{\"name\":\"...\",\"trigger\":{...},\"actions\":[...]}'"
            exit 1
        fi
        api_post "/automation/rules" "$RULE_JSON" | jq '.' 2>/dev/null
        ;;
    update)
        RULE_ID="${1:-}"
        RULE_JSON="${2:-}"
        if [[ -z "$RULE_ID" || -z "$RULE_JSON" ]]; then
            echo "Uso: aion-automation update <rule-id> '<json>'"
            exit 1
        fi
        api_patch "/automation/rules/${RULE_ID}" "$RULE_JSON" | jq '.' 2>/dev/null
        ;;
    executions)
        echo "=== Recent Executions ==="
        api_get "/automation/executions?limit=20" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    evaluate)
        echo "=== Manual Evaluation ==="
        TRIGGER_JSON="${1:-"{\"type\":\"manual\"}"}"
        api_post "/automation/evaluate" "$TRIGGER_JSON" | jq '.' 2>/dev/null
        ;;
    *)
        echo "aion-automation — Automation rule management"
        echo ""
        echo "  list                 List all rules"
        echo "  stats                Show statistics"
        echo "  system-status        Check if automation is enabled"
        echo "  system-toggle <bool> Enable/disable all automation"
        echo "  get <id>             Get specific rule"
        echo "  create '<json>'      Create new rule"
        echo "  update <id> '<json>' Update rule"
        echo "  executions           Recent execution history"
        echo "  evaluate '<json>'    Manual trigger evaluation"
        exit 1
        ;;
esac
WRAPPER

# ─────────────────────────────────────────────────────────────
# 7. aion-internal-agent: Query AION's internal monitoring agent
# ─────────────────────────────────────────────────────────────
cat > "${WRAPPER_DIR}/aion-internal-agent" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

ACTION="${1:-status}"
API_KEY=$(grep -m1 '^AION_API_KEY=' /home/openclaw/.openclaw/.env 2>/dev/null | cut -d= -f2- || echo "")
if [[ -z "$API_KEY" ]]; then echo "ERROR: AION_API_KEY not set"; exit 1; fi

API="http://127.0.0.1:3000"

api_get() {
    curl -sf --max-time 10 -H "X-API-Key: ${API_KEY}" "${API}${1}" 2>/dev/null
}

api_post() {
    curl -sf --max-time 10 -H "X-API-Key: ${API_KEY}" -X POST "${API}${1}" 2>/dev/null
}

case "$ACTION" in
    status)
        echo "=== Internal Agent Status ==="
        api_get "/internal-agent/status" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    check)
        echo "=== Forcing Health Check ==="
        api_post "/internal-agent/check" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    proactive)
        echo "=== Proactive Alerts ==="
        api_get "/internal-agent/proactive" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    analyze)
        echo "=== Forcing Proactive Analysis ==="
        api_post "/internal-agent/proactive" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    predictions)
        echo "=== Predictive Intelligence ==="
        api_get "/internal-agent/predictions" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    events)
        LIMIT="${2:-20}"
        echo "=== Recent Events ==="
        api_get "/events?limit=${LIMIT}&sort=desc" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    alerts)
        echo "=== Active Alerts ==="
        api_get "/alerts?status=active&limit=20" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    incidents)
        echo "=== Open Incidents ==="
        api_get "/incidents?status=open&limit=20" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    shift-summary)
        echo "=== AI Shift Summary ==="
        api_get "/ai/shift-summary" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    operations)
        echo "=== Operations Overview ==="
        api_get "/operations/overview" | jq '.' 2>/dev/null || echo "ERROR"
        ;;
    mcp-tools)
        echo "=== Available MCP Tools ==="
        api_get "/mcp/tools" | jq '.[].name' 2>/dev/null || echo "ERROR"
        ;;
    mcp-execute)
        TOOL="${2:-}"
        PARAMS="${3:-"{}"}"
        if [[ -z "$TOOL" ]]; then echo "Uso: aion-internal-agent mcp-execute <tool> '<params>'"; exit 1; fi
        curl -sf --max-time 30 -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" \
            -X POST "${API}/mcp/execute" \
            -d "{\"toolName\":\"${TOOL}\",\"params\":${PARAMS}}" 2>/dev/null | jq '.' 2>/dev/null
        ;;
    *)
        echo "aion-internal-agent — AION Brain Interface"
        echo ""
        echo "  Monitoring:"
        echo "    status           Health reports + overall score"
        echo "    check            Force immediate health check"
        echo "    proactive        View proactive alerts"
        echo "    analyze          Force proactive analysis"
        echo "    predictions      Predictive intelligence"
        echo ""
        echo "  Operations:"
        echo "    events [N]       Recent events"
        echo "    alerts           Active alerts"
        echo "    incidents        Open incidents"
        echo "    shift-summary    AI-generated shift summary"
        echo "    operations       Operations dashboard"
        echo ""
        echo "  MCP:"
        echo "    mcp-tools        List available tools"
        echo "    mcp-execute <tool> '<params>'  Execute MCP tool"
        exit 1
        ;;
esac
WRAPPER

# ─────────────────────────────────────────────────────────────
# Permisos y sudoers
# ─────────────────────────────────────────────────────────────
echo "Setting permissions..."

DEVOPS_WRAPPERS=(
    aion-git
    aion-build
    aion-test
    aion-deploy
    aion-rollback
    aion-automation
    aion-internal-agent
)

for W in "${DEVOPS_WRAPPERS[@]}"; do
    chmod 0750 "${WRAPPER_DIR}/${W}"
    chown root:root "${WRAPPER_DIR}/${W}"
done

# ─────────────────────────────────────────────────────────────
# 8. aion-validate-all: Full platform endpoint validation
# ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/aion-validate-all.sh" ]]; then
    cp "$SCRIPT_DIR/aion-validate-all.sh" "${WRAPPER_DIR}/aion-validate-all"
    chmod 0750 "${WRAPPER_DIR}/aion-validate-all"
    chown root:root "${WRAPPER_DIR}/aion-validate-all"
    echo "  aion-validate-all installed from deploy dir"
elif [[ -f "/tmp/openclaw-deploy/aion-validate-all.sh" ]]; then
    cp "/tmp/openclaw-deploy/aion-validate-all.sh" "${WRAPPER_DIR}/aion-validate-all"
    chmod 0750 "${WRAPPER_DIR}/aion-validate-all"
    chown root:root "${WRAPPER_DIR}/aion-validate-all"
    echo "  aion-validate-all installed from tmp"
fi

# Copy module map for agent reference
if [[ -f "$SCRIPT_DIR/aion-module-map.json" ]]; then
    cp "$SCRIPT_DIR/aion-module-map.json" "/home/openclaw/.openclaw/aion-module-map.json"
    chown openclaw:openclaw "/home/openclaw/.openclaw/aion-module-map.json"
    chmod 644 "/home/openclaw/.openclaw/aion-module-map.json"
    echo "  Module map installed"
elif [[ -f "/tmp/openclaw-deploy/aion-module-map.json" ]]; then
    cp "/tmp/openclaw-deploy/aion-module-map.json" "/home/openclaw/.openclaw/aion-module-map.json"
    chown openclaw:openclaw "/home/openclaw/.openclaw/aion-module-map.json"
    chmod 644 "/home/openclaw/.openclaw/aion-module-map.json"
fi

DEVOPS_WRAPPERS+=(aion-validate-all)

# Append to existing sudoers
cat >> /etc/sudoers.d/openclaw-aion <<'SUDOERS'

# DevOps wrappers (rate-limited internally)
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-git
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-git *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-build
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-build *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-test
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-test *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-deploy
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-deploy *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-rollback
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-rollback *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-automation
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-automation *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-internal-agent
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-internal-agent *
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-validate-all
openclaw ALL=(root) NOPASSWD: /usr/local/sbin/aion-validate-all *
SUDOERS

chmod 0440 /etc/sudoers.d/openclaw-aion
visudo -cf /etc/sudoers.d/openclaw-aion || {
    echo "ERROR: sudoers invalid"
    exit 1
}

echo ""
echo "=== ${#DEVOPS_WRAPPERS[@]} DevOps wrappers installed ==="
for W in "${DEVOPS_WRAPPERS[@]}"; do
    echo "  ${WRAPPER_DIR}/${W}"
done
echo "DONE"
