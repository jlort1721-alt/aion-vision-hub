# WhatsApp Business Integration — AION Vision Hub

## Overview

Production-ready WhatsApp Business integration using the **Meta Cloud API**. Supports:

- Inbound/outbound messaging via webhook
- AI agent (auto-responses powered by configurable LLM)
- Handoff to human operator
- Quick replies and interactive buttons
- Template management (synced from Meta Business Manager)
- Delivery status tracking (sent / delivered / read / failed)
- Per-tenant isolation (multi-tenant safe)
- Conversation traceability and audit logging
- Health checks and connectivity tests

---

## Architecture

```
                              ┌────────────────────┐
                              │  Meta Cloud API     │
                              │  (graph.facebook)   │
                              └──────┬───────┬──────┘
                                     │       │
                           webhook   │       │ REST
                           (POST)    │       │ (outbound)
                                     ▼       │
┌─────────────┐  ┌──────────────────────────────────────────┐
│  WhatsApp   │  │          Backend (Fastify)                │
│  Customer   │──│                                           │
│  Phone      │  │  /webhooks/whatsapp  (public, no JWT)    │
└─────────────┘  │       │                                   │
                 │       ▼                                   │
                 │  WhatsApp Service                         │
                 │       │                                   │
                 │       ├── Provider Abstraction             │
                 │       │     └── MetaCloudAPIProvider       │
                 │       ├── AI Agent (LLM auto-response)    │
                 │       ├── Conversation Manager             │
                 │       ├── Template Manager                 │
                 │       └── Delivery Status Tracker          │
                 │                                           │
                 │  /whatsapp/*  (JWT-protected routes)      │
                 │       │                                   │
                 └───────┼───────────────────────────────────┘
                         │
                         ▼
                 ┌───────────────┐     ┌─────────────────┐
                 │  PostgreSQL   │     │  Frontend (React)│
                 │  wa_*  tables │     │  /whatsapp page  │
                 └───────────────┘     └─────────────────┘
```

---

## Backend Module Structure

```
backend/apps/backend-api/src/modules/whatsapp/
├── provider.ts     # Provider abstraction + Meta Cloud API implementation
├── service.ts      # Core business logic (send, receive, conversations, templates)
├── ai-agent.ts     # AI auto-response engine with handoff detection
├── webhook.ts      # Public webhook handler (GET verify + POST inbound)
├── routes.ts       # Protected REST API routes
└── schemas.ts      # Zod validation schemas
```

---

## Database Tables

| Table | Purpose |
|---|---|
| `wa_conversations` | Tracks each WhatsApp conversation thread |
| `wa_messages` | All inbound and outbound messages |
| `wa_templates` | Synced message templates from Meta |
| `integrations` | Stores WhatsApp config per tenant (type='whatsapp') |

Migration: `supabase/migrations/20260308040000_whatsapp_tables.sql`

All tables have tenant isolation via `tenant_id` foreign key and RLS policies.

---

## API Endpoints

### Public (No Auth)

| Method | Path | Description |
|---|---|---|
| `GET` | `/webhooks/whatsapp` | Meta webhook verification (hub.challenge) |
| `POST` | `/webhooks/whatsapp` | Inbound messages + delivery status updates |

### Protected (JWT Required)

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/whatsapp/config` | tenant_admin | Get current config (token masked) |
| `PUT` | `/whatsapp/config` | tenant_admin | Save/update config |
| `GET` | `/whatsapp/health` | tenant_admin, operator | Health check |
| `POST` | `/whatsapp/test` | tenant_admin | Send test message |
| `POST` | `/whatsapp/messages` | tenant_admin, operator | Send message |
| `POST` | `/whatsapp/messages/quick-reply` | tenant_admin, operator | Send quick reply buttons |
| `GET` | `/whatsapp/conversations` | tenant_admin, operator, viewer | List conversations |
| `GET` | `/whatsapp/conversations/:id` | tenant_admin, operator, viewer | Get conversation |
| `GET` | `/whatsapp/conversations/:id/messages` | tenant_admin, operator, viewer | Get messages |
| `POST` | `/whatsapp/conversations/handoff` | tenant_admin, operator | Handoff to human |
| `POST` | `/whatsapp/conversations/close` | tenant_admin, operator | Close conversation |
| `GET` | `/whatsapp/templates` | tenant_admin, operator | List synced templates |
| `POST` | `/whatsapp/templates/sync` | tenant_admin | Sync templates from Meta |

---

## Conversation Flow

```
Inbound Message
      │
      ▼
  ┌──────────────┐     ┌──────────────┐
  │ Find/Create  │────▶│ Save Message  │
  │ Conversation │     │  to DB        │
  └──────┬───────┘     └──────┬───────┘
         │                    │
         ▼                    ▼
  ┌──────────────┐     ┌──────────────┐
  │ Status =     │ Yes │ AI Agent     │
  │ ai_bot?      │────▶│ Responds     │
  └──────┬───────┘     └──────┬───────┘
         │ No                 │
         ▼                    ▼
  ┌──────────────┐     ┌──────────────┐
  │ Human Agent  │     │ Handoff      │
  │ Sees in UI   │     │ Keyword?     │
  └──────────────┘     └──────┬───────┘
                              │ Yes
                              ▼
                       ┌──────────────┐
                       │ Switch to    │
                       │ human_agent  │
                       └──────────────┘
