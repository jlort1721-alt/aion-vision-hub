# AION Platform -- Network Architecture

> Version 1.0 -- March 2026
> Network topology, data flows, and service interconnections

---

## 1. High-Level Network Topology

```
                                 INTERNET
                                    |
                              [ Cloudflare ]
                              DNS + CDN + WAF
                              DDoS protection
                                    |
                                    | HTTPS (443)
                                    |
                     +--------------+---------------+
                     |         AION SERVER           |
                     |     (Docker Compose host)     |
                     |                               |
                     |  +-------------------------+  |
                     |  |     Caddy (443/80)       |  |
                     |  |  TLS termination         |  |
                     |  |  Auto Let's Encrypt      |  |
                     |  |  Security headers         |  |
                     |  +--+-----+-----+-----+----+  |
                     |     |     |     |     |        |
                     |     |     |     |     |        |
                     |  +--v--+  |  +--v--+  |        |
                     |  | API |  |  | GW  |  |        |
                     |  |:3000|  |  |:3100|  |        |
                     |  +--+--+  |  +--+--+  |        |
                     |     |     |     |     |        |
                     |  +--v--+  |  +--v--------v--+  |
                     |  |Redis|  |  |   MediaMTX   |  |
                     |  |:6379|  |  | :8554  RTSP  |  |
                     |  +-----+  |  | :8889  WebRTC|  |
                     |           |  | :8888  HLS   |  |
                     |  +-----+  |  | :9997  API   |  |
                     |  | PG  |  |  +--------------+  |
                     |  |:5432|  |                     |
                     |  +-----+  |                     |
                     |           |                     |
                     +-----------+---------------------+
                                 |
                          [ Site Firewall ]
                                 |
                     +-----------+-----------+
                     |      CAMERA VLAN      |
                     |                       |
                     |  +------+  +------+   |
                     |  | Cam1 |  | Cam2 |   |
                     |  | :554 |  | :554 |   |
                     |  | :80  |  | :80  |   |
                     |  +------+  +------+   |
                     |                       |
                     |  +------+  +------+   |
                     |  | NVR  |  |Intrcom|  |
                     |  | :554 |  | :5060 |  |
                     |  | :8000|  | :80   |  |
                     |  +------+  +------+   |
                     +-----------------------+
```

---

## 2. Caddy Reverse Proxy Routing

```
                         Client Browser / Mobile App
                                    |
                               HTTPS :443
                                    |
                         +----------+-----------+
                         |        Caddy          |
                         |   Reverse Proxy       |
                         +---+---+---+---+---+---+
                             |   |   |   |   |
          +------------------+   |   |   |   +------------------+
          |                      |   |   |                      |
     /api/*  /ws            /gateway/*  /webrtc/*          /hls/*
     /health                     |       |                      |
          |                      |       |                      |
   +------v-------+      +------v----+  |               +------v------+
   | backend-api  |      | edge-gw   |  |               |  MediaMTX   |
   | :3000        |      | :3100     |  |               |  HLS :8888  |
   | Fastify 5    |      | Fastify 5 |  |               +-------------+
   | 45 modules   |      | Device mgmt| |
   | Drizzle ORM  |      | PTZ, Events| +------v------+
   | JWT auth     |      | Playback  |  |  MediaMTX   |
   | WebSocket    |      | Discovery |  |  WebRTC     |
   +------+-------+      +------+----+  |  :8889      |
          |                      |       +-------------+
     +----+----+                 |
     |         |           +-----+------+
  +--v---+ +---v----+      |  MediaMTX  |
  |  PG  | | Redis  |      |  API :9997 |
  |:5432 | | :6379  |      +------------+
  +------+ +--------+

  Catch-all: /*  -->  Static frontend SPA (/srv/frontend)
```

---

## 3. Live Video Streaming Flow

```
   CAMERA / NVR                     AION PLATFORM                         BROWSER
  +------------+                +---------------------+              +---------------+
  |            |   RTSP :554    |                     |              |               |
  |  Camera    +<---------------+   Edge Gateway      |              |  React SPA    |
  |  (Hik/     |   pull stream  |   :3100             |              |  WebRTCPlayer |
  |   Dahua/   |                |                     |              |               |
  |   ONVIF)   |                |   1. Build RTSP URL |              |               |
  |            |                |   2. Register path  |              |               |
  +------------+                |      in MediaMTX    |              |               |
                                |   3. Validate token |              |               |
                                +--------+------------+              +-------+-------+
                                         |                                   |
                                  MediaMTX API                               |
                                   POST :9997                                |
                                         |                                   |
                                +--------v------------+                      |
                                |                     |    WebRTC :8889      |
                                |     MediaMTX        +--------------------->|
                                |                     |    SDP + ICE         |
                                |  RTSP :8554 (in)    |                      |
                                |  WebRTC :8889 (out) |    HLS :8888         |
                                |  HLS :8888 (out)    +--------------------->|
                                |                     |    (fallback)        |
                                +---------------------+              +-------v-------+
                                                                     |  Video plays  |
                                                                     |  in browser   |
                                                                     +---------------+

  Stream Selection Policy:
    Mosaic (4+ tiles)  -->  Sub stream  (D1/720p, 512-1024 Kbps)
    Single / Fullscreen -->  Main stream (4K/4MP, 4-8 Mbps)
    Mobile client      -->  Sub or Third stream (CIF, 128-256 Kbps)
```

