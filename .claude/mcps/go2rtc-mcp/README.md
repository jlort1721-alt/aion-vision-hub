# go2rtc-mcp

MCP server exposing the local go2rtc REST API (`http://127.0.0.1:1984`) as tools
callable from Claude Code.

## Tools

| name | description |
|---|---|
| `list_streams` | Returns all configured stream keys + sources |
| `get_stream` | Probes one stream (producer state, consumers) |
| `probe_hls` | HEAD `/api/stream.m3u8?src=<key>` + ttfb_ms |
| `reload_config` | POST `/api/config` — reload yaml without restart |

## Install

```bash
cd .claude/mcps/go2rtc-mcp
npm install
npm run build
```

## Register in `.claude/settings.local.json`

```json
{
  "mcpServers": {
    "go2rtc": {
      "command": "node",
      "args": [".claude/mcps/go2rtc-mcp/dist/index.js"],
      "env": { "GO2RTC_API_URL": "http://127.0.0.1:1984" }
    }
  }
}
```

For remote (SSH) use, replace with an `ssh` wrapper:

```json
"command": "ssh",
"args": ["aion-vps", "cd /var/www/aionseg && node .claude/mcps/go2rtc-mcp/dist/index.js"]
```

## Safety

- Read-heavy tools: `list_streams`, `get_stream`, `probe_hls`.
- Write tool: `reload_config` — rereads yaml file; does not restart the service.
- No auth required: go2rtc listens on loopback only.
