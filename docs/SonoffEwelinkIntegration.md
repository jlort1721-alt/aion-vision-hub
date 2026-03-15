# Sonoff / eWeLink Integration -- AION Vision Hub

**Updated:** 2026-03-08 (Production-grade backend-first architecture)

## Overview

Controls Sonoff smart devices (relays, switches, sensors, lights, locks, sirens) via the **eWeLink REST API v2** (`apia.coolkit.cc`). All credentials and tokens are managed exclusively by the backend.

## Architecture

```
  +-------------+    HTTPS/JWT     +--------------+   HMAC-SHA256    +-----------------+     Cloud     +--------------+
  |   Frontend  | ---------------> |  Backend API | --------------> | eWeLink API v2  | <----------> | Sonoff Device|
  |  (Browser)  |  /ewelink/*      |  (Fastify)   |   signed req    | (coolkit.cc)    |   WiFi/LAN   | (Physical)   |
  +-------------+                  +--------------+                 +-----------------+              +--------------+
        |                                 |
        | - No credentials               | - EWELINK_APP_ID
        | - No tokens                     | - EWELINK_APP_SECRET
        | - Auth status only              | - CREDENTIAL_ENCRYPTION_KEY
                                          | - Tokens encrypted at rest (AES-256-GCM)
                                          | - Per-tenant isolation (memory + DB)
```

### Key Design Decisions

- **Backend-first proxy**: All eWeLink API calls originate from the backend. Frontend is a thin client.
- **AES-256-GCM encryption at rest**: Tokens in `integrations` table encrypted using `CREDENTIAL_ENCRYPTION_KEY`.
- **Per-tenant token isolation**: Each tenant's tokens cached in memory and persisted encrypted in DB.
- **HMAC-SHA256 request signing**: Authentication requests signed per eWeLink v2 spec.
- **Retry with exponential backoff**: On transient failures (network errors, timeouts).
- **Sanitized logging**: Emails masked, tokens never logged.

---

## Environment Variables (Backend ONLY)

| Variable | Required | Default | Description |
|---|---|---|---|
| `EWELINK_APP_ID` | Yes | -- | eWeLink Developer App ID |
| `EWELINK_APP_SECRET` | Yes | -- | eWeLink Developer App Secret |
| `EWELINK_REGION` | No | `us` | API region: `us`, `eu`, `as`, `cn` |
| `CREDENTIAL_ENCRYPTION_KEY` | Yes (prod) | -- | AES-256 key for token encryption (min 32 chars) |

**REMOVED variables (no longer exist):**

| Variable | Status |
|---|---|
| `VITE_EWELINK_APP_ID` | REMOVED from frontend |
| `VITE_EWELINK_APP_SECRET` | REMOVED from frontend |
| `VITE_EWELINK_REGION` | REMOVED from frontend |

---

## Backend API Endpoints

All endpoints require JWT authentication. Prefixed with `/ewelink`.

| Method | Path | Description | Min Role |
|---|---|---|---|
| `GET` | `/health` | Health check (API reachability) | operator |
| `GET` | `/test-connection` | Full pipeline test (health + device fetch) | operator |
| `GET` | `/status` | Lightweight auth status | viewer |
| `POST` | `/login` | Authenticate with eWeLink | operator |
| `POST` | `/logout` | Clear session (memory + DB) | operator |
| `GET` | `/devices` | List all paired devices | viewer |
| `GET` | `/devices/:deviceId/state` | Get single device state | viewer |
| `POST` | `/devices/control` | Control device (on/off/toggle) | operator |
| `POST` | `/devices/batch` | Batch control (max 50) | operator |

---

## Auth Flow

1. User enters eWeLink email/password in Domotics page
2. Frontend POSTs to `/ewelink/login` (credentials proxied, never stored in browser)
3. Backend signs request with HMAC-SHA256, calls eWeLink `/v2/user/login`
4. eWeLink returns access_token + refresh_token
5. Backend encrypts tokens with AES-256-GCM, stores in `integrations` table
6. Frontend receives only `{ success: true }` -- no tokens
7. Subsequent calls: frontend -> backend -> eWeLink (tokens stay server-side)
8. Auto-refresh handled entirely by backend

---

## Device Types

| Model Contains | Mapped Type |
|---|---|
| `th`, `pow` | sensor |
| `4ch`, `dual` | relay |
| `mini`, `basic`, `r2`, `r3`, `rf` | switch |
| `light`, `led`, `b1`, `b2` | light |
| `lock` | lock |
| `door`, `dw` | door |
| `siren`, `alarm` | siren |
| (default) | relay |

---

## Section Mapping

Devices map to AION sections (physical locations) for grouping and bulk control. Mapping persists across syncs and is used by Live View Ops Panel for location-aware quick actions.

## Quick Actions (Live View)

- Per-device toggles (on/off for up to 6 online devices)
- Batch controls by device type (doors, sirens, lights, locks)
- All actions route through backend proxy

---

## Test Coverage

56 tests across 3 files:

| Test File | Count | Coverage |
|---|---|---|
| `routes.test.ts` | 15 | Endpoint validation, schema validation, no-leak checks |
| `service.test.ts` | 17 | Auth flow, token refresh, logout, devices, control, security |
| `security.test.ts` | 24 | File-level credential isolation verification |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Login fails with "not configured" | Missing env vars | Set `EWELINK_APP_ID` + `EWELINK_APP_SECRET` in backend/.env |
| Devices list empty | No devices paired | Pair devices using eWeLink mobile app first |
| Tokens lost after restart | Expected (memory cache) | Tokens auto-recover from encrypted DB on next request |
| Region mismatch | Wrong region configured | Match `EWELINK_REGION` to your eWeLink account region |
