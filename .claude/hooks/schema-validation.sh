#!/bin/bash
# PostToolUse hook for Write/Edit: Verify DB schema is exported in index.ts
set -e

INPUT=$(cat /dev/stdin 2>/dev/null || echo '{}')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only check DB schema files (not index.ts itself)
if ! echo "$FILE_PATH" | grep -qE '/db/schema/[^/]+\.ts$'; then
  exit 0
fi
if echo "$FILE_PATH" | grep -qE '/db/schema/index\.ts$'; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
SCHEMA_INDEX="$PROJECT_DIR/backend/apps/backend-api/src/db/schema/index.ts"
SCHEMA_NAME=$(basename "$FILE_PATH" .ts)

if [ -f "$SCHEMA_INDEX" ]; then
  if ! grep -q "$SCHEMA_NAME" "$SCHEMA_INDEX" 2>/dev/null; then
    echo "WARNING: Schema '$SCHEMA_NAME' is NOT exported from db/schema/index.ts"
    echo "Add: export * from './$SCHEMA_NAME.js'; to the index file."
  fi
fi

# Remind about migration
echo "REMINDER: If this is a new/modified schema, run /migrate generate to create the SQL migration."

exit 0
