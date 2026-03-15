# Streaming Architecture

This document describes the RTSP ingestion pipeline, MediaMTX integration, stream state machine, stream policy engine, signed URL generation, concurrent stream limits, and playback architecture.

---

## Table of Contents

- [Overview](#overview)
- [RTSP Ingestion Architecture](#rtsp-ingestion-architecture)
- [MediaMTX Integration](#mediamtx-integration)
- [Stream State Machine](#stream-state-machine)
- [Stream Policy Engine](#stream-policy-engine)
- [Signed URL Generation](#signed-url-generation)
- [Concurrent Stream Limits](#concurrent-stream-limits)
- [Playback Architecture](#playback-architecture)

---

## Overview

AION Vision Hub uses a mediated streaming architecture where camera RTSP streams are never exposed directly to the frontend. Instead, the Edge Gateway registers camera streams with MediaMTX, which acts as a protocol bridge, converting RTSP into WebRTC (for low-latency live viewing) or HLS (for compatibility).

```
  Camera                Edge Gateway           MediaMTX              Frontend
  (RTSP)                (Stream Manager)       (Protocol Bridge)     (Browser)
    |                       |                       |                    |
    |                       |-- Register path ----->|                    |
    |                       |   source=rtsp://cam   |                    |
    |                       |                       |                    |
    |<-- RTSP pull ---------|<----- Pull source ----|                    |
    |--- H.264/H.265 ------>|------>  Transcode --->|                    |
    |                       |                       |                    |
    |                       |   Signed URL -------->|----> WebRTC SDP -->|
    |                       |   (time-limited)      |<--- Video frames--|
    |                       |                       |---> Video frames ->|
```

---

## RTSP Ingestion Architecture

### Stream Profile Discovery

When a device is connected, the adapter returns its available stream profiles:

```typescript
interface StreamProfile {
  type: 'main' | 'sub' | 'third';   // Stream quality tier
  url: string;                       // RTSP URL with credentials
  codec: string;                     // H.264, H.265
  resolution: string;                // e.g., "2560x1440"
  fps: number;                       // Frames per second
  bitrate?: number;                  // Bitrate in kbps
  channel?: number;                  // Channel number (for NVRs)
}
```

### Per-Brand RTSP URL Patterns

| Brand      | Main Stream URL                                                        | Sub Stream URL                                                        |
|-----------|------------------------------------------------------------------------|-----------------------------------------------------------------------|
| Hikvision | `rtsp://{user}:{pass}@{ip}:554/Streaming/Channels/101`               | `rtsp://{user}:{pass}@{ip}:554/Streaming/Channels/102`               |
| Dahua     | `rtsp://{user}:{pass}@{ip}:554/cam/realmonitor?channel=1&subtype=0`  | `rtsp://{user}:{pass}@{ip}:554/cam/realmonitor?channel=1&subtype=1`  |
| ONVIF     | `rtsp://{user}:{pass}@{ip}:554/onvif/Profile_1/media.smp`           | `rtsp://{user}:{pass}@{ip}:554/onvif/Profile_2/media.smp`           |

### Stream Registration Flow

```
1. Device connected via adapter
2. StreamManager.registerStreams(deviceId, profiles)
   a. Create StreamRegistration entry
   b. For each profile:
      - POST to MediaMTX API: /v3/config/paths/add/{deviceId}-{type}
      - Body: { source: rtspUrl, sourceProtocol: "tcp" }
   c. Set initial state to "idle"
3. Stream is now accessible via MediaMTX
```

---

## MediaMTX Integration

MediaMTX is deployed as a sidecar container and acts as the RTSP-to-WebRTC/HLS bridge.

### MediaMTX Ports

| Port  | Protocol | Purpose                              |
|-------|----------|--------------------------------------|
| 8554  | RTSP     | Incoming RTSP stream reception       |
| 8888  | HTTP     | HLS stream output                    |
| 8889  | HTTP     | WebRTC signaling and streaming       |
| 9997  | HTTP     | MediaMTX management API              |

### Path Registration

When the StreamManager registers a stream, it creates a MediaMTX path via the API:

```
POST http://mediamtx:9997/v3/config/paths/add/{path}
Content-Type: application/json

{
  "source": "rtsp://admin:password@192.168.1.100:554/Streaming/Channels/102",
  "sourceProtocol": "tcp",
  "readTimeout": "10s",
  "writeTimeout": "10s"
}
```

Path naming convention: `{deviceId}-{streamType}`

Examples:
- `hik-192.168.1.100:80-main`
- `hik-192.168.1.100:80-sub`
- `dah-192.168.1.101:80-main`

### MediaMTX Path Configuration

```typescript
interface MediaMTXPathConfig {
  name: string;             // Path identifier
  source: string;           // RTSP source URL
  sourceProtocol?: string;  // "udp" | "tcp" | "automatic"
  readTimeout?: string;     // e.g., "10s"
  writeTimeout?: string;    // e.g., "10s"
  runOnReady?: string;      // Command to run when stream becomes ready
  runOnNotReady?: string;   // Command to run when stream stops
}
```

### MediaMTX Status Monitoring

```typescript
interface MediaMTXStatus {
  path: string;         // Path identifier
  ready: boolean;       // Whether source is connected
  readers: number;      // Active viewer count
  bytesReceived: number;// Total bytes from source
  bytesSent: number;    // Total bytes to viewers
}
```

---

## Stream State Machine

Each registered stream follows a strict state machine that governs its lifecycle. Invalid transitions are rejected by the `StreamManager.transitionState()` method.

### States

| State          | Description                                           |
|---------------|-------------------------------------------------------|
| `idle`        | Stream registered but not actively connected          |
| `connecting`  | Establishing connection to camera RTSP source         |
| `live`        | Stream is active and healthy                          |
| `degraded`    | Stream active but experiencing issues (packet loss)   |
| `reconnecting`| Attempting to re-establish lost connection             |
| `failed`      | Connection permanently failed (exhausted retries)     |
| `unauthorized`| Authentication rejected by camera                     |
| `unavailable` | Camera unreachable on network                         |

### Valid Transitions

```
                              +-------> unauthorized --+
                              |                        |
            +---> connecting --+-------> live <----+    |
            |         |       |          |    |    |    |
  idle <----+         |       +---> failed    |    |    |
    ^       |         |            ^   ^      |    |    |
    |       |         v            |   |      v    |    |
    |       |    unavailable ------+   |   degraded    |
    |       |         ^                |      |        |
    |       |         |                |      v        |
    +-------+---------+------------ reconnecting      |
            |                                          |
            +------------------------------------------+
```

### Transition Table

| From           | Allowed Transitions                          |
|---------------|----------------------------------------------|
| `idle`        | `connecting`                                 |
| `connecting`  | `live`, `failed`, `unauthorized`             |
| `live`        | `degraded`, `reconnecting`, `idle`           |
| `degraded`    | `live`, `reconnecting`, `failed`             |
| `reconnecting`| `live`, `failed`, `unavailable`              |
| `failed`      | `connecting`, `idle`                         |
| `unauthorized`| `connecting`, `idle`                         |
| `unavailable` | `connecting`, `idle`                         |

### Transition Triggers

| Trigger                          | Transition                          |
|---------------------------------|-------------------------------------|
| Health check passes             | `* -> live`                         |
| 3 consecutive health failures   | `live -> degraded`                  |
| Connection lost                 | `live/degraded -> reconnecting`     |
| Auto-reconnect triggered        | `degraded -> reconnecting`          |
| Reconnect successful            | `reconnecting -> live`              |
| Reconnect attempts exhausted    | `reconnecting -> failed`            |
| Camera unreachable              | `reconnecting -> unavailable`       |
| Invalid credentials             | `connecting -> unauthorized`        |
| Manual disconnect               | `* -> idle`                         |

---

## Stream Policy Engine

The `StreamPolicyEngine` determines which stream type (main, sub, third) to use based on the viewing context.

### Context-Based Selection

```typescript
type StreamContext = 'mosaic' | 'fullscreen' | 'playback' | 'export' | 'thumbnail';
```

| Context      | Preferred Type | Rationale                                    |
|-------------|---------------|----------------------------------------------|
| `mosaic`    | `sub`         | Lower bandwidth for multi-camera grid views  |
| `fullscreen`| `main`        | Full resolution for single camera viewing    |
| `playback`  | `main`        | Full quality for recorded footage review     |
| `export`    | `main`        | Maximum quality for evidence export          |
| `thumbnail` | `sub`         | Minimal bandwidth for preview thumbnails     |

### Fallback Chain

When the preferred stream type is unavailable, the engine tries alternatives in order:

```
sub -> main -> third
```

If the preferred type is `main` but the main stream concurrency limit is reached, it automatically falls back to `sub`.

### Policy Configuration

```typescript
interface StreamPolicyConfig {
  mosaic: StreamType;              // Default: 'sub'
  fullscreen: StreamType;          // Default: 'main'
  playback: StreamType;            // Default: 'main'
  export: StreamType;              // Default: 'main'
  thumbnail: StreamType;           // Default: 'sub'
  fallbackOrder: StreamType[];     // Default: ['sub', 'main', 'third']
  maxConcurrentMainStreams: number; // Default: 4
  maxConcurrentSubStreams: number;  // Default: 32
}
```

The policy can be updated at runtime:

```typescript
streamManager.updatePolicy({
  maxConcurrentMainStreams: 8,
  mosaic: 'third',
});
```

---

## Signed URL Generation

Stream URLs are never exposed directly. Instead, the StreamManager generates time-limited signed URLs:

```typescript
interface SignedStreamUrl {
  url: string;           // WebRTC/HLS/RTSP access URL
  token: string;         // 24-byte random access token
  expiresAt: number;     // Unix timestamp (1 hour from generation)
  protocol: string;      // "rtsp" | "webrtc" | "hls"
  deviceId: string;      // Source device identifier
  streamType: StreamType;// "main" | "sub"
}
```

### URL Construction by Protocol

| Protocol | URL Pattern                                              | Port |
|----------|----------------------------------------------------------|------|
| WebRTC   | `http://{mediamtx_host}:8889/{deviceId}-{type}/`        | 8889 |
| HLS      | `http://{mediamtx_host}:8888/{deviceId}-{type}/`        | 8888 |
| RTSP     | Raw RTSP URL from stream profile                         | 8554 |

### Example Response

```json
{
  "success": true,
  "data": {
    "url": "http://localhost:8889/hik-192.168.1.100:80-sub/",
    "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "expiresAt": 1741478400,
    "protocol": "webrtc",
    "deviceId": "hik-192.168.1.100:80",
    "streamType": "sub"
  }
}
```

---

## Concurrent Stream Limits

The stream policy engine enforces concurrency limits to prevent bandwidth saturation:

| Stream Type | Default Max Concurrent | Rationale                              |
|------------|----------------------|------------------------------------------|
| Main       | 4                    | High bandwidth (~4-8 Mbps per stream)    |
| Sub        | 32                   | Low bandwidth (~256-512 Kbps per stream) |

### Enforcement

```typescript
// Acquire a stream slot (returns false if limit reached)
const acquired = policyEngine.acquireStream('main');
if (!acquired) {
  // Fall back to sub stream
  policyEngine.acquireStream('sub');
}

// Release when viewer disconnects
policyEngine.releaseStream('main');
```

### Statistics

```typescript
policyEngine.getStats();
// {
//   activeMainStreams: 3,
//   activeSubStreams: 12,
//   maxMainStreams: 4,
//   maxSubStreams: 32
// }
```

---

## Playback Architecture

Playback provides access to recorded video stored on cameras and NVRs.

### Search

Query recorded segments within a time range:

```typescript
interface PlaybackSearchParams {
  deviceId: string;
  channel: number;
  startTime: Date;
  endTime: Date;
  eventType?: string;  // Filter by event type (motion, alarm)
}

interface PlaybackSegment {
  startTime: Date;
  endTime: Date;
  type: 'continuous' | 'motion' | 'alarm';
  sizeBytes?: number;
}
```

### Playback Session

Start a playback session to stream recorded video:

```typescript
interface PlaybackStartParams {
  deviceId: string;
  channel: number;
  startTime: Date;
  speed?: number;       // Playback speed multiplier
}

interface PlaybackSession {
  sessionId: string;    // Unique session identifier
  streamUrl: string;    // RTSP playback URL
  deviceId: string;
  channel: number;
}
```

### Per-Brand Playback URLs

| Brand      | Playback URL Pattern                                                             |
|-----------|----------------------------------------------------------------------------------|
| Hikvision | `rtsp://{user}:{pass}@{ip}:554/Streaming/tracks/{ch}01?starttime={ISO}`         |
| Dahua     | `rtsp://{user}:{pass}@{ip}:554/cam/playback?channel={ch}&starttime={timestamp}` |
| ONVIF     | Not supported (varies by manufacturer)                                           |

### Clip Export

Export a recorded segment as a downloadable file:

```typescript
interface ClipExportParams {
  deviceId: string;
  channel: number;
  startTime: Date;
  endTime: Date;
  format?: 'mp4' | 'avi' | 'mkv';  // Default: mp4
}

interface ExportJob {
  jobId: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  progress?: number;     // 0-100
  outputUrl?: string;    // Download URL when ready
  error?: string;
}
```

### Snapshots

Retrieve a still image from a camera at a specific timestamp:

```typescript
// Hikvision: GET /ISAPI/Streaming/channels/{ch}01/picture
// Dahua: GET /cgi-bin/snapshot.cgi?channel={ch}
// Returns: Buffer (JPEG image)
```
