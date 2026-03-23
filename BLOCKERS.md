# Clave Seguridad — Blockers

## External Dependencies Needed

### Priority 1 — Blocking Production Deployment
| Item | What is needed | Who provides |
|------|---------------|-------------|
| VPS Access | Host IP, SSH user, SSH key, sudo access | Owner |
| Domain + DNS | Domain name, DNS provider login (to point A record) | Owner |
| SSL Email | Email for Let's Encrypt certificate | Owner |
| Supabase Project | Project URL + service role key (or new project creation) | Owner |

### Priority 2 — Blocking Full Functionality
| Item | What is needed | Who provides |
|------|---------------|-------------|
| WhatsApp API | Phone Number ID + Access Token (Meta Business) | Owner |
| SMTP/Email | SMTP host/port/user/pass OR Resend API key | Owner |
| Device Inventory | List of cameras/NVRs with IPs, ports, credentials, brands | Owner |
| SIP/PBX Details | PBX IP, SIP credentials, Fanvil/Grandstream config | Owner |

### Priority 3 — Enhancing but not blocking
| Item | What is needed | Who provides |
|------|---------------|-------------|
| Brand Assets | Logo SVG/PNG, favicon, brand colors for Clave Seguridad | Owner |
| OBSBOT Details | Device model, SDK docs, gesture mapping requirements | Owner |
| AI Provider Keys | OpenAI or Anthropic API key for AION assistant | Owner |
| eWeLink Credentials | App ID + App Secret for Sonoff/eWeLink devices | Owner |
