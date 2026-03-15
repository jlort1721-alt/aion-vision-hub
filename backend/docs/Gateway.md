# Edge Gateway

The Edge Gateway (`@aion/edge-gateway`) is the on-premise component of AION Vision Hub. It runs at each physical site, directly communicating with IP cameras and forwarding events, health data, and stream metadata to the cloud Backend API.

---

## Table of Contents

- [Purpose and Deployment Model](#purpose-and-deployment-model)
- [Service Lifecycle](#service-lifecycle)
- [Service Reference](#service-reference)
- [API Endpoint Catalog](#api-endpoint-catalog)
- [Policy Engine](#policy-engine)
- [Local Cache Strategy](#local-cache-strategy)
- [Heartbeat and Health Reporting](#heartbeat-and-health-reporting)
- [Configuration](#configuration)

---

## Purpose and Deployment Model

The Edge Gateway serves as the bridge between the cloud platform and on-premise camera infrastructure. Each gateway is identified by a unique `GATEWAY_ID` and is associated with a `SITE_ID`.

**Key responsibilities:**

- Connect to and manage IP cameras using brand-specific adapters
- Discover cameras on the local network (SADP, DH-Discovery, WS-Discovery)
- Manage RTSP stream lifecycle and MediaMTX path registration
- Ingest camera events (motion, intrusion, tamper) and forward to the Backend API
- Provide PTZ control and playback access
- Encrypt and store device credentials locally
- Report health status and heartbeats to the cloud

**Deployment model:**

```
  +------- Site Network (192.168.x.x) -------+
  |                                           |
  |  +-------------+      +---------------+  |
  |  | Edge Gateway|----->| MediaMTX      |  |
  |  | :3100       |      | :8554 (RTSP)  |  |
  |  +------+------+      | :8889 (WebRTC)|  |
  |         |              | :8888 (HLS)   |  |
  |    +----+----+         +---------------+  |
  |    |    |    |                             |
  |  +--+ +--+ +--+                           |
  |  |C1| |C2| |C3|  (IP Cameras)             |
  |  +--+ +--+ +--+                           |
  +-------------------------------------------+
           |
      WAN / VPN
           |
  +--------+--------+
  |  Backend API     |
  |  (Cloud)         |
  +------------------+
```

---

## Service Lifecycle

When the gateway starts, services are initialized in the following order:

```
buildGateway()
  |
  |-- 1. Create Fastify instance with CORS, JWT, WebSocket plugins
  |
  |-- 2. Initialize services:
  |      DeviceManager       (manages adapter connections)
  |      StreamManager       (depends on DeviceManager)
  |      DiscoveryService    (depends on DeviceManager)
  |      EventIngestionService (depends on DeviceManager)
  |      PlaybackManager     (depends on DeviceManager)
  |      HealthMonitor       (depends on DeviceManager + StreamManager)
  |      CredentialVault     (standalone)
  |
  |-- 3. Register API routes
  |
  |-- 4. onReady hook:
  |      HealthMonitor.start()      (begins periodic health checks)
  |      EventIngestionService.start() (begins event polling)
  |
  |-- 5. onClose hook:
  |      HealthMonitor.stop()
  |      EventIngestionService.stop()
  |      DeviceManager.disconnectAll()
```

---

## Service Reference

### 1. DeviceManager

**File:** `services/device-manager.ts`

Manages the lifecycle of device connections using the `AdapterFactory` from `@aion/device-adapters`.

| Method               | Description                                        |
|---------------------|----------------------------------------------------|
| `connect(config)`    | Create adapter, establish connection, track state  |
| `disconnect(id)`     | Cleanly disconnect and remove device               |
| `disconnectAll()`    | Disconnect all devices (used during shutdown)      |
| `testConnection(cfg)`| Test device reachability without persisting         |
| `getAdapter(id)`     | Get the adapter instance for a connected device    |
| `getDevice(id)`      | Get device connection metadata                     |
| `listDevices()`      | List all connected devices                         |
| `isConnected(id)`    | Check if a device is currently connected           |

### 2. StreamManager

**File:** `services/stream-manager.ts`

Manages stream registration, policy-based stream selection, MediaMTX integration, and signed URL generation.

| Method                      | Description                                          |
|----------------------------|------------------------------------------------------|
| `registerStreams(id, profiles)` | Register stream profiles and create MediaMTX paths |
| `getRegistration(id)`      | Get stream registration for a device                 |
| `listRegistrations()`      | List all active stream registrations                 |
| `selectStream(id, context)`| Select optimal stream based on policy context        |
| `getStreamUrl(id, type)`   | Get raw stream URL by type                           |
| `generateSignedUrl(id, type, proto)` | Generate time-limited signed access URL   |
| `transitionState(id, state, reason)` | Enforce state machine transitions         |
| `unregister(id)`           | Remove stream registration                           |
| `updatePolicy(updates)`    | Update stream selection policy                       |

### 3. DiscoveryService

**File:** `services/discovery.ts`

Network scanning for camera discovery using brand-specific protocols.

| Method                          | Description                                    |
|--------------------------------|------------------------------------------------|
| `discover(range, timeout)`     | Scan network range for cameras                 |
| `identify(ip, port)`          | Identify brand and model of a specific device  |

Discovery protocols used:
- **Hikvision:** SADP (Search Active Devices Protocol) on UDP port 37020
- **Dahua:** DH-Discovery protocol
- **ONVIF:** WS-Discovery (Web Services Dynamic Discovery)

### 4. EventIngestionService

**File:** `services/event-ingestion.ts`

Subscribes to camera event streams and forwards events to the Backend API.

| Method            | Description                                        |
|------------------|----------------------------------------------------|
| `start()`        | Begin polling/subscribing to all connected devices |
| `stop()`         | Stop all event subscriptions                       |

Supported event types:
- `motion_detected`, `line_crossing`, `intrusion`
- `face_detected`, `plate_detected`
- `tamper`, `video_loss`, `storage_full`
- `network_error`, `io_alarm`, `temperature`, `audio_detected`

### 5. PlaybackManager

**File:** `services/playback-manager.ts`

Manages recorded video search, playback sessions, and clip export.

| Method                     | Description                                    |
|---------------------------|------------------------------------------------|
| `search(params)`          | Search recorded segments by time range         |
| `startPlayback(params)`   | Start a playback session, return stream URL    |
| `stopPlayback(sessionId)` | Stop an active playback session                |
| `exportClip(params)`      | Start a clip export job                        |
| `getSnapshot(id, ts, ch)` | Get a snapshot at a specific timestamp          |

### 6. HealthMonitor

**File:** `services/health-monitor.ts`

Periodic health checking with automatic reconnection on persistent failures.

| Method                | Description                                         |
|----------------------|-----------------------------------------------------|
| `start()`            | Begin periodic health checks (configurable interval)|
| `stop()`             | Stop health monitoring                               |
| `checkDevice(id)`    | Perform single health check on a device              |
| `getHealth(id)`      | Get last known health status for a device            |
| `getAllHealth()`      | Get health status for all devices                    |

**Auto-reconnect behavior:**
1. After 3 consecutive failures: stream state transitions to `degraded`
2. After `DEVICE_RECONNECT_MAX_ATTEMPTS` (default 5) failures: triggers auto-reconnect
3. Reconnect uses exponential backoff with jitter (via `withRetry`)
4. If reconnect exhausted: stream state transitions to `failed`

### 7. CredentialVault

**File:** `services/credential-vault.ts`

Encrypted in-memory credential store for device authentication.

| Method                           | Description                              |
|---------------------------------|------------------------------------------|
| `store(deviceId, username, pwd)` | Encrypt and store, return reference ID   |
| `retrieve(ref)`                 | Decrypt and return credentials           |
| `revoke(ref)`                   | Delete credentials from vault            |
| `has(ref)`                      | Check if reference exists                |

Encryption: AES-256-GCM with a key derived from `CREDENTIAL_ENCRYPTION_KEY` or `JWT_SECRET`.

---

## API Endpoint Catalog

All endpoints (except `/health`) require a valid JWT Bearer token.

### Devices

| Method   | Path                        | Description                          |
|---------|----------------------------|--------------------------------------|
| `POST`  | `/devices/connect`          | Connect to a device via adapter      |
| `POST`  | `/devices/test`             | Test device connectivity             |
| `GET`   | `/devices`                  | List all connected devices           |
| `GET`   | `/devices/:id/capabilities` | Get device capabilities              |
| `DELETE`| `/devices/:id`              | Disconnect a device                  |

### Streams

| Method   | Path                        | Description                          |
|---------|----------------------------|--------------------------------------|
| `GET`   | `/streams/:deviceId`        | Get stream profiles for a device     |
| `POST`  | `/streams/register`         | Register streams and create MTX paths|
| `GET`   | `/streams/:deviceId/url`    | Get signed stream URL                |
| `GET`   | `/streams/:deviceId/state`  | Get stream state                     |

### Discovery

| Method   | Path                        | Description                          |
|---------|----------------------------|--------------------------------------|
| `POST`  | `/discovery/scan`           | Scan network range for devices       |
| `POST`  | `/discovery/identify`       | Identify a specific device           |

### Playback

| Method   | Path                            | Description                      |
|---------|--------------------------------|----------------------------------|
| `POST`  | `/playback/:deviceId/search`    | Search recorded segments         |
| `POST`  | `/playback/:deviceId/start`     | Start a playback session         |
| `POST`  | `/playback/:sessionId/stop`     | Stop a playback session          |
| `POST`  | `/playback/:deviceId/export`    | Start clip export                |
| `GET`   | `/playback/:deviceId/snapshot`  | Get a snapshot image             |

### PTZ

| Method   | Path                            | Description                      |
|---------|--------------------------------|----------------------------------|
| `POST`  | `/ptz/:deviceId/command`        | Send PTZ command (move, zoom)    |
| `GET`   | `/ptz/:deviceId/presets`        | List PTZ presets                 |
| `POST`  | `/ptz/:deviceId/presets`        | Set a PTZ preset                 |

### Events

| Method   | Path                            | Description                      |
|---------|--------------------------------|----------------------------------|
| `GET`   | `/events/:deviceId/types`       | List supported event types       |
| `POST`  | `/events/:deviceId/subscribe`   | Subscribe to device events       |

### Health

| Method   | Path                        | Description                          |
|---------|----------------------------|--------------------------------------|
| `GET`   | `/health`                   | Gateway status, uptime, device count |
| `GET`   | `/health/ready`             | Readiness probe                      |
| `GET`   | `/health/devices`           | Health status for all devices        |

---

## Policy Engine

The gateway uses a layered policy engine to manage device communication reliability.

### Retry Policy

Pre-configured retry policies with exponential backoff:

| Policy                | Max Attempts | Base Delay | Max Delay | Backoff | Jitter |
|----------------------|-------------|-----------|-----------|---------|--------|
| Device Connect       | 3           | 1,000 ms  | 10,000 ms | 2x      | Yes    |
| Health Check         | 2           | 500 ms    | 3,000 ms  | 2x      | No     |
| Event Forward        | 5           | 2,000 ms  | 60,000 ms | 3x      | Yes    |

### Timeout Policy

Per-operation timeouts enforce maximum wait times:

| Operation              | Default Timeout |
|-----------------------|-----------------|
| Device connect         | 5,000 ms        |
| Health check           | 3,000 ms        |
| Discovery scan         | 10,000 ms       |
| PTZ command            | 5,000 ms        |
| Playback operations    | 10,000 ms       |
| Stream registration    | 5,000 ms        |

### Stream Selection Policy

Context-based stream type selection with fallback:

| Context      | Preferred Stream | Fallback Order          |
|-------------|-----------------|--------------------------|
| Mosaic view  | `sub`           | `sub` -> `main` -> `third` |
| Fullscreen   | `main`          | `sub` -> `main` -> `third` |
| Playback     | `main`          | `sub` -> `main` -> `third` |
| Export       | `main`          | `sub` -> `main` -> `third` |
| Thumbnail    | `sub`           | `sub` -> `main` -> `third` |

Concurrency limits:
- Max concurrent main streams: **4**
- Max concurrent sub streams: **32**

### Reconnect Policy

Per-device reconnection with exponential backoff:

- Maximum attempts: `DEVICE_RECONNECT_MAX_ATTEMPTS` (default: 5)
- Base delay: `DEVICE_RECONNECT_BASE_DELAY_MS` (default: 2,000 ms)
- Backoff: exponential with cap at 60 seconds
- Jitter: random 0-30% of calculated delay
- States: `idle` -> `waiting` -> `reconnecting` -> (success: `idle` | failure: `exhausted`)

---

## Local Cache Strategy

The gateway uses an LRU (Least Recently Used) cache with TTL expiry for frequently accessed data:

| Parameter        | Default       | Environment Variable     |
|-----------------|---------------|--------------------------|
| Max entries     | 500           | `CACHE_MAX_ENTRIES`      |
| TTL             | 300,000 ms (5 min) | `CACHE_TTL_MS`     |

**Cached data types:**
- Device capabilities (avoids repeated ISAPI/CGI calls)
- Stream profiles (cached after first retrieval)
- Discovery results (cached per scan)

**Eviction:**
- LRU: When cache reaches capacity, the least recently used entry is evicted
- TTL: Entries expire after the configured TTL
- Manual: `prune()` method removes all expired entries

---

## Heartbeat and Health Reporting

The gateway sends periodic heartbeats to the Backend API:

```
Gateway -> Backend API
  POST /gateways/:id/heartbeat
  {
    "gatewayId": "gw-local-01",
    "status": "online",
    "connectedDevices": 12,
    "activeStreams": 8,
    "version": "1.0.0",
    "uptime": 86400,
    "localIp": "192.168.1.100",
    "capabilities": ["hikvision", "dahua", "onvif"],
    "timestamp": "2026-03-08T10:00:00.000Z"
  }
```

| Parameter            | Default       | Environment Variable          |
|---------------------|---------------|-------------------------------|
| Heartbeat interval  | 60,000 ms     | `HEARTBEAT_INTERVAL_MS`       |
| Health check interval | 30,000 ms   | `DEVICE_PING_INTERVAL_MS`     |

---

## Configuration

All gateway configuration is defined through environment variables validated by Zod at startup. See the complete reference in [Deployment.md](Deployment.md#edge-gateway-environment-variables).

Key configuration categories:
- **Server:** `PORT`, `HOST`, `NODE_ENV`, `GATEWAY_ID`, `SITE_ID`
- **Backend API:** `BACKEND_API_URL`, `BACKEND_API_KEY`
- **JWT:** `JWT_SECRET` (must match Backend API)
- **MediaMTX:** `MEDIAMTX_API_URL`, `MEDIAMTX_RTSP_PORT`
- **Device Timeouts:** connect, ping interval, reconnect attempts, reconnect delay
- **Discovery:** `DISCOVERY_NETWORK_RANGE`, `DISCOVERY_TIMEOUT_MS`
- **Cache:** `CACHE_MAX_ENTRIES`, `CACHE_TTL_MS`
- **Security:** `CREDENTIAL_ENCRYPTION_KEY`
