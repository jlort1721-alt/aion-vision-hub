# Registrar `go2rtc-mcp` + `pm2-mcp` en Claude Code

**Último build:** ambos MCPs compilan limpio tras restringir `types` en `tsconfig.json` (evita colisión con los `@types/react-* 2` duplicados del monorepo).

**Dependencias instaladas:** ambos MCPs tienen `node_modules/` locales (`.claude/mcps/go2rtc-mcp/node_modules`, `.claude/mcps/pm2-mcp/node_modules`).

**Build artifacts:**
- `.claude/mcps/go2rtc-mcp/dist/index.js`
- `.claude/mcps/pm2-mcp/dist/index.js`

---

## 1. Por qué no está aplicado aún

El hook de policy deniega modificar `.claude/settings.local.json` (es config de agente). El parche queda documentado aquí; tú lo aplicas en una edición manual.

## 2. Parche a aplicar

Editar `/Users/ADMIN/Documents/open-view-hub-main/.claude/settings.local.json` y añadir la llave `mcpServers` al top-level del JSON (al mismo nivel que `permissions`):

```json
{
  "permissions": { ...dejar intacto... },
  "mcpServers": {
    "go2rtc": {
      "command": "node",
      "args": [".claude/mcps/go2rtc-mcp/dist/index.js"],
      "env": {
        "GO2RTC_API_URL": "http://127.0.0.1:1984"
      }
    },
    "pm2": {
      "command": "node",
      "args": [".claude/mcps/pm2-mcp/dist/index.js"],
      "env": {
        "PM2_MCP_SSH_HOST": "aion-vps"
      }
    }
  }
}
```

El `GO2RTC_API_URL` asume que corres Claude Code desde el VPS o que tienes un túnel SSH local mapeando `127.0.0.1:1984` al go2rtc del VPS (p. ej. `ssh -L 1984:127.0.0.1:1984 aion-vps -N`).

El `PM2_MCP_SSH_HOST=aion-vps` asume que tu `~/.ssh/config` tiene una entrada `Host aion-vps` apuntando a `18.230.40.6` con la llave `clave-demo-aion.pem` (ver `docs/runbooks/github-secrets-setup.md` §2.1).

## 3. Después del parche

```bash
# Reiniciar Claude Code para recoger los MCPs nuevos
# (en VSCode: Cmd+Shift+P → Developer: Reload Window)
# (o en el CLI: simplemente arranca un chat nuevo)

# En chat, confirmar:
/mcp list
# Esperado: aparecen "go2rtc" y "pm2" como MCP servers activos
```

## 4. Smoke tests esperados

| MCP | Tool | Resultado esperado |
|---|---|---|
| go2rtc | `list_streams` | JSON con ~112+ streams (hik_*, imou_*, portal_*, etc) |
| go2rtc | `get_stream` con `src=portal_plaza_cam1` | `{producers:[{state:"connected"…}]}` |
| go2rtc | `probe_hls` con `src=portal_plaza_cam1` | `{status:200, ttfb_ms:<1000}` |
| go2rtc | `reload_config` | `{ok:true}` |
| pm2 | `list` | 32 procesos |
| pm2 | `status` | Tabla con 19 online / 13 stopped |
| pm2 | `describe` con `name=aionseg-api` | memoria ~180MB, cluster mode |
| pm2 | `logs` con `name=hik-monitor` + `lines=20` | Últimas 20 líneas |

## 5. Seguridad

- `go2rtc-mcp` solo habla con `127.0.0.1:1984` — sin auth porque go2rtc escucha solo en loopback del VPS.
- `pm2-mcp` usa `ssh` con allowlist de 7 comandos (`list | status | logs | restart | stop | start | describe`). Nombres de procesos forzados a regex `^[a-z0-9][a-z0-9_-]{0,63}$`. Comandos destructivos (`pm2 delete`, `pm2 kill`) NO expuestos — hay que SSH manual.
- Timeout 20 s por call, 20 KB stdout cap, 4 KB stderr cap.
- Error `EACCES` o `ssh: connection refused`: confirma que el SSH host está bien configurado y que la llave tiene perms 600.

## 6. Troubleshooting

**MCP no aparece en `/mcp list` tras reload:**
1. Ver logs del harness: `~/Library/Logs/claude-code/` (macOS) o equivalente.
2. Buscar stderr del spawn: `[go2rtc-mcp] ready` o `[pm2-mcp] ready` indica arranque OK.

**Stream tools devuelven `fetch failed`:**
1. Confirma go2rtc corre: `ssh aion-vps 'curl -s http://127.0.0.1:1984/api/streams | jq keys | head -5'`.
2. Si corres Claude Code localmente, monta el túnel: `ssh -f -N -L 1984:127.0.0.1:1984 aion-vps`.

**pm2 tool devuelve `SSH permission denied`:**
1. `ssh aion-vps 'pm2 list'` desde tu terminal — confirma agente SSH cargado.
2. Si falla, `ssh-add ~/.ssh/clave-demo-aion.pem`.

## 7. Rebuilds

Si tocas el código fuente de los MCPs:

```bash
cd .claude/mcps/go2rtc-mcp && npm run build
cd .claude/mcps/pm2-mcp    && npm run build
# No hace falta reiniciar Claude Code — el spawn es por-invocación.
```

Para cambios en `package.json`/deps: `npm install` primero.
