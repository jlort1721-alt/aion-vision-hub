# MCP Strategy

## Architecture

```
┌─────────────────────────────────────────┐
│           MCP Connector Registry        │
├────────┬────────┬────────┬─────────────┤
│ Config │ Health │ Audit  │ Permissions │
├────────┴────────┴────────┴─────────────┤
│           MCP Execution Service         │
├─────────────────────────────────────────┤
│    Timeout + Retry + Fallback Policy    │
└─────────────────────────────────────────┘
```

## Connector Categories
- **Device**: ONVIF orchestration, inventory
- **Notification**: Email, push, SMS
- **Messaging**: WhatsApp Business
- **Storage**: Cloud storage for clips/evidence
- **Ticketing**: Issue tracking integration
- **Security**: SIEM event forwarding
- **Access Control**: Door/gate systems
- **Webhook**: Inbound/outbound events
- **Automation**: Workflow triggers

## Each Connector Provides
- Tool schemas (name, description, input/output)
- Configuration form
- Health check endpoint
- Scoped permissions
- Audit trail
- Enable/disable toggle
- Test connection
- Error count and logs

## Implementation Status
- ✅ Registry and catalog defined
- ✅ Tool schemas modeled
- ✅ UI for browsing and managing connectors
- 🔲 Runtime execution engine
- 🔲 Permission guards
- 🔲 Retry/timeout policies
