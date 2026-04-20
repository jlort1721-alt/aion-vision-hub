# pm2-mcp

MCP server that tunnels a strictly-whitelisted set of PM2 commands over SSH
to the VPS.

## Safety model

- All calls go through `ssh ${PM2_MCP_SSH_HOST} -- pm2 <cmd>` — SSH key auth
  only (no password). The host is configurable via env.
- Only the commands in the allowlist (`list | status | logs | restart | stop
  | start | describe`) are reachable. No passthrough / shell / delete / kill.
- Process names must match `^[a-z0-9][a-z0-9_-]{0,63}$` — no paths, no JSON
  configs, no chained commands.
- Log tailing is bounded (`--lines` max 500, `--nostream`), 20 s hard timeout
  per call, 20 KB stdout cap, 4 KB stderr cap.

## Tools

| name | args | effect |
|---|---|---|
| `list` | — | `pm2 jlist` |
| `status` | — | `pm2 status --no-colors` |
| `describe` | `{name}` | `pm2 describe <name>` |
| `logs` | `{name, lines<=500}` | `pm2 logs <name> --lines N --nostream` |
| `restart` | `{name}` | `pm2 restart <name>` |
| `stop` | `{name}` | `pm2 stop <name>` |
| `start` | `{name}` | `pm2 start <name>` (must be registered) |

## Install

```bash
cd .claude/mcps/pm2-mcp
npm install && npm run build
```

## Register

```json
{
  "mcpServers": {
    "pm2": {
      "command": "node",
      "args": [".claude/mcps/pm2-mcp/dist/index.js"],
      "env": { "PM2_MCP_SSH_HOST": "aion-vps" }
    }
  }
}
```

## NOT covered (deliberately)

- `pm2 delete` — destructive. Requires manual SSH.
- `pm2 kill` — whole daemon. Requires manual SSH.
- `pm2 start <path>` with a path / ecosystem file — requires manual SSH.
- Cluster scale-up / scale-down — requires manual SSH.

This is by design: the agent can diagnose and restart services, but cannot
silently remove them.
