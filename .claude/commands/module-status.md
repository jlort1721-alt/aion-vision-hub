---
description: Show module coverage matrix — which of the 78 backend modules have routes, service, schemas, tests, frontend page, and API docs.
---

# Module Status Command

This command scans all backend modules and reports their completeness.

## Usage

`/module-status`

## What It Reports

For each of the 78 modules in `backend/apps/backend-api/src/modules/`:

| Check | Source |
|-------|--------|
| routes.ts | `modules/{name}/routes.ts` |
| service.ts | `modules/{name}/service.ts` |
| schemas.ts | `modules/{name}/schemas.ts` |
| test file | `__tests__/{name}*.test.ts` |
| DB schema | `db/schema/{name}.ts` |
| Frontend service | `src/services/{name}-api.ts` |
| Frontend page | `src/pages/{Name}Page.tsx` |

## Output Format

```
MODULE STATUS MATRIX
====================
Total modules: 78

MODULE              | routes | service | schemas | tests | db-schema | fe-service | fe-page
--------------------|--------|---------|---------|-------|-----------|------------|--------
access-control      |   OK   |   OK    |   OK    |  OK   |    OK     |     OK     |   OK
ai-bridge           |   OK   |   OK    |   OK    |  --   |    --     |     --     |   OK
alerts              |   OK   |   OK    |   OK    |  OK   |    OK     |     OK     |   OK
...

SUMMARY
-------
Full stack (all 7):  X modules
Backend complete:    X modules (routes + service + schemas)
Has tests:           X modules
Routes only:         X modules
Missing tests:       X modules (list)
Missing schemas:     X modules (list)

RECOMMENDATIONS
---------------
1. Priority: Add tests to CRITICAL modules: [list]
2. Add schemas.ts to route-only modules: [list]
3. Run /scaffold for modules needing full stack
```

## Implementation

This command does NOT invoke an agent. It uses Glob and Grep directly:

```bash
# List all modules
ls backend/apps/backend-api/src/modules/

# For each module, check file existence
for module in $(ls backend/apps/backend-api/src/modules/); do
  routes=$([ -f "backend/apps/backend-api/src/modules/$module/routes.ts" ] && echo "OK" || echo "--")
  service=$([ -f "backend/apps/backend-api/src/modules/$module/service.ts" ] && echo "OK" || echo "--")
  schemas=$([ -f "backend/apps/backend-api/src/modules/$module/schemas.ts" ] && echo "OK" || echo "--")
  test=$(ls backend/apps/backend-api/src/__tests__/${module}*.test.ts 2>/dev/null && echo "OK" || echo "--")
  echo "$module | $routes | $service | $schemas | $test"
done
```

## Arguments

No arguments needed — scans all modules automatically.
