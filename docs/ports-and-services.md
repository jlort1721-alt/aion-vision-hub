# AION Platform -- Ports and Services Reference

> Version 1.0 -- March 2026
> Canonical source of truth for every port used in AION (Clave Seguridad)

---

## 1. External Ports (Published Through Reverse Proxy)

These ports are reachable from the WAN or client VLAN. In production, Caddy
terminates TLS on 443 and proxies to internal services.

| Port | Protocol | Service | Description |
|------|----------|---------|-------------|
| 443 | TCP | Caddy (HTTPS) | TLS-terminated entry point. Routes `/api/*` to backend-api, `/gateway/*` to edge-gateway, `/webrtc/*` and `/hls/*` to MediaMTX, everything else to frontend SPA. |
| 80 | TCP | Caddy (HTTP) | Automatic redirect to 443. Never serves content in production. |
| 8554 | TCP | MediaMTX RTSP | RTSP ingestion endpoint. Cameras push or gateway pulls RTSP streams here. Configurable via `MEDIAMTX_RTSP_PORT`. |
| 8889 | TCP | MediaMTX WebRTC | WebRTC signaling and media. Proxied through Caddy at `/webrtc/*` in production. |
| 8888 | TCP | MediaMTX HLS | HLS segment delivery. Proxied through Caddy at `/hls/*` in production. |
| 5080 | UDP/TCP | SIP Proxy | SIP signaling for IP intercoms (Fanvil, Asterisk). Configurable via `SIP_PORT`. |
| 9500 | TCP | Dahua Auto-Register | Dahua devices in auto-register mode connect here. Used exclusively for Dahua device onboarding. |

---

## 2. Internal Ports (Docker Network Only)

These ports are bound to the `aion-net` Docker bridge network. They are **not**
published to the host in production. External access goes through Caddy.

| Port | Service | Container | Description |
|------|---------|-----------|-------------|
| 3000 | Backend API | `backend-api` | Fastify REST API, WebSocket, health endpoint. Caddy proxies `/api/*` and `/ws` here. |
| 3100 | Edge Gateway | `edge-gateway` | Device management, ONVIF discovery, stream proxy, PTZ, playback, event ingestion. Caddy proxies `/gateway/*` here. |
| 5432 | PostgreSQL | `postgres` | PostgreSQL 16 with pgvector. 22 schema files, 15+ migrations. |
| 6379 | Redis | `redis` | Session cache, pub/sub, rate-limit counters. Optional -- backend falls back to in-memory. |
| 9997 | MediaMTX API | `mediamtx` | REST API for path management, source listing, metrics. Used by edge-gateway to register/remove streams. |
| 9100 | Media Live (reserved) | -- | Reserved for future dedicated live transcoding service. |
| 9320 | Media Playback | -- | Playback proxy port for NVR recording retrieval. Edge gateway proxies device playback through this port. |
| 9900 | Metadata Service (reserved) | -- | Reserved for AI metadata processing service (AcuSense, WizSense event normalization). |

---

## 3. Device-Side Ports (Camera / NVR / Intercom)

These are the ports that physical devices listen on. The edge gateway connects
**to** these ports on the camera VLAN.

| Port | Protocol | Service | Used By |
|------|----------|---------|---------|
| 554 | TCP | RTSP | All cameras and NVRs (Hikvision, Dahua, ONVIF) |
| 80 | TCP | HTTP / ISAPI / CGI | Device web UI, ONVIF service, Hikvision ISAPI, Dahua HTTP API |
| 443 | TCP | HTTPS | Secure device administration |
| 8000 | TCP | Hikvision SDK | Proprietary Hikvision device SDK port |
| 37777 | TCP | Dahua SDK | Proprietary Dahua NetSDK port |
| 8080 | TCP | ONVIF (alternate) | Some ONVIF devices use 8080 instead of 80 |
| 5060 | UDP/TCP | SIP | Standard SIP signaling on intercom devices (Fanvil) |

---

