# AION Gateway — Runtime Architecture

**Updated**: Post-runtime rewrite
**Location**: `gateway/` (standalone Fastify + TypeScript service)
**Port**: 3100 (configurable)
**Entry point**: `gateway/src/index.ts`

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  AION Edge Gateway (Node.js / Fastify)              Port 3100  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │  DeviceManager   │  │  StreamManager   │  │ PlaybackManager│ │
│  │  ┌─────────────┐ │  │  MediaMTX REST   │  │  Recording     │ │
│  │  │ Hikvision   │ │  │  v3 integration  │  │  Search +      │ │
│  │  │ ISAPI+Digest│ │  │  Health checks   │  │  Playback RTSP │ │
│  │  ├─────────────┤ │  └─────────────────┘  └────────────────┘ │
│  │  │ Dahua       │ │                                           │
│  │  │ CGI+Digest  │ │  ┌─────────────────┐  ┌────────────────┐ │
│  │  ├─────────────┤ │  │ EventIngestion   │  │ EventListener  │ │
│  │  │ ONVIF       │ │  │  Normalize+Batch │  │  alertStream   │ │
│  │  │ onvif@0.7   │ │  │  Dedupe+Flush    │  │  eventManager  │ │
│  │  └─────────────┘ │  │  →Supabase       │  │  PullPoint     │ │
│  └─────────────────┘  └─────────────────┘  └────────────────┘ │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │ ReconnectMgr    │  │ DiscoveryService │  │ CredentialStore│ │
│  │  Exp. Backoff   │  │  ONVIF WS-Disc.  │  │  AES-256-GCM  │ │
│  │  + Jitter       │  │  + Brand probing │  │  (at-rest)     │ │
│  └─────────────────┘  └─────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## What Changed (Runtime Rewrite)

| Area | Before | After |
|------|--------|-------|
| **Auth** | Basic Auth (broken on real hardware) | HTTP Digest Auth (RFC 2617) |
| **Capabilities** | Hardcoded per-brand | Queried from device at connect time |
| **Stream profiles** | Hardcoded resolution/codec | Queried from ISAPI/CGI/ONVIF |
| **PTZ (Dahua)** | Not implemented | Full CGI PTZ with presets |
| **Events** | Ingestion service only, nothing calls it | Event listeners per-device (alertStream, eventManager, PullPoint) |
| **Playback** | Not implemented | Recording search + playback RTSP via MediaMTX |
| **MediaMTX** | Fire-and-forget, brittle URL math | Health checks, proper URL building, stream monitoring |
| **Credentials** | Plaintext in memory | AES-256-GCM encryption utility available |
| **Buffer mgmt** | Unbounded re-buffer on error | Max buffer size, dedupe, retry limit with drop |
| **Health reports** | Basic online/offline | CPU, memory, storage from device, lastChecked timestamp |

## Service Details

### DeviceManager (`services/device-manager.ts`)
- Central registry: `Map<deviceId, ManagedDevice>`
- Routes to adapter by brand (hikvision/dahua/onvif)
- Exposes PTZ, stream, health operations via deviceId

### StreamManager (`services/stream-manager.ts`)
- MediaMTX REST v3: `POST /v3/config/paths/add/{name}`
- Startup MediaMTX health check (non-blocking)
- Periodic health: verify paths still exist in MediaMTX
- Proper URL construction using configured ports

### PlaybackManager (`services/playback-manager.ts`)
- `searchRecordings()` → adapter-specific search
- `startPlayback()` → register playback RTSP in MediaMTX
- Brand-specific playback RTSP URLs:
  - Hikvision: `/Streaming/tracks/{ch}01?starttime=...&endtime=...`
  - Dahua: `/cam/playback?channel={ch}&starttime=...&endtime=...`
  - ONVIF: `/onvif/replay?starttime=...`

### EventListenerService (`services/event-listener.ts`)
- Auto-attaches on device connect, detaches on disconnect
- Routes events through adapter-specific parsers to EventIngestionService
- Hikvision: polls `/ISAPI/Event/notification/alertStream`
- Dahua: polls `/cgi-bin/eventManager.cgi?action=attach&codes=[All]`
- ONVIF: `cam.on('event')` PullPoint subscription

### EventIngestionService (`services/event-ingestion.ts`)
- Deduplication: same type+device within 1s → collapse
- Buffer cap: `EVENT_BUFFER_MAX_SIZE` (default 500)
- Retry: max 3 flush retries, then drop to prevent memory leak
- Extended event type maps (PIR, storage, network events)

### ReconnectManager (`services/reconnect-manager.ts`)
- Configurable via env: `RECONNECT_MAX_ATTEMPTS`, `RECONNECT_BASE_DELAY_MS`, `RECONNECT_MAX_DELAY_MS`
- Jitter: 10-30% random to prevent thundering herd

## Adapter Implementations

### Hikvision (`adapters/hikvision/adapter.ts`)
Implements: `IDeviceAdapter`, `IStreamAdapter`, `IDiscoveryAdapter`, `IHealthAdapter`, `IPTZAdapter`, `IPlaybackAdapter`, `IEventAdapter`