---

## 4. Camera VLAN to Edge Gateway Detail

```
                    CAMERA VLAN (192.168.1.0/24)
      +----------+  +----------+  +----------+  +----------+
      |  Hik Cam |  | Dahua Cam|  | ONVIF Cam|  | Fanvil   |
      |  :554    |  | :554     |  | :554     |  | Intercom |
      |  :80     |  | :80      |  | :80      |  | :5060    |
      |  :8000   |  | :37777   |  | :8080    |  | :80      |
      +----+-----+  +----+-----+  +----+-----+  +----+-----+
           |              |              |              |
           |   RTSP pull  |  RTSP pull   | RTSP pull   | SIP REGISTER
           |   ISAPI GET  |  HTTP API    | ONVIF SOAP  | RTP media
           |              |              |              |
      +----v--------------v--------------v--------------v-----+
      |                                                        |
      |                  EDGE GATEWAY (:3100)                  |
      |                                                        |
      |  +---------------+  +---------------+  +------------+  |
      |  | Hikvision     |  | Dahua         |  | ONVIF      |  |
      |  | Adapter       |  | Adapter       |  | Adapter    |  |
      |  | ISAPI client  |  | RPC client    |  | WS-Disc    |  |
      |  +-------+-------+  +-------+-------+  +------+-----+  |
      |          |                   |                  |        |
      |  +-------v-------------------v------------------v-----+ |
      |  |              Stream Manager                        | |
      |  |  - RTSP URL builder (per vendor)                   | |
      |  |  - MediaMTX path registration                      | |
      |  |  - Stream health monitoring                        | |
      |  +----------------------------+-----------------------+ |
      |                               |                         |
      +-------------------------------+-------------------------+
                                      |
                               MediaMTX API
                                POST :9997
                                      |
                               +------v------+
                               |  MediaMTX   |
                               |  RTSP :8554 |
                               +-------------+
```

---

## 5. Device Onboarding Flow

```
  OPERATOR                    AION PLATFORM                         DEVICE
  (Browser)                                                     (Camera/NVR)
     |                              |                                |
     |  1. Add Device               |                                |
     |  (IP/domain/serial)          |                                |
     |----------------------------->|                                |
     |                              |                                |
     |                              |  2. TCP probe (:80, :554)      |
     |                              |------------------------------->|
     |                              |  3. Port open? <ACK>           |
     |                              |<-------------------------------|
     |                              |                                |
     |                              |  4. Try credentials            |
     |                              |  (ISAPI/HTTP-API/ONVIF)        |
     |                              |------------------------------->|
     |                              |  5. Auth success + device info |
     |                              |<-------------------------------|
     |                              |                                |
     |                              |  6. Query capabilities         |
     |                              |  (channels, PTZ, audio, AI)    |
     |                              |------------------------------->|
     |                              |  7. Capability response        |
     |                              |<-------------------------------|
     |                              |                                |
     |                              |  8. Build RTSP URL per channel |
     |                              |  9. Register in MediaMTX       |
     |                              | 10. Store encrypted creds      |
     |                              | 11. Start health worker        |
     |                              |                                |
     |  12. Device online           |                                |
     |  (channels enumerated)       |                                |
     |<-----------------------------|                                |
     |                              |                                |


  DAHUA AUTO-REGISTER (zero-touch onboarding):

  Dahua Device                  AION SERVER (:9500)              OPERATOR
     |                              |                                |
     |  1. TCP connect :9500        |                                |
     |----------------------------->|                                |
     |  2. Device serial + model    |                                |
     |----------------------------->|                                |
     |                              |  3. Notify: new device found   |
     |                              |------------------------------->|
     |                              |                                |
     |                              |  4. Approve + assign site      |
     |                              |<-------------------------------|
     |                              |                                |
     |  5. Push config (NTP, users) |                                |
     |<-----------------------------|                                |
     |  6. Start streaming          |                                |
     |----------------------------->|                                |
     |                              |  7. Device provisioned         |
     |                              |------------------------------->|
```

---

## 6. Event Pipeline Flow