## 4. Per-Vendor Default Ports

### 4.1 Hikvision

| Port | Service | Notes |
|------|---------|-------|
| 80 | HTTP / ISAPI | Web UI and RESTful ISAPI interface |
| 443 | HTTPS | Secure ISAPI |
| 554 | RTSP | Stream URLs: `/Streaming/Channels/101` (main), `/102` (sub) |
| 8000 | Device SDK | Proprietary binary protocol for advanced operations |

Preferred onboarding modes: `ip`, `domain`, `p2p`, `serial`

### 4.2 Dahua

| Port | Service | Notes |
|------|---------|-------|
| 80 | HTTP / CGI | Web UI and JSON HTTP API |
| 443 | HTTPS | Secure API access |
| 554 | RTSP | Stream URLs: `/cam/realmonitor?channel=1&subtype=0` (main), `&subtype=1` (sub) |
| 37777 | NetSDK | Proprietary binary protocol |
| 9500 | Auto-Register | Devices dial home to this port on the AION server for zero-touch onboarding |

Preferred onboarding modes: `auto_register`, `ip`, `domain`, `p2p`

### 4.3 ONVIF Generic

| Port | Service | Notes |
|------|---------|-------|
| 80 | ONVIF Service | WS-Discovery, GetCapabilities, GetStreamUri |
| 554 | RTSP | Stream URI obtained dynamically via ONVIF GetStreamUri |
| 8080 | ONVIF (alternate) | Some vendors (Axis, Hanwha) use 8080 by default |

Preferred onboarding modes: `ip`, `domain`

---

## 5. Firewall Rules Recommendation

### 5.1 WAN / Internet-Facing (ingress to AION server)

| Rule | Source | Destination | Port | Protocol | Action |
|------|--------|-------------|------|----------|--------|
| HTTPS | Any | AION Server | 443 | TCP | ALLOW |
| HTTP redirect | Any | AION Server | 80 | TCP | ALLOW |
| Block all other | Any | AION Server | * | * | DENY |

### 5.2 Camera VLAN to AION Server (ingress)

| Rule | Source | Destination | Port | Protocol | Action |
|------|--------|-------------|------|----------|--------|
| RTSP push | Camera VLAN | AION Server | 8554 | TCP | ALLOW |
| Dahua auto-register | Camera VLAN | AION Server | 9500 | TCP | ALLOW |
| SIP registration | Intercom VLAN | AION Server | 5080 | UDP+TCP | ALLOW |
| RTP media | Intercom VLAN | AION Server | 20000-22000 | UDP | ALLOW |
| Block all other | Camera VLAN | AION Server | * | * | DENY |

### 5.3 AION Server to Camera VLAN (egress)

| Rule | Source | Destination | Port | Protocol | Action |
|------|--------|-------------|------|----------|--------|
| RTSP pull | AION Server | Camera VLAN | 554 | TCP | ALLOW |
| HTTP/ISAPI | AION Server | Camera VLAN | 80 | TCP | ALLOW |
| HTTPS | AION Server | Camera VLAN | 443 | TCP | ALLOW |
| Hikvision SDK | AION Server | Camera VLAN | 8000 | TCP | ALLOW |
| Dahua SDK | AION Server | Camera VLAN | 37777 | TCP | ALLOW |
| ONVIF alt | AION Server | Camera VLAN | 8080 | TCP | ALLOW |
| SIP to intercom | AION Server | Intercom VLAN | 5060 | UDP+TCP | ALLOW |

### 5.4 Internal Docker Network

No host-level firewall rules needed. All inter-container communication happens
on the `aion-net` bridge network. Containers reference each other by service
name (e.g. `postgres:5432`, `redis:6379`, `mediamtx:9997`).

---

## 6. DSS Pro Equivalent Mapping

This table maps Dahua DSS Pro (Digital Surveillance System Professional) ports
to their AION platform equivalents, for organizations migrating from DSS Pro.

