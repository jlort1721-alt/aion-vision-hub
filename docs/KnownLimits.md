# AION Vision Hub — Known Limitations

## Platform Constraints

### Video Playback
- **No native video rendering** — Browser cannot decode RTSP natively
- **Requires edge gateway** — Real video needs on-premise transcoding proxy
- **Current state**: UI is fully operational with intelligent placeholders showing device info, connection details, and stream metadata

### Device Communication
- **No direct device access from browser** — CORS/network constraints prevent direct ISAPI/HTTP API calls
- **Requires gateway** — All device communication must go through an on-premise gateway
- **Current state**: Adapter interfaces and type contracts are complete; runtime implementations require the gateway

### Real-Time Constraints
- **WebSocket limit** — Supabase Realtime works for events but not for high-frequency device telemetry
- **Current state**: Event notifications are real-time; device health polling would need gateway

### Multi-Tenant
- **Single default tenant** — New users auto-join the default tenant
- **No tenant creation UI** — Super admin tenant management is a future feature
- **Current state**: Data isolation works, but tenant provisioning is manual

## Browser Limitations

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| H.264 playback | ✅ | ✅ | ✅ | ✅ |
| H.265 playback | ❌ | ❌ | ✅ | ❌ |
| WebRTC | ✅ | ✅ | ✅ | ✅ |
| PWA install | ✅ | ❌ | ❌ | ✅ |

## Security Considerations

- Device credentials are not yet encrypted at rest (pending vault integration)
- 2FA is configured in UI but not enforced server-side
- Session timeout is UI-only (server relies on JWT expiry)

## Data Limits

- Supabase queries default to 1000 rows
- Audit logs capped at 500 per fetch (paginated)
- AI sessions limited to 100 per query