```
  DEVICE                    EDGE GATEWAY               BACKEND API            DATABASE
     |                           |                          |                      |
     |  Alarm trigger            |                          |                      |
     |  (motion, intrusion,      |                          |                      |
     |   line cross, face, ANPR) |                          |                      |
     |                           |                          |                      |
     |  -- ISAPI callback ------>|                          |                      |
     |  -- HTTP notify --------->|                          |                      |
     |  -- ONVIF PullPoint ----->|                          |                      |
     |                           |                          |                      |
     |                    +------v--------+                 |                      |
     |                    | Event Listener |                 |                      |
     |                    | (per adapter)  |                 |                      |
     |                    +------+--------+                 |                      |
     |                           |                          |                      |
     |                    +------v--------+                 |                      |
     |                    | Normalize     |                 |                      |
     |                    | vendor event  |                 |                      |
     |                    | to AION schema|                 |                      |
     |                    +------+--------+                 |                      |
     |                           |                          |                      |
     |                    +------v--------+                 |                      |
     |                    | Batch buffer  |                 |                      |
     |                    | (5s flush)    |                 |                      |
     |                    +------+--------+                 |                      |
     |                           |                          |                      |
     |                           | POST /api/events (batch) |                      |
     |                           |------------------------->|                      |
     |                           |                          |                      |
     |                           |                   +------v--------+             |
     |                           |                   | Validate JWT  |             |
     |                           |                   | Parse events  |             |
     |                           |                   | Enrich with   |             |
     |                           |                   | tenant context|             |
     |                           |                   +------+--------+             |
     |                           |                          |                      |
     |                           |                          | INSERT events        |
     |                           |                          |--------------------->|
     |                           |                          |                      |
     |                           |                          | Publish to Redis     |
     |                           |                          | pub/sub channel      |
     |                           |                          |                      |
     |                           |                          | WebSocket push       |
     |                           |                          |------> Clients       |
     |                           |                          |                      |
     |                           |                          | Trigger rules        |
     |                           |                          | (email, WhatsApp,    |
     |                           |                          |  push notification)  |
     |                           |                          |                      |

  Event retention: 180 days (configurable via platformConfig.events.retainDays)
  Batch flush interval: 5000ms (configurable via platformConfig.events.batchFlushMs)
```

---

## 7. Playback (Recording Retrieval) Flow

```
  BROWSER                   CADDY              EDGE GATEWAY           NVR / CAMERA
     |                        |                      |                      |
     |  GET /gateway/playback |                      |                      |
     |  ?device=X&from=T1     |                      |                      |
     |  &to=T2&channel=1      |                      |                      |
     |----------------------->|                      |                      |
     |                        | strip /gateway       |                      |
     |                        |--------------------->|                      |
     |                        |                      |                      |
     |                        |               +------v--------+            |
     |                        |               | Validate token |            |
     |                        |               | Resolve device |            |
     |                        |               +------+--------+            |
     |                        |                      |                      |
     |                        |                      | RTSP PLAY (range)    |
     |                        |                      | or ISAPI/NetSDK      |
     |                        |                      | ContentMgmt search   |
     |                        |                      |--------------------->|
     |                        |                      |                      |
     |                        |                      |<-- RTSP stream ------|
     |                        |                      |   (recording data)   |
     |                        |                      |                      |
     |                        |               +------v--------+            |
     |                        |               | Proxy through  |            |
     |                        |               | MediaMTX :9320 |            |
     |                        |               | or direct relay|            |
     |                        |               +------+--------+            |
     |                        |                      |                      |
     |<---------- WebRTC/HLS stream -----------------|                      |
     |                        |                      |                      |

  Recording mode: device_nvr (default)
    - Recordings stored on NVR/camera SD card
    - AION proxies playback on demand
    - No server-side storage required
```

---

## 8. Intercom / SIP Flow

```
  VISITOR                FANVIL INTERCOM         AION (SIP Proxy)        OPERATOR
  (at door)                   |                       |                  (browser)
     |                        |                       |                      |
     |  Press call button     |                       |                      |
     |----------------------->|                       |                      |
     |                        |  SIP INVITE :5080     |                      |
     |                        |---------------------->|                      |
     |                        |                       |                      |
     |                        |                       |  WebSocket notify    |
     |                        |                       |--------------------->|
     |                        |                       |                      |
     |                        |                       |  Accept call         |
     |                        |                       |<---------------------|
     |                        |                       |                      |
     |                        |  SIP 200 OK           |                      |
     |                        |<----------------------|                      |
     |                        |                       |                      |
     |  <---- Two-way audio (RTP :20000-22000) -----> |                      |
     |                        |                       |                      |
     |                        |  Video stream         |                      |
     |                        |  (RTSP :554)          |                      |
     |                        |-----> MediaMTX ------>|-----> WebRTC ------->|
     |                        |                       |                      |
     |                        |                       |  Door unlock cmd     |
     |                        |                       |<---------------------|
     |                        |                       |                      |
     |                        |  HTTP relay trigger   |                      |
     |                        |<----------------------|                      |
     |  Door opens            |                       |                      |
     |<-----------------------|                       |                      |

  SIP port: 5080 (configurable via SIP_PORT)
  RTP range: 20000-22000
  Transport: UDP (default), TCP, TLS, WSS supported
```

