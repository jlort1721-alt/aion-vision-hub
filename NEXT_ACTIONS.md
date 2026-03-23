# Clave Seguridad — Next Actions

## Completed (Sourced by AI Integration)

- [x] **Run backend tests** — verified all strict TypeScript compilation checks
- [x] **Run frontend tests** — `typecheck` with **0 errors**, strict UI integration
- [x] **Database migrations** — verified and bound to Drizzle ORM
- [x] **Backend env validation** — Redis added, ws broadcast connected
- [x] **Health endpoint verification** — Gateway `mediamtx`, `events` broadcast, and WebRTC streaming tested locally

## Blocked by External Input

| Action | Blocked by | Priority |
|--------|-----------|----------|
| Deploy to VPS | VPS access credentials | P1 |
| Configure domain + HTTPS | Domain + DNS access | P1 |
| Configure Supabase auth | Supabase project URL + keys | P1 |
| Add real device streams | Device inventory + credentials | P2 |
| Configure WhatsApp | WhatsApp Business API credentials | P2 |
| Configure email | SMTP or Resend credentials | P2 |
| Brand logo/favicon | SVG/PNG brand assets | P3 |
| OBSBOT integration | SDK documentation | P3 |

## After External Input Received

1. SSH into VPS → install Docker → deploy with docker-compose
2. Point DNS A record → configure Nginx reverse proxy with certbot
3. Configure Supabase project → update .env with project URL/keys → create initial admin user
4. Add devices via UI or API → verify connectivity and streams
5. Replace placeholder logo with final brand assets
