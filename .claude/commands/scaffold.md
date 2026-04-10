---
description: Scaffold a complete full-stack module — generates backend routes, service, schemas, DB schema, tests, frontend service, and page following project patterns.
---

# Scaffold Command

This command invokes the **module-scaffold** agent to generate a complete module.

## Usage

`/scaffold <module-name>`

Example: `/scaffold visitor-badges`

## What Gets Generated

1. **Backend module** in `backend/apps/backend-api/src/modules/{name}/`:
   - `routes.ts` — Fastify CRUD routes with `requireRole()` + `request.audit()`
   - `service.ts` — Class-based service with Drizzle ORM + tenant isolation
   - `schemas.ts` — Zod validation schemas + type exports

2. **Database schema** in `backend/apps/backend-api/src/db/schema/{name}.ts`:
   - Drizzle `pgTable` definition with `tenant_id`
   - Export added to `db/schema/index.ts`

3. **Test file** in `backend/apps/backend-api/src/__tests__/{name}-service.test.ts`:
   - vitest tests for CRUD operations + tenant isolation

4. **Frontend service** in `src/services/{name}-api.ts`:
   - API client functions using `apiClient`

5. **Frontend page** in `src/pages/{Name}Page.tsx`:
   - React page with shadcn/ui components
   - Spanish UI text
   - Data table + CRUD dialog

## Patterns Used

All generated code follows the `alerts` module pattern — the most complete reference module in the project.

## Post-Scaffold Steps

After scaffolding:
1. Review generated files
2. Customize schema fields for your domain
3. Run `/migrate generate` if DB schema was created
4. Run `/tdd` to add more specific tests
5. Run `/verify quick` to validate everything compiles

## Related Agent

This command invokes the `module-scaffold` agent located at:
`.claude/agents/module-scaffold.md`

## Arguments

$ARGUMENTS: The module name in kebab-case (e.g., `visitor-badges`, `patrol-routes`)
