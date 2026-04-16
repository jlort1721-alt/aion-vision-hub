# Hooks System

## Hook Types

- **PreToolUse**: Before tool execution (validation, parameter modification)
- **PostToolUse**: After tool execution (auto-format, checks)
- **Stop**: When session ends (final verification)

## Configuration

Hooks are configured in `.claude/settings.json` (project-level).
Hook scripts are located in `.claude/hooks/` (9 executable bash scripts).
All hooks receive JSON on stdin with `tool_input`, `tool_name`, etc. Parsed via `jq`.
Exit code 2 = block the operation. Exit code 0 = allow.

## Implemented Hooks (in .claude/settings.json)

### PreToolUse (3 matchers, 4 scripts)

| Matcher | Script | Action |
|---------|--------|--------|
| Bash | `validate-bash.sh` | Branch protection (blocks push/merge to main), tmux reminder for long commands, import validation warning |
| Write | `check-secrets.sh` | Blocks hardcoded API keys, private keys, passwords |
| Write | `migration-safety.sh` | Blocks DROP TABLE/TRUNCATE in migration SQL files |
| Edit | `check-secrets.sh` | Same secret detection for edits |

### PostToolUse (2 matchers, 4 scripts)

| Matcher | Script | Action |
|---------|--------|--------|
| Write/Edit | `prettier.sh` | Auto-formats .ts/.tsx/.js/.json with Prettier |
| Write/Edit | `console-log-warn.sh` | Warns about console.log in source files |
| Write/Edit | `module-completeness.sh` | Checks if edited module has service.ts, schemas.ts, and test file |
| Write/Edit | `schema-validation.sh` | Verifies DB schema is exported in index.ts, reminds about migration |

### Stop (1 matcher, 1 script)

| Matcher | Script | Action |
|---------|--------|--------|
| * | `session-audit.sh` | Checks: uncommitted changes, console.log, TODO/FIXME, security scan |

## Auto-Accept Permissions

Use with caution:
- Enable for trusted, well-defined plans
- Disable for exploratory work
- Never use dangerously-skip-permissions flag
- Configure `allowedTools` in `~/.claude.json` instead

## TodoWrite Best Practices

Use TodoWrite tool to:
- Track progress on multi-step tasks
- Verify understanding of instructions
- Enable real-time steering
- Show granular implementation steps

Todo list reveals:
- Out of order steps
- Missing items
- Extra unnecessary items
- Wrong granularity
- Misinterpreted requirements
