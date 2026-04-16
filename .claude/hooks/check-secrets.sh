#!/bin/bash
# PreToolUse hook for Write/Edit: Detect hardcoded secrets
set -e

INPUT=$(cat /dev/stdin 2>/dev/null || echo '{}')

# Get file path and content depending on tool
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // empty' 2>/dev/null)

if [ -z "$CONTENT" ]; then
  exit 0
fi

# Skip test files and example files
if echo "$FILE_PATH" | grep -qE '(\.test\.|\.spec\.|\.example|__tests__|__mocks__|\.env\.example)'; then
  exit 0
fi

# Check for common secret patterns
if echo "$CONTENT" | grep -qE '(sk-[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9]{20,})'; then
  echo "BLOCKED: Possible OpenAI API key detected. Use environment variables instead." >&2
  exit 2
fi

if echo "$CONTENT" | grep -qE '-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----'; then
  echo "BLOCKED: Private key detected in file content. Never commit private keys." >&2
  exit 2
fi

if echo "$CONTENT" | grep -qE 'password\s*[:=]\s*["\x27][^"\x27]{8,}["\x27]' | grep -vqE '(process\.env|\.PASSWORD|placeholder|example|test|mock)'; then
  echo "WARNING: Possible hardcoded password detected. Consider using environment variables."
fi

exit 0
