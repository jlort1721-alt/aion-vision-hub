#!/bin/bash
# Stop hook: Auto-update memory snapshot at end of each session
# This ensures the next conversation has fresh context about what was done
set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
MEMORY_DIR="$HOME/.claude/projects/-Users-ADMIN-Documents-open-view-hub-main/memory"
STATE_FILE="$MEMORY_DIR/project_current_state.md"
SESSION_FILE="$MEMORY_DIR/last_session.md"

# Skip if memory dir doesn't exist
[ -d "$MEMORY_DIR" ] || exit 0

cd "$PROJECT_DIR" 2>/dev/null || exit 0

# ── Gather session data ──
DATE=$(date +%Y-%m-%d)
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git log -1 --oneline 2>/dev/null || echo "none")
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
RECENT_COMMITS=$(git log --oneline -5 --since="6 hours ago" 2>/dev/null || echo "none")
FILES_CHANGED=$(git diff --name-only HEAD~3..HEAD 2>/dev/null | head -20 || echo "none")

# ── Write last_session.md ──
cat > "$SESSION_FILE" << EOF
---
name: last_session
description: Resumen automático de la última sesión de Claude Code — archivos cambiados, commits, estado
type: project
---

# Última Sesión — $DATE

**Branch**: $BRANCH
**Último commit**: $LAST_COMMIT
**Archivos sin commit**: $UNCOMMITTED

## Commits recientes (últimas 6h)
$RECENT_COMMITS

## Archivos modificados (últimos 3 commits)
$FILES_CHANGED

## Servicios VPS (snapshot)
$(ssh -i /Users/ADMIN/Downloads/clave-demo-aion.pem -o StrictHostKeyChecking=no -o ConnectTimeout=5 ubuntu@18.230.40.6 'pm2 list 2>/dev/null | grep -E "online|stopped" | wc -l' 2>/dev/null || echo "N/A") servicios PM2
$(ssh -i /Users/ADMIN/Downloads/clave-demo-aion.pem -o StrictHostKeyChecking=no -o ConnectTimeout=5 ubuntu@18.230.40.6 'systemctl is-active go2rtc 2>/dev/null' 2>/dev/null || echo "N/A") go2rtc
$(ssh -i /Users/ADMIN/Downloads/clave-demo-aion.pem -o StrictHostKeyChecking=no -o ConnectTimeout=5 ubuntu@18.230.40.6 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health/ready 2>/dev/null' 2>/dev/null || echo "N/A") API health
EOF

# ── Update MEMORY.md index if last_session not listed ──
if ! grep -q "last_session.md" "$MEMORY_DIR/MEMORY.md" 2>/dev/null; then
  echo "- [last_session.md](last_session.md) — Auto-snapshot de la última sesión de trabajo" >> "$MEMORY_DIR/MEMORY.md"
fi

echo "Memory updated: $SESSION_FILE"
exit 0
