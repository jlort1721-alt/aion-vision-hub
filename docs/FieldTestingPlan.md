# Field Testing Plan — AION Vision Hub

> **Updated:** 2026-03-08 (Post-audit, comprehensive)
> **Scope:** All components requiring physical hardware, network access, or third-party services

---

## Prerequisites

### Hardware Required
- 1x Hikvision IP camera (DS-2CD series recommended)
- 1x Dahua IP camera (IPC-HDW series recommended)
- 1x Generic ONVIF camera (any brand)
- 1x PTZ-capable camera (any of the above)
- 1x Sonoff/eWeLink smart switch
- 1x Fanvil intercom (optional, for VoIP testing)
- Network switch with all devices on same subnet

### Software Required
- MediaMTX running (`docker run --rm -p 8554:8554 -p 8888:8888 -p 8889:8889 -p 9997:9997 bluenviron/mediamtx`)
- Backend API running on port 3000
- Gateway running on port 3100
- Frontend running on port 8080 (or 5173)
- Authenticated user with `operator` or `tenant_admin` role

### Credentials Required
- Camera admin credentials (username/password)
- Supabase project configured
- JWT token for API calls

---

## Phase 1: Device Connectivity (30 min)

### Test 1.1: Hikvision Connection
```bash
curl -X POST http://localhost:3100/api/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hik Test",
    "brand": "hikvision",
    "ip": "192.168.1.X",
    "port": 80,
    "username": "admin",
    "password": "camera-password"
  }'
```
**Expected:** 201 with device ID, capabilities include `live`, `playback`, `ptz` (if PTZ), `events`

### Test 1.2: Dahua Connection
```bash
curl -X POST http://localhost:3100/api/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dahua Test",
    "brand": "dahua",
    "ip": "192.168.1.Y",
    "port": 80,
    "username": "admin",
    "password": "camera-password"
  }'
```
**Expected:** 201 with device ID and capabilities

### Test 1.3: ONVIF Connection
```bash
curl -X POST http://localhost:3100/api/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ONVIF Test",
    "brand": "onvif",
    "ip": "192.168.1.Z",
    "port": 80,
    "username": "admin",
    "password": "camera-password"
  }'
```

### Test 1.4: Connection Failure
```bash
curl -X POST http://localhost:3100/api/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bad Device",
    "brand": "hikvision",
    "ip": "192.168.1.254",
    "port": 80,
    "username": "wrong",
    "password": "wrong"
  }'
```
**Expected:** Error response with meaningful message (auth failed or unreachable)

**Pass Criteria:** All 3 camera brands connect successfully. Error case returns descriptive error.

---

## Phase 2: Discovery (15 min)

### Test 2.1: ONVIF WS-Discovery
```bash
curl -X POST http://localhost:3100/api/discovery \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"networkRange": "192.168.1.0/24", "timeoutMs": 15000}'
```
**Expected:** List of discovered devices with IP, brand guess, model (if available)

### Test 2.2: Discovery Status
```bash
curl http://localhost:3100/api/discovery/status \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** Scanning progress or completion status

**Pass Criteria:** At least the ONVIF-compatible cameras are discovered. Hikvision/Dahua may or may not appear (SADP/DHDiscover not implemented).

---

## Phase 3: Live Streaming (20 min)

### Test 3.1: Start Sub-stream
```bash
curl -X POST http://localhost:3100/api/streams/{deviceId} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"streamType": "sub", "channel": 1}'
```
**Expected:** `{webrtcUrl: "...", hlsUrl: "..."}` with valid URLs

### Test 3.2: Verify MediaMTX Registration
```bash
curl http://localhost:9997/v3/paths/list
```
**Expected:** Path `aion/{deviceId}/sub` present in list

### Test 3.3: Open WebRTC Stream in Browser
Open `webrtcUrl` in browser or use MediaMTX WebRTC player page.
**Expected:** Live video visible within 3 seconds

### Test 3.4: Open HLS Stream
Open `hlsUrl` in VLC or browser.
**Expected:** Live video with 5-10 second latency (normal for HLS)

### Test 3.5: Start Main-stream
```bash
curl -X POST http://localhost:3100/api/streams/{deviceId} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"streamType": "main", "channel": 1}'
```
**Expected:** Higher resolution stream URL

### Test 3.6: Stop Stream
```bash
curl -X DELETE http://localhost:3100/api/streams/{deviceId} \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** 200, path removed from MediaMTX

