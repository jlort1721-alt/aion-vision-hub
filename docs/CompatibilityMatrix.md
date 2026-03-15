# AION Vision Hub — Compatibility Matrix

## Device Support Matrix

| Capability | Hikvision | Dahua | ONVIF Generic |
|-----------|-----------|-------|---------------|
| Discovery | ✅ ISAPI + ONVIF | ✅ HTTP API + ONVIF | ✅ WS-Discovery |
| Stream (RTSP) | ✅ Native | ✅ Native | ✅ Profile S |
| Playback | ✅ ISAPI SDK | ✅ NetSDK | ⚠️ Profile G (limited) |
| PTZ | ✅ ISAPI + ONVIF | ✅ HTTP API + ONVIF | ✅ Profile S |
| Events | ✅ ISAPI Alerts | ✅ HTTP Callback | ✅ WS-BaseNotification |
| Config | ✅ ISAPI | ✅ HTTP API | ⚠️ Limited |
| Health | ✅ Heartbeat + ISAPI | ✅ Heartbeat + API | ✅ GetDeviceInformation |
| AI Metadata | ✅ AcuSense | ✅ WizSense | ❌ Not standard |
| Smart Events | ✅ Line crossing, intrusion, face, ANPR | ✅ IVS, TiOC, ANPR | ⚠️ Analytics Profile |
| Audio | ✅ Two-way | ✅ Two-way | ✅ Profile T |
| Storage Query | ✅ ContentMgmt API | ✅ MediaFileFind | ⚠️ Recording Search |

## Protocol Details

### Hikvision
- **ISAPI**: RESTful HTTP API on port 80/443
- **Device SDK**: Native C SDK with wrapper
- **RTSP**: Standard on port 554
- **ONVIF**: Profile S, T supported

### Dahua
- **HTTP API**: JSON-based on port 80/443  
- **NetSDK**: Native SDK for advanced features
- **RTSP**: Standard on port 554
- **ONVIF**: Profile S, T, M supported

### ONVIF Generic
- **Discovery**: WS-Discovery (multicast)
- **Media**: GetProfiles, GetStreamUri
- **PTZ**: Continuous/Absolute/Relative move
- **Events**: WS-BaseNotification / PullPoint

## Tested Models

### Hikvision
- DS-2CD2386G2-IU (8MP Turret)
- DS-2CD2T47G2-L (4MP ColorVu)
- DS-2DE4425IW-DE (4MP PTZ)
- DS-7732NXI-K4 (32ch NVR)

### Dahua
- IPC-HFW5442E-ZE (4MP Bullet)
- IPC-HDW3849H-AS-PV (8MP TiOC)
- IPC-HFW2831E-S-S2 (8MP Lite)
- DHI-NVR5216-16P-I (16ch NVR)

## Legend
- ✅ Fully supported
- ⚠️ Partial / limited support
- ❌ Not supported
- 📋 Contract ready, implementation pending
