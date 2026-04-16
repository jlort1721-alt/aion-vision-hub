#!/bin/bash
# PostToolUse hook for Write/Edit: Check module completeness when editing backend modules
set -e

INPUT=$(cat /dev/stdin 2>/dev/null || echo '{}')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only check backend module files
if ! echo "$FILE_PATH" | grep -qE '/modules/[^/]+/(routes|service|schemas)\.ts$'; then
  exit 0
fi

# Extract module directory and name
MODULE_DIR=$(dirname "$FILE_PATH")
MODULE_NAME=$(basename "$MODULE_DIR")
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Check for sibling files
MISSING=""
[ ! -f "$MODULE_DIR/service.ts" ] && MISSING="$MISSING service.ts"
[ ! -f "$MODULE_DIR/schemas.ts" ] && MISSING="$MISSING schemas.ts"

# Check for test file
TEST_DIR="$PROJECT_DIR/backend/apps/backend-api/src/__tests__"
if ! ls "$TEST_DIR/${MODULE_NAME}"*.test.ts 2>/dev/null | head -1 >/dev/null 2>&1; then
  MISSING="$MISSING test-file"
fi

if [ -n "$MISSING" ]; then
  echo "MODULE '$MODULE_NAME' is missing:$MISSING"
  echo "Run /scaffold $MODULE_NAME to generate missing files, or /tdd to add tests."
fi

exit 0
