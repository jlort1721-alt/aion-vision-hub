# AION Vision Hub — Streaming Strategy

## Stream Types

| Type | Use Case | Typical Resolution | Bitrate |
|------|----------|-------------------|---------|
| Main | Full screen, evidence, playback | 4K / 4MP | 4-8 Mbps |
| Sub | Mosaic grids, thumbnails | D1 / 720p | 512-1024 Kbps |
| Third | Mobile, low-bandwidth | CIF / QVGA | 128-256 Kbps |

## Selection Policy

1. **Mosaic grids (4+)** → Sub stream always
2. **Single view / focus** → Main stream
3. **Fullscreen** → Main stream
4. **Mobile client** → Sub or Third stream
5. **Playback** → Main stream from NVR/device storage

## Fallback Chain

```
Main → Sub → Third → Connection Error State
```

If a stream fails:
1. Attempt reconnection (3 retries, exponential backoff)
2. Fall back to lower quality stream
3. Show degradation indicator in UI
4. Log to health monitoring

## Stream State Machine

```
IDLE → CONNECTING → BUFFERING → PLAYING → PAUSED
                  ↘ FAILED → RECONNECTING → CONNECTING
```

## Signed Stream URLs

For browser-based playback (WebRTC/HLS):
- Gateway generates short-lived signed URLs (5-minute TTL)
- Token includes: device_id, channel, stream_type, expiry, signature
- Gateway validates token before proxying RTSP

## Codec Support

| Codec | Browser Support | Transcoding Required |
|-------|----------------|---------------------|
| H.264 | ✅ Native (MSE/WebRTC) | No |
| H.265 | ⚠️ Limited (Safari only) | Yes (via gateway) |
| MJPEG | ✅ Native (img tag) | No |

## Architecture

```
[Device RTSP] → [Gateway Proxy] → [WebRTC/HLS] → [Browser Player]
```

The gateway handles:
- RTSP demuxing
- H.265→H.264 transcoding (when needed)
- WebRTC SDP negotiation
- HLS segmentation
