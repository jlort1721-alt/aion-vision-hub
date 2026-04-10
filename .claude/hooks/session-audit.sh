#!/bin/bash
# Stop hook: Final audit when session ends
set -e

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" 2>/dev/null || exit 0

echo "=== SESSION END AUDIT ==="
echo ""

# 1. Uncommitted changes
CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$CHANGES" -gt 0 ]; then
  echo "UNCOMMITTED CHANGES: $CHANGES files"
  git status --short 2>/dev/null | head -10
  echo ""
fi

# 2. Console.log in modified files
CONSOLE_FILES=$(git diff --name-only HEAD 2>/dev/null | grep -E '\.(ts|tsx)$' | xargs grep -l 'console\.\(log\|warn\|error\)' 2>/dev/null | head -5)
if [ -n "$CONSOLE_FILES" ]; then
  echo "CONSOLE STATEMENTS in modified files:"
  echo "$CONSOLE_FILES"
  echo ""
fi

# 3. TODO/FIXME in modified files
TODOS=$(git diff --name-only HEAD 2>/dev/null | grep -E '\.(ts|tsx)$' | xargs grep -n 'TODO\|FIXME\|HACK\|XXX' 2>/dev/null | head -5)
if [ -n "$TODOS" ]; then
  echo "TODO/FIXME in modified files:"
  echo "$TODOS"
  echo ""
fi

# 4. Security quick scan on staged files
SECRETS=$(git diff --cached --name-only 2>/dev/null | xargs grep -l 'sk-[a-zA-Z0-9]\{20,\}\|-----BEGIN.*KEY-----' 2>/dev/null)
if [ -n "$SECRETS" ]; then
  echo "CRITICAL: Possible secrets in staged files!"
  echo "$SECRETS"
  echo ""
else
  echo "Security scan: clean"
fi

echo "=== END AUDIT ==="
exit 0
