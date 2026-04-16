#!/bin/bash
# PostToolUse hook for Write/Edit: Auto-format with Prettier
set -e

INPUT=$(cat /dev/stdin 2>/dev/null || echo '{}')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Only format JS/TS/JSON files
if echo "$FILE_PATH" | grep -qE '\.(ts|tsx|js|jsx|json)$'; then
  if command -v npx &>/dev/null; then
    npx prettier --write "$FILE_PATH" 2>/dev/null || true
  fi
fi

exit 0
