---
description: Manage database migrations — generate, validate, run, rollback, and check status of Drizzle ORM migrations.
---

# Migrate Command

This command invokes the **db-migration** agent to manage database schema migrations.

## Usage

`/migrate [subcommand]`

## Subcommands

### `generate`
Scan Drizzle schema files for changes and generate a new SQL migration file.
1. Compare current schema files in `backend/apps/backend-api/src/db/schema/` with existing migrations
2. Generate SQL migration with next sequential number
3. Include UP and DOWN sections
4. Validate safety (no destructive operations without confirmation)

### `validate`
Check all pending migrations for safety issues.
1. Scan migration files for destructive operations (DROP, TRUNCATE)
2. Verify NOT NULL columns have defaults
3. Check foreign key references exist
4. Report BLOCK / WARN / OK for each migration

### `run`
Execute pending migrations against the database.
1. Show pending migrations
2. Confirm with user before executing
3. Apply migrations in order
4. Verify schema consistency after apply

### `rollback`
Undo the last applied migration.
1. Identify last applied migration
2. Execute DOWN migration section
3. Verify rollback was successful

### `status`
Show migration status.
1. List all migrations and their applied status
2. Detect schema drift (code vs database)
3. Show next expected migration number

## Related Files

- Schema files: `backend/apps/backend-api/src/db/schema/*.ts`
- Migration files: `backend/apps/backend-api/src/db/migrations/*.sql`
- Schema index: `backend/apps/backend-api/src/db/schema/index.ts`
- DB client: `backend/apps/backend-api/src/db/client.ts`

## Related Agent

This command invokes the `db-migration` agent located at:
`.claude/agents/db-migration.md`

## Arguments

$ARGUMENTS can be: `generate`, `validate`, `run`, `rollback`, `status`
