---
description: Manage deployments — run pre-flight checks, deploy to staging or production, execute rollbacks, and verify deployment health.
---

# Deploy Command

This command invokes the **deploy-rollback** agent to manage the deployment lifecycle.

## Usage

`/deploy [subcommand]`

## Subcommands

### `preflight`
Run all pre-deployment validations:
- TypeScript check, test suite, security scan
- Docker health, environment variables
- Pending migrations check
- Uncommitted changes check

### `staging`
Deploy to staging environment:
- Build frontend + backend
- Build Docker images
- Run migrations on staging DB
- Restart services
- Run smoke tests

### `production`
Deploy to production (requires explicit user approval):
- Verify staging tests passed
- Create deployment checkpoint (git tag)
- Build and push to GHCR
- Apply migrations
- Zero-downtime restart
- Post-deploy smoke tests + monitoring

### `rollback`
Revert to previous deployment:
- Identify previous version
- Revert Docker image
- Rollback migration (if safe)
- Restart services
- Verify rollback

### `status`
Show current deployment state:
- Running version
- Last deployment date
- Pending changes
- Service health

## Related Agent

This command invokes the `deploy-rollback` agent located at:
`.claude/agents/deploy-rollback.md`

## Arguments

$ARGUMENTS can be: `preflight`, `staging`, `production`, `rollback`, `status`