| DSS Pro Port | DSS Pro Service | AION Port | AION Service | Notes |
|-------------|-----------------|-----------|--------------|-------|
| 443 | DSS Web HTTPS | 443 | Caddy HTTPS | 1:1 replacement. Caddy handles TLS + routing. |
| 80 | DSS Web HTTP | 80 | Caddy HTTP | Redirect to 443 only. |
| 9000 | DSS Manager | 3000 | Backend API | Platform management API replaces DSS Manager. |
| 9100 | DSS Media Live | 9100 (reserved) | Media Live | Reserved. Currently handled by MediaMTX + edge-gateway. |
| 9200 | DSS Auth | 3000 | Backend API (JWT) | Authentication integrated into backend API. No separate auth service. |
| 9300 | DSS Database | 5432 | PostgreSQL | Standard PostgreSQL replaces proprietary DSS DB. |
| 9320 | DSS Media Playback | 9320 | Media Playback | Playback proxy through edge-gateway. Same port for compatibility. |
| 9500 | DSS Auto Register | 9500 | Dahua Auto-Register | Identical port. Dahua devices already configured for 9500 work without change. |
| 9900 | DSS Metadata | 9900 (reserved) | Metadata Service | Reserved for AI event processing. |
| 33000 | DSS RTSP | 8554 | MediaMTX RTSP | Different port. Update device configs if pushing RTSP. |
| 33001 | DSS RTP | 20000-22000 | RTP Range | SIP/intercom RTP media range. |
| 7660 | DSS Cluster | -- | -- | Not applicable. AION uses container orchestration instead. |
| 10000 | DSS Alarm | 3000 | Backend API (events) | Alarm/event ingestion handled by backend API `/api/events`. |
| 18000 | DSS CMS | 3100 | Edge Gateway | Device management and central management via gateway. |

**Migration note:** Devices that were connected to DSS Pro on port 9500
(auto-register) will connect to AION on the same port with zero reconfiguration.
RTSP sources configured for DSS port 33000 must be updated to 8554.

---

## 7. Environment Variable Reference

Ports configurable via environment variables:

| Variable | Default | Service | File |
|----------|---------|---------|------|
| `PORT` | 3000 | Backend API listen port | `backend-api/src/config/env.ts` |
| `MEDIAMTX_RTSP_PORT` | 8554 | RTSP ingestion port | `edge-gateway/src/config/env.ts` |
| `SIP_PORT` | 5060 | SIP signaling port | `backend-api/src/config/env.ts` |
| `SIP_TRANSPORT` | udp | SIP transport protocol | `backend-api/src/config/env.ts` |
| `DISCOVERY_NETWORK_RANGE` | 192.168.1.0/24 | ONVIF discovery subnet | `edge-gateway/src/config/env.ts` |

---

## 8. Port Summary Diagram

```
                          INTERNET
                              |
                         [ Firewall ]
                              |
                    +---------+---------+
                    |   Port 443 (TLS)  |
                    |   Port 80 (redir) |
                    +---------+---------+
                              |
                    +---------+---------+
                    |      Caddy        |
                    |  Reverse Proxy    |
                    +--+--+--+--+--+---+
                       |  |  |  |  |
          +------------+  |  |  |  +-------------+
          |               |  |  |                 |
     /api/* /ws      /gateway/*  /webrtc/*   /hls/*    (static)
          |               |       |            |          |
    backend-api:3000  gw:3100  mtx:8889   mtx:8888    frontend
          |
    +-----+------+
    |             |
  pg:5432    redis:6379


    CAMERA VLAN                         AION SERVER
  +-------------+     RTSP pull       +-------------+
  | Camera/NVR  | <----- :554 ------ | Edge Gateway |
  |  :554 :80   |                     |    :3100     |
  |  :8000      | --- auto-reg ----> |    :9500     |
  |  :37777     |      :9500         |              |
  +-------------+                     +------+------+
                                             |
                                      MediaMTX :8554
                                        :8889 :8888
```
