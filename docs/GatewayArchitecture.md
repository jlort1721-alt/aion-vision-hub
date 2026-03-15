# AION Vision Hub — Gateway Architecture

## Overview

The Edge Gateway is a conceptual on-premise component that bridges the cloud platform with physical surveillance devices. It runs at each site and communicates with AION Vision Hub via secure API.

## Responsibilities

1. **Device Discovery** — ONVIF WS-Discovery, subnet scanning
2. **Connection Validation** — Credential testing, protocol negotiation
3. **Credential Management** — Encrypted storage, rotation support
4. **Session Management** — Keep-alive, reconnection with backoff
5. **Capability Query** — Device profiles, supported features
6. **Stream Registration** — Main/sub stream URLs, codec/resolution metadata
7. **Video Bridge** — RTSP→WebRTC/HLS transcoding proxy
8. **Health Reporting** — Latency, uptime, error rates → cloud
9. **Event Forwarding** — Device alarms → platform events table
10. **Retry/Timeout Policy** — Configurable per device brand
11. **Offline Queue** — Buffer events when cloud is unreachable

## Communication Flow

```
[Devices] ←RTSP/ONVIF/ISAPI→ [Edge Gateway] ←HTTPS/WSS→ [AION Cloud]
                                     │
                                     ├── Device Adapter Layer
                                     ├── Stream Manager
                                     ├── Event Listener
                                     └── Health Monitor
```

## Gateway Data Model

```typescript
interface Gateway {
  id: string;
  site_id: string;
  name: string;
  version: string;
  status: 'online' | 'offline' | 'degraded';
  last_heartbeat: string;
  devices_count: number;
  ip_address: string;
  config: GatewayConfig;
}
```

## Deployment

The gateway is designed to run as:
- Docker container on-premise
- Native service on Windows/Linux
- Embedded in NVR-class hardware

## Security

- mTLS between gateway and cloud
- Credentials never leave the gateway
- Stream URLs are signed with short-lived tokens
- Gateway authenticates via API key per tenant