**Pass Criteria:** Both sub and main streams work for at least 2 camera brands. WebRTC plays in browser.

---

## Phase 4: PTZ Control (15 min)

*Requires PTZ-capable camera*

### Test 4.1: Continuous Movement
```bash
for dir in left right up down zoom_in zoom_out; do
  curl -X POST http://localhost:3100/api/devices/{deviceId}/ptz \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"action\": \"$dir\", \"speed\": 30}"
  sleep 1
  curl -X POST http://localhost:3100/api/devices/{deviceId}/ptz \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"action": "stop"}'
  sleep 1
done
```
**Expected:** Camera moves in each direction visibly

### Test 4.2: Presets
```bash
# Set preset
curl -X POST http://localhost:3100/api/devices/{deviceId}/preset \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "set", "presetId": 1, "name": "Entrance"}'

# Move camera away, then go to preset
curl -X POST http://localhost:3100/api/devices/{deviceId}/preset \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "goto", "presetId": 1}'
```
**Expected:** Camera returns to saved position

**Pass Criteria:** All 6 directions work. At least 1 preset can be saved and recalled.

---

## Phase 5: Playback / Recording (20 min)

*Requires camera with SD card or connected NVR*

### Test 5.1: Search Recordings
```bash
curl "http://localhost:3100/api/playback?deviceId={id}&channel=1&startTime=2026-03-08T00:00:00Z&endTime=2026-03-08T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** List of recording segments with start/end times

### Test 5.2: Start Playback
```bash
curl -X POST http://localhost:3100/api/playback/{deviceId} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"channel": 1, "startTime": "2026-03-08T10:00:00Z", "endTime": "2026-03-08T10:05:00Z"}'
```
**Expected:** WebRTC + HLS URLs for playback

### Test 5.3: Stop Playback
```bash
curl -X DELETE http://localhost:3100/api/playback/{deviceId}?channel=1 \
  -H "Authorization: Bearer $TOKEN"
```

**Pass Criteria:** Recording search returns results. Playback stream is viewable.

---

## Phase 6: Event Detection (20 min)

### Test 6.1: Attach Event Listener
The gateway auto-subscribes to events on device connection. Verify:
```bash
curl http://localhost:3100/health/ready \
  -H "Authorization: Bearer $TOKEN"
