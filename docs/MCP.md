# AION Vision Hub — MCP Strategy

## Overview

Model Context Protocol (MCP) provides a standardized way to connect AI models with external tools and data sources. AION uses MCP connectors to extend platform capabilities.

## Connector Registry

The MCP connector catalog (`src/services/mcp-registry.ts`) defines available connector types:

| Connector | Category | Tools |
|-----------|----------|-------|
| ONVIF Orchestration | Device | discover_devices, get_device_info |
| Email Notifications | Notification | send_alert |
| Webhooks | Webhook | send_webhook |
| Ticketing System | Ticketing | create_ticket |
| Cloud Storage | Storage | upload_file |
| Access Control | Access Control | grant_access |
| SIEM Integration | Security | forward_event |
| WhatsApp Business | Messaging | send_message |

## Connector Lifecycle

```
CATALOG → CONFIGURE → CONNECT → HEALTHY → MONITOR
                                    ↓
                              ERROR → RETRY → RECONNECT
```

## Data Model

```typescript
interface MCPConnector {
  id: string;
  tenant_id: string;
  name: string;
  type: string;           // matches catalog type
  status: MCPConnectorStatus;
  endpoint?: string;
  scopes: string[];       // granted permissions
  health: HealthStatus;
  error_count: number;
  config: Record<string, unknown>;
}
```

## Permissions (Scopes)

Each connector requires specific scopes:
- `device.read` / `device.write` / `device.discover`
- `notification.send`
- `webhook.send` / `webhook.receive`
- `ticket.read` / `ticket.write`
- `storage.read` / `storage.write`
- `event.forward`
- `message.send`

## Health Monitoring

- Periodic health checks stored in `last_check`
- Error counting with circuit breaker pattern
- Status transitions: connected → error → disconnected
- Logs accessible per connector

## Security

- Connector credentials referenced by ID (never stored in frontend)
- API keys in Supabase secrets
- Scopes enforce least-privilege access
- Tenant isolation on all connector data
