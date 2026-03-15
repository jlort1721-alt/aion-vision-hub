# Email Integration — AION Vision Hub

## Architecture

```
Frontend (React)                    Backend (Fastify)
┌─────────────────┐                ┌──────────────────────────────────┐
│  emailService   │ ──HTTP/JWT──▶  │  /email module                   │
│  (singleton)    │                │  ├── routes.ts (7 endpoints)     │
│                 │                │  ├── service.ts (core + audit)   │
│  emailApi       │                │  ├── schemas.ts (zod validation) │
│  (api.ts)       │                │  ├── templates.ts (5 templates)  │
└─────────────────┘                │  └── providers/                  │
                                   │      ├── base.ts (interface)     │
                                   │      ├── resend.ts ◀── PRIMARY   │
                                   │      ├── sendgrid.ts             │
                                   │      └── smtp.ts                 │
                                   └──────────────────────────────────┘
```

## Provider Priority

The service auto-selects the provider based on which env var is set (first match wins):

| Priority | Provider | Env Var Required     | Notes                    |
| -------- | -------- | -------------------- | ------------------------ |
| 1        | Resend   | `RESEND_API_KEY`     | Recommended. Best DX.    |
| 2        | SendGrid | `SENDGRID_API_KEY`   | Enterprise alternative.  |
| 3        | SMTP     | `SMTP_HOST/USER/PASS`| Requires `nodemailer`.   |

## API Endpoints

All endpoints require JWT auth. Prefix: `/email`

| Method | Path                | Role Required           | Description                    |
| ------ | ------------------- | ----------------------- | ------------------------------ |
| GET    | `/health`           | admin, operator, viewer | Provider health check          |
| POST   | `/test`             | admin                   | Send test email                |
| POST   | `/send`             | admin, operator         | Send generic email             |
| POST   | `/event-alert`      | admin, operator         | Send event alert with template |
| POST   | `/incident-report`  | admin, operator         | Send incident report           |
| POST   | `/periodic-report`  | admin, operator         | Send periodic summary report   |
| POST   | `/evidence-package` | admin, operator         | Send evidence/playback package |
| GET    | `/logs`             | admin                   | Recent send logs (in-memory)   |

## Email Templates

Five built-in HTML templates (inline CSS for email client compatibility):

1. **Event Alert** — Severity-colored badge, event details table, optional snapshot
2. **Incident Report** — Status/priority table, summary section
3. **Periodic Report** — KPI cards (events, critical, incidents, devices), top event types table
4. **Evidence Package** — Chain-of-custody header, event metadata, attachment list
5. **Test Email** — Success confirmation with timestamp

## Environment Variables

Add to `backend/.env`:

```env
# Pick ONE provider:
RESEND_API_KEY=re_xxxxxxxxxxxx
# SENDGRID_API_KEY=SG.xxxxxxxxxxxx
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=user@example.com
# SMTP_PASS=your-password

# Sender identity (optional, defaults shown):
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=AION Vision Hub
```

## Logging & Audit

### Structured Logs (pino)
Every send operation logs:
- `info` on send attempt (action, to, subject, provider)
- `info` on success (messageId, latencyMs)
- `error` on failure (error message, latencyMs)

### In-Memory Send Log
Last 200 send operations kept in memory. Accessible via `GET /email/logs`.

### Database Audit Trail
Every send writes to the `audit_logs` table with:
- `action`: `email.event_alert`, `email.incident_report`, `email.evidence_package`, etc.
- `resource`: `email`
- `details`: provider, recipients, subject, success/error, latencyMs

## Setup Guide (Resend — Recommended)

1. Create account at [resend.com](https://resend.com)
2. Add and verify your sending domain (DNS records)
3. Generate an API key at Dashboard > API Keys
4. Set `RESEND_API_KEY=re_...` in `backend/.env`
5. Set `EMAIL_FROM_ADDRESS=noreply@yourdomain.com`
6. Restart backend: `pnpm dev`
7. Test via API: `POST /email/test` with `{ "to": "your@email.com" }`

## Error Handling

- All provider errors are caught and returned as `{ success: false, error: "..." }`
- Health check failures do not crash the server
- Audit log write failures are non-blocking (logged as warning)
- 30s timeout on send operations, 10s on health checks
- Zod validation on all inputs before processing

## Frontend Usage

```typescript
import { emailService } from '@/services/integrations/email';

// Health check
const health = await emailService.healthCheck();

// Send event alert
await emailService.sendEventAlert({
  to: ['admin@company.com'],
  severity: 'critical',
  eventType: 'intrusion',
  title: 'Perimeter breach detected',
  description: 'Motion sensor triggered in Zone A',
  deviceName: 'CAM-01',
  siteName: 'Main Office',
});

// Send evidence package
await emailService.sendEvidencePackage({
  to: ['security@company.com'],
  eventId: 'uuid-here',
  eventType: 'intrusion',
  title: 'Incident Evidence',
  description: 'Attached playback clip and snapshot',
  deviceName: 'CAM-01',
  siteName: 'Main Office',
  exportedBy: 'admin@company.com',
  attachments: [{ filename: 'snapshot.jpg', content: base64Data, contentType: 'image/jpeg' }],
});

// Send periodic report
await emailService.sendPeriodicReport({
  to: ['management@company.com'],
  reportName: 'Daily Security Summary',
  period: '2026-03-08',
  totalEvents: 142,
  criticalEvents: 3,
  activeIncidents: 1,
  devicesOnline: 24,
  devicesTotal: 26,
  topEventTypes: [
    { type: 'motion', count: 89 },
    { type: 'line_crossing', count: 31 },
  ],
});

// View send logs
const logs = await emailService.getLogs(20);
```