```
Check `eventListener.activeListeners` > 0

### Test 6.2: Trigger Motion Event
Walk in front of camera with motion detection enabled.
Check Supabase `events` table for new rows within 5 seconds.

### Test 6.3: Multi-channel Deduplication
If multi-channel device: trigger motion on channel 1 and channel 2.
**Expected:** Both events stored (not deduplicated — different channels)

### Test 6.4: Same-channel Rapid Events
Trigger motion rapidly on same channel (wave hand continuously).
**Expected:** Events within 1 second are deduplicated; only one stored per second

**Pass Criteria:** Events appear in database within 5-10 seconds. Channel-based deduplication works correctly.

---

## Phase 7: Reconnection & Resilience (15 min)

### Test 7.1: Network Disconnect
1. Disconnect camera from network (pull ethernet)
2. Wait 30 seconds
3. Check gateway logs for reconnect attempts
4. Reconnect camera
5. Verify auto-reconnection within 2 minutes

### Test 7.2: Gateway Restart
1. Stop gateway process
2. Start gateway process
3. Verify devices reconnect automatically

### Test 7.3: MediaMTX Restart
1. Restart MediaMTX container
2. Verify streams auto-recover on next request

**Pass Criteria:** Device reconnects after network restoration. Gateway restart re-establishes connections.

---

## Phase 8: Integration Testing (30 min)

### Test 8.1: eWeLink Device Control
1. Open Domotics page in frontend
2. Log in with eWeLink credentials
3. Toggle a Sonoff switch on/off
4. Verify physical device responds

### Test 8.2: Email Alert
1. Configure email in Settings
2. Trigger a high-severity event (or use test endpoint)
3. Verify email received with correct alert content

### Test 8.3: AI Chat
1. Open AI Assistant page
2. Send a message
3. Verify response from configured provider

### Test 8.4: WhatsApp (if configured)
1. Send test message from WhatsApp page
2. Verify delivery status updates
3. Send inbound message from phone
4. Verify it appears in conversations

### Test 8.5: TTS (if configured)
1. Call voice/test-connection endpoint
2. Verify audio response is generated

**Pass Criteria:** Each configured integration responds successfully.

---

## Phase 9: Frontend E2E (20 min)

### Test 9.1: Login Flow
1. Navigate to `/login`
2. Enter valid credentials → redirects to `/dashboard`
3. Navigate to `/login` while authenticated → redirects to `/dashboard`

### Test 9.2: RBAC Enforcement
1. Log in as `viewer` role
2. Attempt to navigate to `/admin` → should redirect to `/dashboard`
3. Verify sidebar only shows permitted modules

### Test 9.3: PWA Install
1. Open app in Chrome mobile
2. Wait 30 seconds for install prompt
3. Install to home screen
4. Open from home screen → standalone mode

### Test 9.4: Offline Behavior
1. Open app, navigate to dashboard
2. Disable network (airplane mode)
3. Navigate to another cached page → should load shell
4. Re-enable network → app recovers

**Pass Criteria:** Auth flow works. RBAC blocks unauthorized routes. PWA installs and works offline for cached content.

---

## Results Template

| Phase | Tests | Passed | Failed | Notes |
|-------|-------|--------|--------|-------|
| 1. Device Connectivity | 4 | | | |
| 2. Discovery | 2 | | | |
| 3. Live Streaming | 6 | | | |
| 4. PTZ Control | 2 | | | |
| 5. Playback | 3 | | | |
| 6. Events | 4 | | | |
| 7. Resilience | 3 | | | |
| 8. Integrations | 5 | | | |
| 9. Frontend E2E | 4 | | | |
| **Total** | **33** | | | |

**Tester:** _______________
**Date:** _______________
**Environment:** _______________

---

## Phase 10: VoIP / Intercom Field Testing (1.5 hours)

### Prerequisites

- Fanvil intercom device(s) powered on and on same VLAN as backend
- Asterisk PBX running with ARI enabled
- Backend API configured with SIP and Fanvil credentials
- Factory default passwords changed on all devices

### Test 10.1: Device Connectivity

```bash
POST /intercom/devices/test
{"ipAddress": "192.168.1.50", "brand": "fanvil", "credentials": {"username": "myadmin", "password": "MyStr0ngP@ss"}}
```

**Expected:** `reachable: true`, model and firmware returned
**Verify:** Public IPs are rejected (try `8.8.8.8` — should fail with "private network" error)

### Test 10.2: SIP Health Check

```bash
GET /intercom/voip/health
```

**Expected:** `status: "connected"`, no PBX IP or hostname in response

### Test 10.3: SIP Provisioning

```bash
POST /intercom/devices/provision
{"deviceId": "<uuid>", "sipUsername": "lobby101", "sipPassword": "S1pStr0ng!"}
```

**Expected:** `success: true`, device reboots and registers on PBX
**Verify:** Weak password (e.g., `"1234"`) is rejected by schema (min 8 chars)

### Test 10.4: Door Relay

```bash
POST /intercom/door/open
{"deviceId": "<uuid>", "relayIndex": 1}
```

**Expected:** Electric lock activates for configured hold time (default 5s)
**Verify:** Audit log entry created: `{"level":"audit","event":"door.open",...}`

### Test 10.5: Rate Limiting

Trigger `POST /intercom/door/open` 6 times rapidly for the same device.
**Expected:** 6th request returns `429` with retry-after message.

### Test 10.6: Credential Security

```bash
GET /intercom/voip/config
```

**Expected:** Response includes `sipHost`, `sipPort`, etc. but `ariPassword` and `fanvilAdminPassword` are `undefined`/absent.

### Test 10.7: Security Audit

Check backend logs for structured audit entries:
```bash
grep '"level":"audit"' backend.log | head -20
```

**Expected:** Entries for `door.open`, `device.provision`, `device.test`, `voip.config.update`

### VoIP Field Test Results

| Test | Device | Status | Notes |
|------|--------|--------|-------|
| 10.1 Device connectivity | | PASS/FAIL | |
| 10.2 SIP health | | PASS/FAIL | |
| 10.3 SIP provisioning | | PASS/FAIL | |
| 10.4 Door relay | | PASS/FAIL | |
| 10.5 Rate limiting | | PASS/FAIL | |
| 10.6 Credential security | | PASS/FAIL | |
| 10.7 Audit logging | | PASS/FAIL | |
