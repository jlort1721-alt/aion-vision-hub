---
description: Generate and validate API documentation — scan Fastify routes and Zod schemas to produce OpenAPI 3.1 specs and per-module docs.
---

# API Docs Command

This command invokes the **api-docs-generator** agent to generate and maintain API documentation.

## Usage

`/api-docs [subcommand]`

## Subcommands

### `generate`
Full scan of all 77 route files → generate OpenAPI spec and per-module documentation.
- Output: `docs/api/openapi.json` + `docs/api/{module}.md` per module

### `validate`
Check that all routes have corresponding schema documentation.
- Report undocumented endpoints
- Report missing Zod schemas
- Report response type gaps

### `diff`
Compare current routes against last generated spec.
- Show added, removed, and changed endpoints
- Useful before releases to track API changes

## Related Files

- Route files: `backend/apps/backend-api/src/modules/*/routes.ts`
- Schema files: `backend/apps/backend-api/src/modules/*/schemas.ts`
- Output: `docs/api/`

## Related Agent

This command invokes the `api-docs-generator` agent located at:
`.claude/agents/api-docs-generator.md`

## Arguments

$ARGUMENTS can be: `generate`, `validate`, `diff`