---

## 9. Health Check Architecture

```
  +-------------------+
  | Health Check      |
  | Worker            |
  | (backend-api)     |
  +--------+----------+
           |
           | Periodic probes
           |
  +--------v----------+------+----------+----------+-----------+
  |                    |      |          |          |           |
  | TCP Probe         | Auth | Snapshot | Stream   | Channel   |
  | every 30s         | Probe| Probe    | Probe    | Reconcile |
  |                   |120s  | 300s     | 300s     | 24h       |
  +---+---------------+--+---+----+-----+----+-----+-----+----+
      |                   |        |          |           |
      v                   v        v          v           v
  Connect to         Try login  GET snap   Verify     Re-enumerate
  device :554/:80    ISAPI/API  from device RTSP is   all channels
  (is it alive?)     (creds ok?) (image ok?) playing   (NVR changes?)
      |                   |        |          |           |
      +-------------------+--------+----------+-----------+
                          |
                   +------v------+
                   | Update      |
                   | device      |
                   | status in   |
                   | database    |
                   | (online/    |
                   |  offline/   |
                   |  degraded)  |
                   +------+------+
                          |
                   +------v------+
                   | WebSocket   |
                   | push status |
                   | to clients  |
                   +-------------+
```

---

## 10. Internal Service Communication Map

```
  +-------------------------------------------------------------------+
  |                       aion-net (Docker bridge)                     |
  |                                                                   |
  |  +-------------+         +-------------+         +-------------+  |
  |  | backend-api |-------->| postgres    |         | mediamtx    |  |
  |  | :3000       |  SQL    | :5432       |         | :8554 RTSP  |  |
  |  |             |-------->| PG 16 +     |         | :8889 WebRTC|  |
  |  |             | Redis   | pgvector    |         | :8888 HLS   |  |
  |  |             |---+     +-------------+         | :9997 API   |  |
  |  +------+------+   |                             +------+------+  |
  |         |          |     +-------------+                |         |
  |         |          +---->| redis       |                |         |
  |         |                | :6379       |                |         |
  |  HTTP   |                | Sessions    |                |         |
  |  :3000  |                | Pub/Sub     |                |         |
  |         |                | Rate limits |                |         |
  |  +------v------+        +-------------+                |         |
  |  | edge-gateway|                                       |         |
  |  | :3100       |---------------------------------------+         |
  |  |             |  MediaMTX API :9997                             |
  |  |             |  (register/remove streams)                      |
  |  |             |                                                 |
  |  |             |-----> backend-api :3000                         |
  |  |             |  (forward events, sync device state)            |
  |  +-------------+                                                 |
  |                                                                  |
  +------------------------------------------------------------------+

  Legend:
    -------> TCP connection (direction = initiator)
    All communication is plaintext within Docker network
    TLS terminates at Caddy for external traffic
```

---

## 11. Multi-Site Deployment Topology

```
  +---------------------------+       +---------------------------+
  |        SITE A             |       |        SITE B             |
  |                           |       |                           |
  |  Cameras  NVR  Intercoms  |       |  Cameras  NVR  Intercoms  |
  |     |      |      |       |       |     |      |      |       |
  |  +--v------v------v----+  |       |  +--v------v------v----+  |
  |  |   Edge Gateway A    |  |       |  |   Edge Gateway B    |  |
  |  |   :3100             |  |       |  |   :3100             |  |
  |  |   MediaMTX A        |  |       |  |   MediaMTX B        |  |
  |  |   :8554/:8889/:8888 |  |       |  |   :8554/:8889/:8888 |  |
  |  +----------+----------+  |       |  +----------+----------+  |
  |             |              |       |             |              |
  +-------------|--  ----------+       +-------------|----------   -+
                |                                    |
           HTTPS :443                           HTTPS :443
           (mTLS)                               (mTLS)
                |                                    |
       +--------+------------------------------------+--------+
       |                                                      |
       |                  AION CLOUD                           |
       |                                                      |
       |  +-------------+  +-------+  +-------+  +---------+ |
       |  | Backend API |  |  PG   |  | Redis |  | Caddy   | |
       |  | :3000       |  | :5432 |  | :6379 |  | :443    | |
       |  +-------------+  +-------+  +-------+  +---------+ |
       |                                                      |
       +------------------------------------------------------+
                              |
                         HTTPS :443
                              |
                    +--------------------+
                    |  Operator Browsers  |
                    |  Mobile Apps        |
                    +--------------------+
```
