# VoIP & Intercom Integration — AION Vision Hub

**Frontend Service**: `src/services/integrations/voip.ts`
**Backend Module**: `backend/apps/backend-api/src/modules/intercom/`
**Voice AI Module**: `backend/apps/backend-api/src/modules/voice/`
**Protocol**: SIP (Session Initiation Protocol)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        AION Vision Hub                            │
│                                                                    │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  Frontend    │    │  Backend API │    │  Edge Gateway        │  │
│  │  (React)     │    │  (Fastify)   │    │  (Express)           │  │
│  │             │    │              │    │                      │  │
│  │ VoIPService ├───►│ /intercom/*  │    │ Device Discovery     │  │
│  │ ElevenLabs  │    │ /voice/*     │    │ Stream Management    │  │
│  │ SIP.js (WSS)│    │              │    │                      │  │
│  └──────┬──────┘    └──────┬───────┘    └──────────────────────┘  │
│         │                   │                                      │
│         │ WebRTC            │ ARI/HTTP                             │
│         │ (browser calls)   │ (server calls)                      │
└─────────┼───────────────────┼──────────────────────────────────────┘
          │                   │
          ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PBX — Asterisk / FreePBX                       │
│                                                                   │
│  ┌───────────┐  ┌───────────┐  ┌─────────────┐  ┌────────────┐  │
│  │ PJSIP     │  │ ARI       │  │ Dialplan    │  │ Recordings │  │
│  │ (SIP UA)  │  │ (REST API)│  │ (call flow) │  │ (storage)  │  │
│  └─────┬─────┘  └───────────┘  └─────────────┘  └────────────┘  │
│        │                                                          │
└────────┼──────────────────────────────────────────────────────────┘
         │ SIP (UDP/TCP/TLS)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  IP Intercom Devices                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ Fanvil   │  │Hikvision │  │ Dahua    │  │ Generic SIP     │  │
│  │ i10/i16V │  │ DS-KD    │  │ VTO      │  │ Door Phone      │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Components Implemented

### 1. SIP/VoIP Abstraction Layer

**File:** `backend/apps/backend-api/src/modules/intercom/sip-provider.ts`

| Provider | Status | Description |
|----------|--------|-------------|
| `AsteriskSipProvider` | Contract-ready | Connects to Asterisk via ARI REST API |
| `NoopSipProvider` | Active fallback | Returns descriptive errors when PBX not configured |

**SipProvider contract** (`types.ts`):
```typescript
interface SipProvider {
  register(credentials): Promise<SipRegistration>;
  initiateCall(request): Promise<InitiateCallResult>;
  answerCall(callId): Promise<void>;
  hangupCall(callId): Promise<void>;
  sendDtmf(callId, digit): Promise<void>;
  holdCall(callId, hold): Promise<void>;
  transferCall(callId, targetUri): Promise<void>;
  injectAudio(callId, audioBuffer, format): Promise<void>;
  healthCheck(): Promise<SipHealthCheck>;
  getActiveCalls(): CallSession[];
}
```

### 2. Intercom Connector Abstraction

**Directory:** `backend/apps/backend-api/src/modules/intercom/connectors/`

| Connector | Brand | Auto-Provision | Door Relay | Device Info |
|-----------|-------|:-:|:-:|:-:|
| `FanvilConnector` | Fanvil | Yes (CGI API) | Yes | Yes |
| `HikvisionIntercomConnector` | Hikvision | Manual | Planned | Basic |
| `DahuaIntercomConnector` | Dahua | Manual | Planned | Basic |
| `GenericSipConnector` | Any SIP | Manual | No | Basic |

**IntercomConnector contract** (`types.ts`):
```typescript
interface IntercomConnector {
  testDevice(ip, config): Promise<DeviceTestResult>;
  provisionSipAccount(ip, sipConfig): Promise<ProvisionResult>;
  getDeviceInfo(ip, credentials): Promise<IntercomDeviceInfo>;
  triggerDoorRelay(ip, credentials, relayIndex): Promise<DoorActionResult>;
  rebootDevice(ip, credentials): Promise<{success, error?}>;
  getProvisioningTemplate(sipConfig): Record<string, string>;
  getAutoProvisionUrl(deviceIp, param, value): string;
}
```

### 3. Welcome Message Orchestration

**File:** `backend/apps/backend-api/src/modules/intercom/orchestration-service.ts`

| Mode | Behavior |
|------|----------|
| **AI** | AION agent answers, collects visitor info via TTS/STT, decides access |
| **Human** | Rings operator directly, no AI involvement |
| **Mixed** | AI greets and collects info, then hands off to human for confirmation |

**Call lifecycle (mixed mode):**
```
Inbound Call → Mode Check → AI Greeting (ElevenLabs TTS)
                               ↓
                          Visitor Speaks → [STT → AION Agent]
                               ↓
                          Agent Responds → [TTS → Play to Caller]
                               ↓
                          Decision:
                            ├── Grant Access → Door Relay → End Call
                            ├── Deny Access → End Call
                            └── Handoff → Transfer to Operator
```

### 4. AION Intercom Agent

**File:** `backend/apps/backend-api/src/modules/intercom/aion-intercom-agent.ts`

- Context-aware system prompts (Spanish/English)
- Visitor info extraction (name, destination, purpose)
- Access evaluation with confidence scoring
- Automatic handoff detection (explicit request, timeout, after-hours)
- Integration with `ai-bridge` module for LLM processing (OpenAI / Anthropic)

### 5. Call Session Model

**Migration:** `backend/apps/backend-api/src/db/migrations/007_call_sessions_voip_config.sql`

Two new tables:
- `call_sessions` — Full lifecycle tracking with visitor info, AI mode, handoff, access decisions
- `voip_config` — Per-tenant SIP/PBX/orchestration configuration

### 6. Voice Integration (ElevenLabs)

Existing `voice` module provides:
- TTS synthesis in `ulaw_8000` format (optimized for VoIP/SIP)
- Greeting templates (default, after_hours, emergency, maintenance)
- Voice selection and configuration
- AION agent response synthesis

---

## API Endpoints

### Intercom Devices
| Method | Path | Description |
|--------|------|-------------|
| GET | `/intercom/devices` | List intercom devices |
| GET | `/intercom/devices/:id` | Get device details |
| POST | `/intercom/devices` | Create device |
| PATCH | `/intercom/devices/:id` | Update device |
| DELETE | `/intercom/devices/:id` | Delete device |

### Call Sessions (NEW)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/intercom/sessions` | List call sessions (filterable by device, status, mode, date) |
| GET | `/intercom/sessions/:id` | Get session details (full conversation log) |
| POST | `/intercom/sessions/initiate` | Initiate outbound call via SIP |
| POST | `/intercom/sessions/inbound` | Handle inbound call (PBX webhook) |
| PATCH | `/intercom/sessions/:id` | Update session (visitor info, status, notes) |
| POST | `/intercom/sessions/:id/end` | End call / hang up |
| POST | `/intercom/sessions/:id/handoff` | Handoff to human operator |
| GET | `/intercom/sessions/stats` | Call statistics (AI vs human, access granted, etc.) |

### Device Management (NEW)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/intercom/devices/test` | Test device reachability (HTTP ping) |
| POST | `/intercom/devices/provision` | Auto-provision SIP account on Fanvil device |
| GET | `/intercom/connectors` | List supported intercom brands |
| POST | `/intercom/door/open` | Trigger door relay on device |

### VoIP Configuration (NEW)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/intercom/voip/config` | Get VoIP/SIP configuration |
| PATCH | `/intercom/voip/config` | Update VoIP/SIP configuration |
| GET | `/intercom/voip/health` | Combined SIP + Voice health check |
| POST | `/intercom/voip/test` | Test SIP connectivity to PBX |

### Voice AI Endpoints (existing)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/voice/intercom/synthesize` | Synthesize call message (ulaw_8000) |
| POST | `/voice/greetings/generate` | Generate greeting audio by context |
| POST | `/voice/agent/synthesize` | AION agent voice response |
| GET | `/voice/greetings/templates` | List greeting templates |

---

## Environment Variables

### Backend (.env)
```env
# SIP Server (required for real calls)
SIP_HOST=192.168.1.100          # Asterisk/FreePBX IP address
SIP_PORT=5060                    # SIP signaling port
SIP_TRANSPORT=udp                # udp | tcp | tls | wss
SIP_DOMAIN=pbx.mysite.com       # SIP realm/domain

# Asterisk ARI (required for call control from backend)
SIP_ARI_URL=http://192.168.1.100:8088/ari
SIP_ARI_USERNAME=aion
SIP_ARI_PASSWORD=<secure-password>

# Fanvil device defaults
FANVIL_ADMIN_USER=admin
FANVIL_ADMIN_PASSWORD=admin

# ElevenLabs TTS (for AI greetings)
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_DEFAULT_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL_ID=eleven_multilingual_v2

# AI provider (for AION intercom agent)
OPENAI_API_KEY=sk-...            # or ANTHROPIC_API_KEY
```

### Frontend (.env)
```env
# Only needed for direct WebRTC calls from browser
VITE_SIP_SERVER=pbx.mysite.com
VITE_SIP_PORT=8089               # WSS port for WebRTC
VITE_SIP_TRANSPORT=wss
VITE_SIP_DOMAIN=pbx.mysite.com
```

---

## Database Tables

### `intercom_devices` (existing)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Tenant isolation |
| section_id | UUID | Optional section |
| name | TEXT | Device display name |
| brand | TEXT | Fanvil, Hikvision, Dahua |
| model | TEXT | Device model |
| ip_address | TEXT | Device LAN IP |
| sip_uri | TEXT | Full SIP URI |
| status | TEXT | online, offline, ringing, busy |
| config | JSONB | Device-specific config (admin creds, relay config) |

### `call_sessions` (NEW)

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Tenant isolation |
| device_id | UUID | Source intercom device |
| section_id | UUID | Section/zone |
| direction | TEXT | inbound / outbound |
| status | TEXT | initiating, ringing, answered, on_hold, completed, missed, rejected, failed, busy |
| mode | TEXT | ai / human / mixed |
| sip_call_id | TEXT | SIP Call-ID header |
| caller_uri | TEXT | Caller SIP URI |
| callee_uri | TEXT | Callee SIP URI |
| attended_by | TEXT | Operator username or 'aion-agent' |
| started_at | TIMESTAMPTZ | Call start time |
| answered_at | TIMESTAMPTZ | When answered |
| ended_at | TIMESTAMPTZ | When ended |
| duration_seconds | INT | Call duration |
| greeting_text | TEXT | AI greeting played |
| handoff_occurred | BOOLEAN | Whether AI handed off to human |
| handoff_reason | TEXT | Why handoff happened |
| visitor_name | TEXT | Collected visitor name |
| visitor_destination | TEXT | Apartment/office visited |
| dtmf_collected | TEXT | DTMF digits collected |
| access_granted | BOOLEAN | Whether door was opened |
| recording_url | TEXT | Call recording URL |
| notes | TEXT | Operator notes |
| conversation_log | JSONB | Full AI conversation turns |
| metadata | JSONB | Extra metadata |

### `voip_config` (NEW)

| Column | Type | Description |
|--------|------|-------------|
| tenant_id | UUID | One config per tenant |
| sip_host | TEXT | SIP server address |
| sip_port | INT | SIP port (default 5060) |
| sip_transport | TEXT | udp, tcp, tls, wss |
| sip_domain | TEXT | SIP domain/realm |
| pbx_type | TEXT | asterisk, freeswitch, freepbx, 3cx, cloud, none |
| ari_url | TEXT | Asterisk ARI URL |
| default_mode | TEXT | ai, human, mixed |
| greeting_context | TEXT | default, after_hours, emergency, maintenance |
| operator_extension | TEXT | Extension to ring for human mode |
| recording_enabled | BOOLEAN | Enable call recording |

---

## Asterisk Quick Setup

### /etc/asterisk/ari.conf
```ini
[general]
enabled = yes
pretty = yes

[aion]
type = user
read_only = no
password = <secure-password>
```

### /etc/asterisk/pjsip.conf
```ini
; AION trunk
[aion-transport]
type = transport
protocol = udp
bind = 0.0.0.0:5060

; Fanvil intercom template
[fanvil-template](!)
type = endpoint
context = aion-intercom
disallow = all
allow = ulaw,alaw,g722
direct_media = no
rtp_symmetric = yes

; Example: Lobby intercom
[lobby](fanvil-template)
auth = lobby-auth
aors = lobby-aor

[lobby-auth]
type = auth
auth_type = userpass
username = lobby
password = <intercom-password>

[lobby-aor]
type = aor
max_contacts = 1
```

### /etc/asterisk/extensions.conf
```ini
[aion-intercom]
exten => _X.,1,NoOp(Intercom call from ${CALLERID(all)})
 same => n,Answer()
 same => n,AGI(agi://localhost:4573/aion-inbound)
 same => n,Hangup()
```

---

## Fanvil Device Setup (Quick Start)

### Fanvil i16V / i20S

1. Access web UI: `http://<device-ip>` (default: admin/admin)
2. **SIP > SIP Account 1**: Server = `<asterisk-ip>`, Port = `5060`, User/Auth = `lobby`, Password = `<pw>`
3. **Intercom > Door**: Input Type = `DTMF`, Code = `#`, Duration = `5s`
4. **Phone > Call Features**: Auto Answer = `Enable`
5. Save and Reboot

### Auto-Provisioning via AION API
```bash
# Test device reachability
POST /intercom/devices/test
{"ipAddress": "192.168.1.50", "brand": "fanvil"}

# Provision SIP account remotely
POST /intercom/devices/provision
{"deviceId": "<uuid>", "sipUsername": "lobby", "sipPassword": "secret"}
```

---

## Supported Devices

### Fanvil (Recommended)
| Model | Type | Video | Buttons | Relay | Notes |
|-------|------|:-----:|:-------:|:-----:|-------|
| i10V | Door phone | Yes | 1 | 1 | Best value entry |
| i16V | Video intercom | Yes | 1 | 2 | Indoor/outdoor |
| i20S | Surface mount | Yes | 1-4 | 2 | Vandal-proof |
| i33V | Facial recognition | Yes | 1 | 2 | Premium |
| PA2S | Paging gateway | No | 0 | 2 | Audio only |

### Also Compatible
- Hikvision DS-KD / DS-KV series (ISAPI + SIP)
- Dahua VTO series (CGI + SIP)
- Akuvox R20/R27 series
- Any standard SIP intercom device

---

## Testing

1. Configure SIP variables in backend `.env`
2. Run migration: `007_call_sessions_voip_config.sql`
3. Register intercom devices: `POST /intercom/devices`
4. Check health: `GET /intercom/voip/health`
5. Test device reachability: `POST /intercom/devices/test`
6. Test voice synthesis: `POST /voice/intercom/synthesize`
7. Initiate test call: `POST /intercom/sessions/initiate`
8. Full end-to-end: requires Asterisk + Fanvil hardware

---

## Security Hardening (Applied)

### Module: `security-utils.ts`

New security utility module provides:

| Utility | Purpose |
|---------|---------|
| `maskPassword()` | Replace passwords with `***` in logs |
| `maskUrlCredentials()` | Strip embedded `user:pass@` from URLs |
| `stripSensitiveFields()` | Remove credential fields from API responses |
| `validateDeviceIp()` | Reject public IPs (SSRF protection) |
| `validateAriUrl()` | Reject embedded credentials in ARI URLs |
| `validateCredentialStrength()` | Warn on factory default passwords |
| `checkRateLimit()` | In-memory per-key rate limiting |
| `emitSecurityAudit()` | Structured JSON audit log entries |

### Changes Applied

1. **DB Schema** (`call-sessions.ts`): `fanvilAdminUser`/`fanvilAdminPassword` defaults removed (was `'admin'/'admin'`)
2. **SIP Provider** (`sip-provider.ts`): ARI URL validation rejects embedded creds; credentials masked in logs; health checks don't expose PBX host
3. **Fanvil Connector** (`fanvil-connector.ts`): IP validation (RFC1918 only); credential strength warnings; empty credentials rejected; audit on relay trigger
4. **Orchestration** (`orchestration-service.ts`): Rate limit on door open (5/device/min); no `'admin'` password fallback; ARI URL masked in init log; VoIP config responses stripped
5. **Routes** (`routes.ts`): Rate limits on door/provision/test; VoIP config GET strips credentials; audit events on provision and test
6. **Schemas** (`schemas.ts`): IPv4 regex on device IP; SIP username alphanumeric min 3; SIP password min 8; credentials required for device test

### Rate Limits

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /door/open` | 10 | 60s | tenant |
| `POST /door/open` | 5 | 60s | tenant:device |
| `POST /devices/test` | 20 | 60s | tenant |
| `POST /devices/provision` | 5 | 60s | tenant |

### Audit Events

All security events emit structured JSON:
```json
{"level":"audit","event":"door.open","tenantId":"...","deviceId":"...","timestamp":"..."}
```

Events: `door.open`, `door.open.denied`, `door.open.rate_limited`, `device.provision`, `device.test`, `voip.config.update`, `credential.weak_detected`, `sip.connection.success`, `sip.connection.failed`
