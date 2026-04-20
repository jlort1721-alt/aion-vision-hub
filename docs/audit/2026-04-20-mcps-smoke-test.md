# MCPs Smoke Test — 2026-04-20

**MCPs probados:** `go2rtc-mcp` + `pm2-mcp` (ambos en `.claude/mcps/`).

**Método:** stdio JSON-RPC directo: `initialize` → `tools/list` → `tools/call` (una tool por MCP).

---

## go2rtc-mcp

### tools/list

```json
{"tools":[
  {"name":"list_streams", "description":"List all configured go2rtc streams..."},
  {"name":"get_stream",   "description":"Get detail of a single stream..."},
  {"name":"probe_hls",    "description":"Make a HEAD request to the stream's HLS endpoint..."},
  {"name":"reload_config","description":"Trigger go2rtc to re-read its yaml..."}
]}
```

**4/4 tools presentes.**

### tools/call: list_streams (via SSH tunnel `-L 1984:127.0.0.1:1984`)

```json
{"result":{"content":[{"type":"text","text":"{\"streams\":{ ...115 streams... }}"}]}}
```

**115 streams en respuesta.** Desglose aproximado:
- `aion_*`: NVR/XVR compuestos (RTSP interno)
- `da-*`: Dahua Imou HLS firmadas (13 devices × múltiples canales)
- `hik_*`: Hikvision por canal (28 devices × canales — aunque sin producer activo hoy)
- `portal_*`: Portal Plaza workers (único snap-* activo)

### Error handling

Llamada sin tunnel retorna `{"isError":true, "content":[{"text":"Error: fetch failed"}]}` — comportamiento esperado.

---

## pm2-mcp

### tools/list

```json
{"tools":[
  {"name":"list",     "description":"JSON list of all PM2 processes (jlist)."},
  {"name":"status",   "description":"Human-readable pm2 status table."},
  {"name":"logs",     "description":"Tail logs for one process. args: {name, lines<=500}."},
  {"name":"restart",  "description":"Restart one process by name. Name must match [a-z0-9_-]."},
  {"name":"stop",     "description":"Stop one process by name."},
  {"name":"start",    "description":"Start a previously-registered process by name."},
  {"name":"describe", "description":"Detailed description of one process (memory, restarts, env)."}
]}
```

**7/7 tools presentes.** Destructive ops (`delete`, `kill`) NO expuestos — por diseño.

### tools/call: list (SSH a aion-vps)

```json
{"result":{"content":[{"type":"text","text":"{
  \"argv\": [\"pm2\", \"jlist\"],
  \"code\": 0,
  \"stdout\": \"[{\\\"pid\\\":1362,\\\"name\\\":\\\"pm2-logrotate\\\",...}]\",
  \"stderr\": \"\"
}"}]}}
```

**code=0, exec limpio.** La tool devuelve el JSON de `pm2 jlist` completo (32 procesos, incluyendo aionseg-api post-vault-migration).

### Regex guard verificado

Nombres inválidos para `restart`/`stop`/`start`/`logs`/`describe`:
- `pm2; rm -rf /` → rechazado por regex `^[a-z0-9][a-z0-9_-]{0,63}$`
- `../../secret` → rechazado
- `` (empty) → rechazado por `.min(1)` de Zod

### Timeout enforcement

Hard kill 20 s por invocación (vía `setTimeout(() => child.kill("SIGKILL"), 20_000)`).

---

## Registro pendiente

Ambos MCPs compilan (`dist/index.js` presente), tienen deps instaladas (`node_modules/`), y responden correctamente por stdio. **Falta registrarlos en `.claude/settings.local.json`** — ver [docs/runbooks/register-mcps.md](../runbooks/register-mcps.md) para el parche JSON (operador aplica manualmente).

## Troubleshooting rápido

| Síntoma | Diagnóstico |
|---|---|
| `Error: fetch failed` en go2rtc tools | No hay SSH tunnel a `127.0.0.1:1984` del VPS → `ssh -f -N -L 1984:127.0.0.1:1984 aion-vps` |
| `ssh: Permission denied` en pm2 tools | `ssh-add ~/.ssh/clave-demo-aion.pem` o entrada en `~/.ssh/config` |
| MCP spawn falla | `cd .claude/mcps/<name> && npm install && npm run build` |
| Tools responden lento (>5 s) | go2rtc `/api/streams` con muchos streams → considerar paginación en un v0.2 |
