#!/bin/bash
# PostToolUse hook for Write/Edit: Warn about console.log statements
set -e

INPUT=$(cat /dev/stdin 2>/dev/null || echo '{}')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Only check TS/JS source files (not test files)
if ! echo "$FILE_PATH" | grep -qE '\.(ts|tsx|js|jsx)$'; then
  exit 0
fi
if echo "$FILE_PATH" | grep -qE '(\.test\.|\.spec\.|__tests__|setup\.ts)'; then
  exit 0
fi

# Count console statements
MATCHES=$(grep -cn 'console\.\(log\|warn\|error\|info\|debug\)' "$FILE_PATH" 2>/dev/null || echo "0")

if [ "$MATCHES" -gt 0 ]; then
  echo "WARNING: $MATCHES console statement(s) found in $(basename "$FILE_PATH"). Remove before commit."
  grep -n 'console\.\(log\|warn\|error\|info\|debug\)' "$FILE_PATH" 2>/dev/null | head -5
fi

exit 0
