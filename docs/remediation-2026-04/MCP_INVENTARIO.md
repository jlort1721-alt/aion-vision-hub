# MCP INVENTARIO — 2026-04-15

## Configuración actual

### `.mcp.json` (raíz)
```json
{
  "mcpServers": {
    "codex": { "command": "npx", "args": ["-y", "@block/codex-mcp"], "env": {"OPENAI_API_KEY": "${OPENAI_API_KEY}"} },
    "gemini": { "command": "npx", "args": ["-y", "gemini-mcp-tool"], "env": {"GEMINI_API_KEY": "${GEMINI_API_KEY}"} }
  }
}
```

### `.claude/settings.json` / `.claude/settings.local.json`
- Hooks configurados (validate-bash, check-secrets, prettier, module-completeness, session-audit).
- **No hay servidores MCP adicionales** definidos a nivel de Claude Code aquí.
- CLAUDE.md referencia Context7, n8n-MCP, Claude-Mem, Supabase vía claude.ai integration — esos son MCPs del cliente Claude.ai, no del repo.

## Comparación contra tabla esperada del prompt maestro

| MCP esperado | Configurado | Estado | Plan |
|---|---|---|---|
| postgres-aion | No | **FALTANTE** | Implementar MCP wrapper de `pg` Pool apuntando a `aionseg_prod`. 2 días. |
| hikvision-isapi | No | **FALTANTE** | Adapter MCP para HTTP ISAPI (puerto 8000 del DVR). Usar `hikvisionISAPITools` ya existentes en `tools/hikvision-isapi-tools.ts`. 2 días. |
| dahua-imou | No | **FALTANTE** | Adapter MCP para Dahua IMOU SDK / IMOU Cloud API. 2-3 días. |
| ewelink | No | **FALTANTE** | MCP wrapper de `@ewelink/sdk` — hay handlers ya en `ewelink-tools.ts`. 1-2 días. |
| asterisk-ami | No | **FALTANTE** | Cliente AMI protocol para VoIP. 2-3 días. |
| twilio | No | **FALTANTE** | MCP Twilio SDK (voz + WhatsApp Business). 1-2 días. |
| n8n | No | **FALTANTE** | REST API client con Bearer token (60 workflows activos). 1 día. |
| filesystem-aion | No | **FALTANTE** | MCP con acceso controlado a `/var/www/aionseg/logs`, `/opt/aion/`. 1 día. |
| go2rtc | No | **FALTANTE** | Protocol client RTSP/HLS + `/api/streams`. 2 días. |
| face-recognition | No | **FALTANTE** | MCP bridge al servicio Python PM2 `face-recognition`. 1 día. |
| codex | Sí | OK | OpenAI backend via Block. Mantener. |
| gemini | Sí | OK | Google Gemini. Mantener. |

## Cobertura: 2/12 (17%)

## Priorización

### P0 (bloquean arquitectura)
1. **postgres-aion** — queries DB directas desde Claude Code.
2. **go2rtc** — streaming RTSP (128 streams activos).
3. **filesystem-aion** — acceso a logs/configs del VPS.

### P1 (integraciones operativas)
4. **asterisk-ami** — control VoIP (42 endpoints PJSIP).
5. **twilio** — SMS/WhatsApp (fallback de Asterisk).
6. **n8n** — 60 workflows en `http://127.0.0.1:5678`.

### P2 (hardware-específicos)
7. **hikvision-isapi** — ya existe lógica en `tools/hikvision-isapi-tools.ts`, solo falta exponerla como MCP.
8. **dahua-imou**
9. **ewelink** — ya existe lógica en `tools/ewelink-tools.ts`.
10. **face-recognition**

## Recomendación

Implementar MCPs P0 primero (postgres-aion, go2rtc, filesystem-aion) porque son genéricos y desbloquean debugging directo desde la CLI. Los P2 ya tienen su lógica en los tool handlers del AION Agent — encapsularlos como MCPs separados es trabajo de wrapper, no de implementación.
