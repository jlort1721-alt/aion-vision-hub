#!/bin/bash
# PreToolUse hook for Bash: Branch protection, tmux reminder, import validation
set -e

INPUT=$(cat /dev/stdin 2>/dev/null || echo '{}')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Branch protection: block direct push/merge to main
if echo "$COMMAND" | grep -qE '^git (push|merge|rebase)'; then
  BRANCH=$(git -C "${CLAUDE_PROJECT_DIR:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  if [ "$BRANCH" = "main" ]; then
    echo "BLOCKED: Direct git operations on 'main' branch are prohibited. Use a feature branch and PR workflow." >&2
    exit 2
  fi
fi

# Tmux reminder for long-running commands
if echo "$COMMAND" | grep -qE '^(npm run build|pnpm build|pnpm --filter.*test|npx vitest|docker compose|npm run dev|pnpm dev)'; then
  echo "TIP: Consider running long commands in tmux to avoid timeout."
fi

# Import validation: warn before adding new dependencies
if echo "$COMMAND" | grep -qE '^(pnpm add|npm install |npm add )'; then
  echo "NOTE: Adding new dependency. Verify license compatibility and bundle size impact."
fi

exit 0
