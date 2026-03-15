# External Integrations — AION Vision Hub

Overview of all external service integrations, their purpose, and configuration.

---

## 1. Email (Resend / SendGrid / SMTP)

**Purpose:** Send event alerts, incident reports, periodic summaries, and evidence packages.

| Item            | Details                                           |
| --------------- | ------------------------------------------------- |
| Module          | `backend/apps/backend-api/src/modules/email/`     |
| Frontend        | `src/services/integrations/email.ts`              |
| API Prefix      | `/email`                                          |
| Provider        | Resend (primary), SendGrid, or SMTP               |
| Auth            | JWT (tenant-scoped)                               |
| Audit           | All sends logged to `audit_logs` table            |
| Health Check    | `GET /email/health`                               |
| Documentation   | [EmailIntegration.md](./EmailIntegration.md)      |

**Env vars:** `RESEND_API_KEY`, `SENDGRID_API_KEY`, or `SMTP_HOST/USER/PASS`

---

## 2. WhatsApp Business API

**Purpose:** Two-way messaging, event notifications, emergency broadcasts.

| Item            | Details                                              |
| --------------- | ---------------------------------------------------- |
| Module          | `backend/apps/backend-api/src/modules/whatsapp/`     |
| Frontend        | `src/services/integrations/whatsapp.ts`               |
| API Prefix      | `/whatsapp`                                           |
| Provider        | Meta Cloud API (Graph API v21.0)                      |
| Auth            | JWT + Meta access token                               |
| Webhook         | `/webhooks/whatsapp` (public, Meta-verified)          |
| Health Check    | `GET /whatsapp?action=health`                         |

**Env vars:** `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN`

---

## 3. ElevenLabs (Text-to-Speech)

**Purpose:** AI voice synthesis for intercom and announcements.

| Item            | Details                                               |
| --------------- | ----------------------------------------------------- |
| Module          | `backend/apps/backend-api/src/modules/intercom/`      |
| Frontend        | `src/services/integrations/elevenlabs.ts`              |
| Provider        | ElevenLabs API                                         |

**Env vars:** `ELEVENLABS_API_KEY`, `ELEVENLABS_DEFAULT_VOICE_ID`, `ELEVENLABS_MODEL_ID`

---

## 4. AI Providers (OpenAI / Anthropic)

**Purpose:** AI-powered event summaries, incident analysis, chat assistant.

| Item            | Details                                               |
| --------------- | ----------------------------------------------------- |
| Module          | `backend/apps/backend-api/src/modules/ai-bridge/`     |
| Frontend        | `src/services/ai-provider.ts`                          |
| Providers       | OpenAI, Anthropic                                      |

**Env vars:** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

---

## 5. eWeLink / Sonoff (Domotics / IoT)

**Purpose:** Real-time control of Sonoff smart devices (switches, relays, lights, locks, sirens, sensors) via eWeLink Cloud API v2. **All credentials and tokens are managed exclusively by the backend.**

| Item            | Details                                                     |
| --------------- | ----------------------------------------------------------- |
| Backend Module  | `backend/apps/backend-api/src/modules/ewelink/`            |
| Frontend Client | `src/services/integrations/ewelink.ts` (thin proxy client)  |
| Hooks           | `src/hooks/use-ewelink.ts` (no tokens, status only)         |
| UI              | `src/pages/DomoticsPage.tsx`                                |
| Live View       | `src/components/liveview/LiveViewOpsPanel.tsx`               |
| API Prefix      | `/ewelink` (backend proxy to `apia.coolkit.cc`)             |
| Auth            | HMAC-SHA256 signed requests; JWT on backend endpoints       |
| Token Storage   | AES-256-GCM encrypted in `integrations` table + memory cache |
| Regions         | US, EU, AS, CN (configured in backend only)                 |
| Health Check    | `GET /ewelink/health` + `GET /ewelink/test-connection`      |
| Auth Status     | `GET /ewelink/status` (lightweight, no tokens exposed)      |
| Retries         | 3 retries with exponential backoff + jitter (via withRetry) |
| Log Sanitization| Emails masked, tokens never logged                          |
| Test Coverage   | 56 tests across 3 files (routes, service, security)         |
| Documentation   | [SonoffEwelinkIntegration.md](./SonoffEwelinkIntegration.md)|

**Backend env vars:** `EWELINK_APP_ID`, `EWELINK_APP_SECRET`, `EWELINK_REGION` (optional, default: us), `CREDENTIAL_ENCRYPTION_KEY` (required in production)

**REMOVED frontend env vars:** `VITE_EWELINK_APP_ID`, `VITE_EWELINK_APP_SECRET`, `VITE_EWELINK_REGION` — no longer exist.

**Security architecture:**
- Frontend has zero access to credentials or tokens
- All eWeLink API calls originate from backend
- Tokens encrypted at rest (AES-256-GCM) with per-tenant isolation
- Login response returns `{ success: true }` only — no tokens
- HMAC-SHA256 request signing per eWeLink v2 spec

**Limitations:** Free tier 1,000 calls/day; no native webhooks (polling-based); tokens expire ~30 days; region-locked accounts.

---

## 6. VoIP / SIP

**Purpose:** Voice intercom and emergency calls.

| Item            | Details                                               |
| --------------- | ----------------------------------------------------- |
| Module          | `backend/apps/backend-api/src/modules/voice/`          |
| Frontend        | `src/services/integrations/voip.ts`                    |

**Env vars:** `VITE_SIP_*`

---

## 7. MediaMTX (Streaming)

**Purpose:** RTSP/HLS video streaming relay.

| Item            | Details                                               |
| --------------- | ----------------------------------------------------- |
| Module          | `backend/apps/edge-gateway/`                           |
| Provider        | MediaMTX                                               |

**Env vars:** `MEDIAMTX_API_URL`, `MEDIAMTX_RTSP_PORT`

---

## Integration Testing Matrix

| Integration | Health Check Endpoint         | Test Command                           |
| ----------- | ----------------------------- | -------------------------------------- |
| Email       | `GET /email/health`           | `POST /email/test`                     |
| WhatsApp    | `GET /whatsapp?action=health` | `POST /whatsapp?action=test`           |
| AI Bridge   | N/A (per-request)             | `POST /ai?action=test`                 |
| eWeLink     | `GET /ewelink/health`         | `GET /ewelink/test-connection`         |
| Devices     | `GET /health`                 | `POST /devices?action=test-connection` |

---

## Adding a New Integration

1. Create module at `backend/apps/backend-api/src/modules/<name>/`
2. Implement: `routes.ts`, `service.ts`, `schemas.ts`
3. Register routes in `backend/apps/backend-api/src/app.ts`
4. Add env vars to `config/env.ts` and `.env.example`
5. Add `<name>` case to `integrations/service.ts` `testConnectivity()`
6. Create frontend client at `src/services/integrations/<name>.ts`
7. Add API methods to `src/services/api.ts`
8. Update this document
