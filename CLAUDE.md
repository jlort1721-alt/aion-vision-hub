# Clave Seguridad — AION Vision Hub

Enterprise Video Management System (VMS) platform. Replaces iVMS-4200 (Hikvision) and DSS (Dahua) with a unified, modern multi-tenant platform.

**Production:** aionseg.co | **VPS:** 18.230.40.6 | **Score:** 99/100

## Tech Stack

- **Frontend:** React 18 + TypeScript 5.8 + Vite 5 + Tailwind CSS 3 + shadcn/ui + Radix UI
- **Backend:** Fastify 5 + Node 20 + TypeScript (monorepo with pnpm + Turborepo)
- **Database:** PostgreSQL 16 + Drizzle ORM + Redis (ioredis)
- **Auth:** Supabase Auth (JWT-based, zero supabase.from() in production code)
- **Video:** HLS.js + go2rtc + ffmpeg (H.264 transcode) + MediaMTX
- **Deployment:** Docker + PM2 (19 services) + GitHub Actions CI/CD

## Project Structure

```
src/                          # Frontend React app
  components/                 # 50+ feature components
    ui/                       # shadcn/ui primitives
  pages/                      # 69 page modules
  services/                   # API client functions (40+ files)
  hooks/                      # Custom React hooks
  contexts/                   # AuthContext + state providers
  types/                      # TypeScript type definitions

backend/
  apps/
    backend-api/src/          # Main Fastify application
      modules/                # 77+ feature modules (routes + service per module)
      db/schema/              # Drizzle ORM schema (143 tables)
      db/migrations/          # SQL migrations
      services/               # 42 service modules
      workers/                # 10+ background job processors
      plugins/                # Fastify plugins (auth, audit, rate-limit)
    edge-gateway/             # Edge function proxy
  packages/
    shared-contracts/         # API response types, MCPTool interface
    common-utils/             # Crypto (AES-256-GCM), validation, logging
    device-adapters/          # Hikvision, Dahua, ONVIF adapters
```

## Inventory

| Asset | Count |
|-------|-------|
| Backend endpoints | 35 verified |
| Backend modules | 84+ compiled |
| Frontend pages | 69 |
| Frontend routes | 54+ |
| Database tables | 143 |
| MCP tools | 83 registered |
| PM2 services | 19 online |
| n8n workflows | 60 operational |
| go2rtc streams | 360 |

## Conventions

### Language
- **UI text:** Spanish (all labels, placeholders, messages, tooltips)
- **Code:** English (variables, functions, comments, commit messages)

### Frontend
- Components: shadcn/ui + Radix UI primitives (config: `components.json`)
- Styling: Tailwind CSS with CSS variables (config: `tailwind.config.ts`)
- Brand colors: navy (900/800/700/500), brand-red (600/700/900), gold (500/700)
- Icons: `lucide-react`
- State: Zustand 4.5 + React Hook Form 7 + Zod validation
- HTTP: `apiClient` (custom fetch-based in `src/services/`)
- Dark mode: `next-themes` with class strategy
- No direct `supabase.from()` calls — all data through backend API

### Backend
- Module pattern: `modules/{name}/routes.ts` + `modules/{name}/service.ts`
- Schemas: `modules/{name}/schemas.ts` (Zod)
- Database: Drizzle ORM queries in service files, schema in `db/schema/*.ts`
- Auth: JWT + API Key middleware, RBAC via `requireRole()`
- Audit: `request.audit()` decorator on all mutating endpoints (179+ calls)
- Rate limiting: per-module configuration

### Testing
- Runner: `vitest` (config: `vitest.config.ts`)
- Backend tests: `backend/apps/backend-api/src/__tests__/`
- Frontend testing: `@testing-library/react` + `jsdom`
- Run: `pnpm --filter @aion/backend-api test`

## Anti-Hallucination Protocol

**MANDATORY for all responses:**
- Never claim something works without executing, testing, or showing code evidence
- Never assume routes, ports, entities, tables, or endpoints exist
- Before changing architecture, locate the actual current flow in code
- Every technical claim must reference file path, function/class/route, or test evidence
- Use verification tags:
  - `[EXISTE]` — verified in code/runtime
  - `[EXISTE PARCIAL]` — partially implemented
  - `[NO EXISTE]` — confirmed absent
  - `[HIPOTESIS]` — unverified assumption, needs validation

## MCP Servers (Claude Code)