| Feature | Implementation | Status |
|---------|---------------|--------|
| Connect | Digest Auth → `/ISAPI/System/deviceInfo` | Real |
| Capabilities | Query `/ISAPI/PTZCtrl`, `/ISAPI/Smart`, `/ISAPI/System/Audio`, etc. | Real |
| Stream profiles | Parse `/ISAPI/Streaming/channels` XML | Real |
| RTSP URLs | `rtsp://...@ip:554/Streaming/Channels/{ch}0{type}` | Real |
| PTZ | `PUT /ISAPI/PTZCtrl/channels/{ch}/continuous` | Real |
| PTZ Presets | `GET/PUT /ISAPI/PTZCtrl/channels/{ch}/presets` | Real |
| Health | `/ISAPI/System/status` (CPU, memory), `/ISAPI/ContentMgmt/Storage` | Real |
| Playback search | `POST /ISAPI/ContentMgmt/search` with XML body | Real |
| Event listener | Poll `/ISAPI/Event/notification/alertStream` (2s interval) | Partial (see stubs) |
| SADP discovery | — | Stub |

### Dahua (`adapters/dahua/adapter.ts`)
Implements: `IDeviceAdapter`, `IStreamAdapter`, `IDiscoveryAdapter`, `IHealthAdapter`, `IPTZAdapter`, `IPlaybackAdapter`, `IEventAdapter`

| Feature | Implementation | Status |
|---------|---------------|--------|
| Connect | Digest Auth → `/cgi-bin/magicBox.cgi?action=getSystemInfo` | Real |
| Capabilities | Query PTZ protocol, AudioDetect, VideoAnalyseRule, storage | Real |
| Stream profiles | Parse `/cgi-bin/configManager.cgi?action=getConfig&name=Encode` | Real |
| RTSP URLs | `rtsp://...@ip:554/cam/realmonitor?channel={ch}&subtype={type}` | Real |
| PTZ | `/cgi-bin/ptz.cgi?action=start&code={Code}` | Real |
| PTZ Presets | `/cgi-bin/ptz.cgi?action=getPresets` | Real |
| Health | magicBox getSystemInfo + getMemoryInfo + getCPUUsage | Real |
| Playback search | `mediaFileFind.cgi` 3-step workflow (create→find→next) | Real |
| Event listener | Poll `/cgi-bin/eventManager.cgi?action=attach&codes=[All]` | Partial |
| DHDiscover | — | Stub |

### ONVIF (`adapters/onvif/adapter.ts`)
Implements: all 7 interfaces

| Feature | Implementation | Status |
|---------|---------------|--------|
| Connect | `onvif` npm package Cam constructor | Real |
| Capabilities | Read from live cam object (ptzService, analyticsService, etc.) | Real |
| Stream profiles | `getProfiles()` + `getStreamUri()` per profile | Real |
| PTZ | `continuousMove()`, `stop()`, `gotoPreset()` | Real |
| Discovery | `Discovery.probe()` with callback | Real |
| Health | `getDeviceInformation()` | Real |
| Playback | Profile G `getRecordings()` (rarely supported by devices) | Partial |
| Events | `cam.on('event')` PullPoint | Partial |

## Configuration Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3100 | Gateway HTTP port |
| `SUPABASE_URL` | required | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | required | Supabase service role key |
| `JWT_SECRET` | required (32+ chars) | JWT verification secret |
| `CREDENTIAL_ENCRYPTION_KEY` | weak default | AES-256 key for credential encryption |
| `CORS_ORIGINS` | http://localhost:5173 | Allowed CORS origins |
| `MEDIAMTX_API_URL` | http://localhost:9997 | MediaMTX REST API |
| `MEDIAMTX_WEBRTC_PORT` | 8889 | MediaMTX WebRTC port |
| `MEDIAMTX_HLS_PORT` | 8888 | MediaMTX HLS port |
| `DEVICE_CONNECT_TIMEOUT_MS` | 5000 | Device connection timeout |
| `DEVICE_REQUEST_TIMEOUT_MS` | 8000 | Per-request timeout |
| `DEVICE_PING_INTERVAL_MS` | 30000 | Health check interval |
| `DISCOVERY_TIMEOUT_MS` | 10000 | Discovery probe timeout |
| `EVENT_FLUSH_INTERVAL_MS` | 5000 | Event batch flush interval |
| `EVENT_BUFFER_MAX_SIZE` | 500 | Max buffered events |
| `RECONNECT_MAX_ATTEMPTS` | 10 | Max reconnection attempts |
| `RECONNECT_BASE_DELAY_MS` | 5000 | Initial backoff delay |
| `RECONNECT_MAX_DELAY_MS` | 300000 | Maximum backoff delay (5 min) |
| `LOG_LEVEL` | info | Pino log level |

## API Surface

### Health (no auth)
- `GET /health` — liveness
- `GET /health/ready` — readiness with all component status
- `GET /health/devices` — per-device health

### Devices
- `GET /api/devices` — list connected
- `POST /api/devices/connect` — connect (auto-attaches event listener)
- `POST /api/devices/:id/disconnect` — disconnect
- `POST /api/devices/test` — test connection
- `GET /api/devices/:id/health`
- `GET /api/devices/:id/streams`
- `GET /api/devices/:id/capabilities`

### Streams
- `POST /api/streams/start` → `{ webrtcUrl, hlsUrl }`
- `POST /api/streams/stop`
- `POST /api/streams/stop-all`
- `GET /api/streams`

### PTZ
- `POST /api/ptz/command` — move/zoom/preset/stop
- `GET /api/ptz/:deviceId/presets`
- `POST /api/ptz/preset`

### Playback
- `POST /api/playback/search` — search recordings
- `POST /api/playback/start` → `{ webrtcUrl, hlsUrl }`
- `POST /api/playback/stop`
- `GET /api/playback/sessions`

### Discovery
- `POST /api/discovery/scan` — network scan
- `POST /api/discovery/identify` — identify single device