```

### Conversation States

| State | Description |
|---|---|
| `ai_bot` | AI agent handles responses automatically |
| `human_agent` | Human operator manages the conversation via UI |
| `closed` | Conversation ended; new messages create a new thread |

### Handoff Keywords

The AI agent automatically triggers handoff when the customer says:
- "hablar con humano", "agente humano", "operador"
- "human", "agent", "speak to someone", "talk to a person"
- "help me", "ayuda real"

---

## Message Types Supported

| Type | Outbound | Inbound |
|---|---|---|
| `text` | Yes | Yes |
| `template` | Yes | — |
| `image` | Yes | Yes |
| `document` | Yes | Yes |
| `audio` | Yes | Yes |
| `video` | Yes | Yes |
| `interactive` (buttons/list) | Yes | Yes (reply capture) |
| `location` | — | Yes |
| `reaction` | — | Yes |

---

## Retry Logic

Failed sends are retried with progressive backoff:

| Attempt | Delay |
|---|---|
| 1 | 1 second |
| 2 | 3 seconds |
| 3 | 10 seconds |

Non-transient errors (invalid parameters, auth errors) are NOT retried.

Configurable via `maxRetries` in the WhatsApp config (0–5, default: 3).

---

## Audit Trail

Every WhatsApp action is logged to the `audit_logs` table:

| Action | When |
|---|---|
| `whatsapp.config.update` | Config saved |
| `whatsapp.health` | Health check run |
| `whatsapp.test` | Test message sent |
| `whatsapp.message.send` | Outbound message sent |
| `whatsapp.quickreply.send` | Quick reply sent |
| `whatsapp.handoff` | Conversation handed off to human |
| `whatsapp.conversation.close` | Conversation closed |
| `whatsapp.templates.sync` | Templates synced from Meta |

---

## Frontend

The WhatsApp page (`/whatsapp`) has three tabs:

1. **Conversations** — Live chat interface with message list, reply input, handoff/close buttons, and quick reply
2. **Templates** — View synced templates, trigger sync from Meta
3. **Configuration** — Full settings panel: credentials, AI agent toggle, business hours, test connection

---

## Security Considerations

- Access tokens are stored in the `integrations.config` JSONB column (server-side only)
- Tokens are masked when returned to the frontend (`****...last4`)
- Webhook verification uses a per-tenant `verifyToken` secret
- The webhook endpoint (`/webhooks/whatsapp`) is public but validates the verify token
- All protected routes require JWT + role-based access
- RLS policies enforce tenant isolation at the database level

## Security Hardening (v2)

The following production-grade security layers were added:

| Layer | Mechanism | Status |
|---|---|---|
| Signature verification | HMAC-SHA256 + timing-safe compare | Active |
| Replay protection | Timestamp validation (5-min window) | Active |
| Message deduplication | App-level check + unique DB index on `(tenant_id, wa_message_id)` | Active |
| Status deduplication | Status progression guard (sent → delivered → read) | Active |
| Rate limiting | 500 req/min per source IP (webhook-specific) | Active |
| Payload validation | Zod schema for Meta webhook structure | Active |
| Log sanitization | Phone number and message body masking | Active |
| Webhook audit trail | All events logged to `audit_logs` table | Active |
| Template validation | APPROVED status check before send | Active |
| Handoff validation | Target user existence check within tenant | Active |
| Env hardening | `WHATSAPP_APP_SECRET` required in production | Active |

### Deduplication

Messages are deduplicated at two levels:
1. **Application level**: Check for existing `wa_message_id` before insert
2. **Database level**: Unique partial index `idx_wa_messages_dedup` on `(tenant_id, wa_message_id)` WHERE `wa_message_id IS NOT NULL`

Race conditions between concurrent webhook deliveries are handled by catching PG unique violation (code 23505).

### Replay Protection

Webhook payloads with message timestamps older than 5 minutes are accepted (200 response to prevent Meta retries) but silently dropped. Clock skew tolerance: 60 seconds into the future.

### Webhook Audit Actions

| Action | Description |
|---|---|
| `whatsapp.webhook.message_received` | Inbound message(s) received via webhook |
| `whatsapp.webhook.status_update` | Delivery status update(s) received via webhook |

Webhook audit entries use system user ID `00000000-0000-0000-0000-000000000000`.

---

## Setup Steps

1. Create a Meta Business account at [business.facebook.com](https://business.facebook.com)
2. Create a Meta Developer app at [developers.facebook.com](https://developers.facebook.com)
3. Enable the **WhatsApp** product in the app dashboard
4. Add and verify a phone number
5. Create a **System User** in Business Manager > Settings > Business Settings > Users > System Users
6. Generate a **permanent access token** with `whatsapp_business_messaging` and `whatsapp_business_management` permissions
7. In the AION UI, go to `/whatsapp` > Configuration tab and enter:
   - Phone Number ID
   - Business Account ID (WABA)
   - Permanent Access Token
   - A random Verify Token (you choose this)
8. In Meta Developer Dashboard > WhatsApp > Configuration:
   - Set Callback URL to: `https://YOUR_DOMAIN/webhooks/whatsapp`
   - Set Verify Token to the same value you entered in AION
   - Subscribe to: `messages`, `message_deliveries`
9. Send a test message from the Configuration tab

---

## Limitations

- 24h messaging window for free-form messages (use templates outside window)
- Template messages required for proactive outreach
- Rate limits by messaging tier (Tier 1: 1,000 unique users/24h)
- Media files max 16MB
- Max 3 buttons per interactive quick reply
- Max 10 sections per list message