Active MCP servers configured in `.claude/settings.local.json`:
- **Context7** — Up-to-date library documentation (Fastify, Drizzle, React, etc.)
- **n8n-MCP** — n8n workflow management (60 workflows, 1396 node docs)
- **Claude-Mem** — Persistent session memory (SQLite + vector search)
- **Supabase** — Database operations via claude.ai integration

## Skills System

Skills are located in `.claude/skills/` and provide specialized capabilities:

### Development Methodology (from obra/superpowers)
- `tdd.md` — Test-Driven Development (red-green-refactor with vitest)
- `debugging.md` — Systematic 4-phase debugging
- `brainstorming.md` — Socratic brainstorming before implementation
- `writing-plans.md` — Breaking work into 2-5 minute tasks
- `executing-plans.md` — Plan execution protocol
- `dispatching-parallel-agents.md` — Parallel subagent coordination
- `requesting-code-review.md` — Code review request protocol
- `receiving-code-review.md` — How to handle review feedback
- `finishing-a-development-branch.md` — Branch completion checklist

### Design System (from nextlevelbuilder/ui-ux-pro-max-skill)
- `ui-ux-pro-max/SKILL.md` — 50+ UI styles, 97 palettes, 57 font pairings, 99 UX guidelines
- `design/SKILL.md` — Design routing, CIP, logo, icon generation

### Backend & Security (from worldflowai/everything-claude-code)
- `backend-patterns/` — Fastify patterns, API design
- `security-review/` — Security audit methodology
- `tdd-workflow/` — Additional TDD patterns
- `coding-standards/` — Code quality standards
- `verification-loop/` — Verification after changes
- `continuous-learning/` — Learning from codebase patterns
- `strategic-compact/` — Context compression strategies
- `frontend-patterns/` — React/component patterns

### Documentation (from kepano/obsidian-skills)
- `obsidian-markdown/SKILL.md` — Markdown formatting standards
- `json-canvas/SKILL.md` — Architecture diagrams in JSON Canvas
- `obsidian-bases/SKILL.md` — Structured data in Markdown
- `defuddle/SKILL.md` — Content extraction and cleanup
- `obsidian-cli/SKILL.md` — CLI operations

## Subagents

Located in `.claude/agents/`:
- `architect.md` — System architecture decisions
- `build-error-resolver.md` — Build error diagnosis and fix
- `code-reviewer.md` — Code review execution
- `doc-updater.md` — Documentation updates
- `e2e-runner.md` — End-to-end test execution
- `planner.md` — Implementation planning
- `refactor-cleaner.md` — Code cleanup and refactoring
- `security-reviewer.md` — Security vulnerability scanning
- `tdd-guide.md` — TDD workflow guidance

## Commands

Located in `.claude/commands/`:
- `/build-fix` — Diagnose and fix build errors
- `/checkpoint` — Save progress checkpoint
- `/code-review` — Run code review
- `/e2e` — Run end-to-end tests
- `/eval` — Evaluate code quality
- `/learn` — Learn from codebase patterns
- `/orchestrate` — Multi-agent orchestration
- `/plan` — Create implementation plan
- `/refactor-clean` — Clean up code
- `/tdd` — Start TDD workflow
- `/test-coverage` — Check test coverage
- `/update-docs` — Update documentation
- `/verify` — Verify changes

## Workflow Integration

1. **Before coding:** Use brainstorming skill, then writing-plans skill
2. **During coding:** Follow TDD skill (red-green-refactor with vitest)
3. **Library docs:** Query Context7 MCP for up-to-date API references
4. **Automation check:** Query n8n-MCP to see if a workflow already handles the task
5. **UI components:** Follow UI/UX Pro Max skill + project design system (shadcn/ui + brand colors)
6. **After coding:** Use verification-loop skill, then requesting-code-review skill
7. **Documentation:** Follow obsidian-markdown skill for all .md files
8. **Session memory:** Claude-Mem auto-persists context across sessions

## n8n Automation

- **60 workflows** operational on VPS
- **9 webhooks** on PUBLIC_ROUTES: `/webhooks/n8n`, `/webhooks/twilio`
- Query existing workflows via n8n-MCP before creating backend automation code
- 1,396 n8n node types documented via MCP

## Build & Deploy

```bash
# Frontend
npm run build          # Vite production build
npx tsc --noEmit       # Type check

# Backend
pnpm build             # Turborepo build all packages
pnpm --filter @aion/backend-api test  # Run tests

# Deploy
# CI/CD via GitHub Actions: ci.yml, deploy-production.yml
# Production: Docker + PM2 on VPS 18.230.40.6
```
