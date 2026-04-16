---
description: Incident response — triage system issues, investigate symptoms, execute diagnostic runbooks, and generate post-mortem reports.
---

# Incident Command

This command invokes the **incident-response** agent for incident management.

## Usage

`/incident [subcommand] [details]`

## Subcommands

### `triage`
Quick system diagnostic (< 2 minutes):
- Backend health, PM2 status, Docker containers
- Redis, PostgreSQL connectivity
- Recent error log scan
- Disk space and memory check
- Go2rtc stream count

### `investigate <symptom>`
Deep investigation of a specific symptom:
- `"API is slow"` — DB connections, Redis, PM2 CPU
- `"Streams are down"` — go2rtc, MediaMTX, ffmpeg, network
- `"Auth is failing"` — JWT, Supabase, session store
- `"Workers are stuck"` — Queue lengths, deadlocks, worker logs
- `"Database errors"` — Connection pool, disk, locks, migrations

### `postmortem`
Generate a post-mortem report:
- Incident timeline
- Root cause analysis
- Impact assessment
- Lessons learned
- Action items

### `runbook`
Execute the standard diagnostic runbook:
- Full service restart procedure
- Database recovery steps
- Stream recovery steps
- Escalation path

## Related Agent

This command invokes the `incident-response` agent located at:
`.claude/agents/incident-response.md`

## Arguments

$ARGUMENTS can be: `triage`, `investigate <symptom>`, `postmortem`, `runbook`
