#!/bin/bash
# PreToolUse hook for Write: Block destructive migration operations
set -e

INPUT=$(cat /dev/stdin 2>/dev/null || echo '{}')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty' 2>/dev/null)

# Only check SQL migration files
if ! echo "$FILE_PATH" | grep -qE '/db/migrations/.*\.sql$'; then
  exit 0
fi

if [ -z "$CONTENT" ]; then
  exit 0
fi

# Check for destructive operations
if echo "$CONTENT" | grep -iqE 'DROP TABLE[^;]*;'; then
  echo "BLOCKED: DROP TABLE detected in migration. This is a destructive operation that requires explicit confirmation." >&2
  echo "If intentional, add a comment '-- CONFIRMED: DROP TABLE' above the statement." >&2
  if ! echo "$CONTENT" | grep -q '-- CONFIRMED: DROP TABLE'; then
    exit 2
  fi
fi

if echo "$CONTENT" | grep -iqE 'TRUNCATE'; then
  echo "BLOCKED: TRUNCATE detected in migration. This will delete all data in the table." >&2
  exit 2
fi

if echo "$CONTENT" | grep -iqE 'DROP COLUMN'; then
  echo "WARNING: DROP COLUMN detected. Ensure this column has no data or the data has been migrated."
fi

# Check for NOT NULL without DEFAULT
if echo "$CONTENT" | grep -iqE 'NOT NULL' | grep -ivqE '(DEFAULT|PRIMARY KEY|REFERENCES)'; then
  echo "WARNING: NOT NULL column detected. Ensure a DEFAULT value is provided for existing rows."
fi

exit 0
