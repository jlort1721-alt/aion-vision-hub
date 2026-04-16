---
description: Audit and update dependencies — run npm audit, identify vulnerabilities, propose updates, and validate with tests.
---

# Dependency Update Command

This command orchestrates dependency auditing and updating without a dedicated agent.

## Usage

`/dep-update`

## Workflow

### Step 1: Audit Current State
```bash
# Check for vulnerabilities
npm audit --audit-level=moderate

# Check for outdated packages
npm outdated

# Check backend dependencies
cd backend && pnpm audit && pnpm outdated
```

### Step 2: Classify Issues

| Severity | Action | Example |
|----------|--------|---------|
| Critical | Update immediately | Known RCE, auth bypass |
| High | Update this sprint | XSS, SQL injection |
| Moderate | Plan update | DoS, info disclosure |
| Low | Update when convenient | Minor issues |

### Step 3: Update Dependencies
```bash
# Fix audit issues automatically (safe)
npm audit fix

# Update specific packages
npm update <package-name>

# Major version updates (review breaking changes first)
npm install <package-name>@latest
```

### Step 4: Validate
```bash
# Run tests
pnpm --filter @aion/backend-api test

# Type check
npx tsc --noEmit

# Build
npm run build
```

### Step 5: Report

```
DEPENDENCY UPDATE REPORT
========================
Date: YYYY-MM-DD

VULNERABILITIES FIXED
---------------------
Critical: X → 0
High: X → 0
Moderate: X → X

PACKAGES UPDATED
-----------------
[package]: X.Y.Z → A.B.C (reason)

TESTS
-----
Backend: PASS (X/Y)
Frontend: PASS
TypeScript: PASS

REMAINING ISSUES
----------------
[List any unresolved vulnerabilities with justification]
```

## Important Notes

- Always run tests after updating dependencies
- Review breaking changes for major version updates
- Check `THIRD-PARTY-LICENSES.md` for license compatibility
- Commit dependency updates separately from feature code
