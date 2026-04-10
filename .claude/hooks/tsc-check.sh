#!/bin/bash
# PostToolUse hook for Write/Edit: TypeScript type check
set -e

INPUT=$(cat /dev/stdin 2>/dev/null || echo '{}')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only check TypeScript files
if ! echo "$FILE_PATH" | grep -qE '\.(ts|tsx)$'; then
  exit 0
fi

# Skip declaration files and test files
if echo "$FILE_PATH" | grep -qE '(\.d\.ts$|\.test\.|\.spec\.)'; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Determine if frontend or backend file
if echo "$FILE_PATH" | grep -q 'backend/'; then
  cd "$PROJECT_DIR/backend" 2>/dev/null && npx tsc --noEmit --pretty 2>&1 | tail -5 || true
else
  cd "$PROJECT_DIR" 2>/dev/null && npx tsc --noEmit --pretty 2>&1 | tail -5 || true
fi

exit 0
