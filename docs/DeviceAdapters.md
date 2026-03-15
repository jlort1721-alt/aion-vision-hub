# AION Vision Hub — Device Adapters

## Adapter Strategy

All device communication is abstracted through adapter interfaces defined in `src/types/adapters.ts`. This allows the platform to support multiple brands without coupling business logic to vendor-specific protocols.

## Interface Hierarchy

```
IDeviceAdapter (base)
├── IHikvisionAdapter (ISAPI + Device Network SDK)
├── IDahuaAdapter (HTTP API + NetSDK)
└── IOnvifAdapter (ONVIF Profile S/T/M)
```

## IDeviceAdapter Methods

| Method | Purpose |
|--------|---------|
| `connect()` | Establish connection with credentials |
| `disconnect()` | Clean disconnect |
| `testConnection()` | Validate connectivity and auth |
| `discover()` | Scan network for devices |
| `getCapabilities()` | Query device features |
| `getStreams()` | List available streams |
| `getStreamUrl()` | Build RTSP URL for main/sub |
| `sendPTZCommand()` | PTZ control |
| `getPTZPresets()` | List saved positions |
| `subscribeEvents()` | Real-time event subscription |
| `getStatus()` | Online check with details |
| `getSnapshot()` | Capture still image |

## Brand-Specific Extensions

### Hikvision
- `getISAPIEndpoint()` — Raw ISAPI access
- `getSmartEvents()` — AcuSense events

### Dahua
- `getHTTPAPIEndpoint()` — Raw HTTP API access
- `getSmartSearch()` — Smart search by attributes

### ONVIF
- `getProfiles()` — Media profiles
- `getEventSubscription()` — WS-BaseNotification

## Stream URL Patterns

### Hikvision RTSP
```
rtsp://{user}:{pass}@{ip}:{rtsp_port}/Streaming/Channels/{channel}0{stream}
  - channel: 1-based
  - stream: 1=main, 2=sub
```

### Dahua RTSP
```
rtsp://{user}:{pass}@{ip}:{rtsp_port}/cam/realmonitor?channel={ch}&subtype={type}
  - type: 0=main, 1=sub
```

### ONVIF
```
Obtained dynamically via GetStreamUri from media service
```

## Implementation Status

| Component | Status |
|-----------|--------|
| Interface definitions | ✅ Complete |
| Type contracts | ✅ Complete |
| Hikvision adapter | 📋 Contract ready |
| Dahua adapter | 📋 Contract ready |
| ONVIF adapter | 📋 Contract ready |
| Gateway runtime | 📋 Architecture documented |
