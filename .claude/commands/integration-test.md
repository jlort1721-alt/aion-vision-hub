---
description: Generate and run integration tests for cross-module flows — test API chains, event-driven flows, and worker integrations.
---

# Integration Test Command

This command invokes the **integration-tester** agent for cross-module testing.

## Usage

`/integration-test [subcommand] [flow-name]`

## Subcommands

### `generate <flow-name>`
Generate integration test file for a specific flow.

Available flows:
- `detection-alert` — Camera detection → alert → notification chain
- `auth-resource-audit` — Auth → CRUD → audit log chain
- `device-event-incident` — Device event → incident → escalation chain
- `automation-scene` — Automation rule → scene → device control chain
- `backup-retention` — Backup worker → retention cleanup chain
- Custom: describe any flow and the agent will generate tests

### `run`
Execute all integration tests:
```bash
pnpm --filter @aion/backend-api test -- --grep "Integration:"
```

### `coverage`
Show which modules are covered by integration tests and which flows are untested.

## Test Location

Integration tests are generated in: `backend/apps/backend-api/src/__tests__/integration/`

## Related Agent

This command invokes the `integration-tester` agent located at:
`.claude/agents/integration-tester.md`

## Arguments

$ARGUMENTS can be: `generate <flow-name>`, `run`, `coverage`
