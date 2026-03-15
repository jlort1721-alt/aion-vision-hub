# ElevenLabs Integration

**Backend Service**: `backend/apps/backend-api/src/modules/voice/`
**Frontend Client**: `src/services/integrations/elevenlabs.ts`
**API**: ElevenLabs Text-to-Speech (`api.elevenlabs.io/v1`)

## Architecture

```
Browser (IntercomPage)
  └─ elevenlabs.ts (frontend client)
       └─ Backend /voice/* API (Fastify routes)
            └─ VoiceService
                 └─ ElevenLabsProvider (real) | NoopProvider (fallback)
                      └─ api.elevenlabs.io/v1
```

All ElevenLabs API calls are made server-side. API keys never reach the frontend.
When `ELEVENLABS_API_KEY` is not set, the system uses a silent NoOp provider and the platform continues to operate without voice synthesis.

## Environment Variables

### Backend (required for voice — `backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `ELEVENLABS_API_KEY` | Yes | — | API key from ElevenLabs dashboard |
| `ELEVENLABS_DEFAULT_VOICE_ID` | No | `21m00Tcm4TlvDq8ikWAM` | Default voice (Rachel) |
| `ELEVENLABS_MODEL_ID` | No | `eleven_multilingual_v2` | TTS model |

### Frontend (optional legacy fallback — `.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_ELEVENLABS_API_KEY` | No | Only for direct frontend fallback if backend unreachable |

## Backend API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/voice/health` | Any | Provider health check (status, quota, latency) |
| POST | `/voice/test` | Admin | Full test: health + synthesis validation |
| GET | `/voice/config` | Any | Current voice configuration |
| PATCH | `/voice/config` | Admin | Update voice settings |
| GET | `/voice/voices` | Any | List all available ElevenLabs voices |
| GET | `/voice/voices/:voiceId` | Any | Get single voice details |
| POST | `/voice/synthesize` | Operator+ | Generic TTS — returns audio binary |
| GET | `/voice/greetings/templates` | Any | List greeting templates |
| POST | `/voice/greetings/generate` | Operator+ | Generate greeting audio |
| POST | `/voice/intercom/synthesize` | Operator+ | Synthesize call message (SIP-optimized) |
| POST | `/voice/agent/synthesize` | Operator+ | AION agent voice response |

## Provider Abstraction

The `VoiceProvider` interface defines the contract:

```typescript
interface VoiceProvider {
  readonly name: string;
  isConfigured(): boolean;
  healthCheck(): Promise<VoiceHealthCheck>;
  synthesize(request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult>;
  listVoices(): Promise<VoiceInfo[]>;
  getVoice(voiceId: string): Promise<VoiceInfo | null>;
}
```

**Implementations:**
- `ElevenLabsProvider` — Real TTS via ElevenLabs API
- `NoopVoiceProvider` — Silent fallback when no provider configured

## Voice Selection

Voices are loaded from ElevenLabs API. Recommended voices for Spanish intercom:

| Voice ID | Name | Gender | Best For |
|---|---|---|---|
| `21m00Tcm4TlvDq8ikWAM` | Rachel | Female | Default greetings |
| `ErXwobaYiN019PkySvjV` | Antoni | Male | Security announcements |
| `EXAVITQu4vr4xnSDxMaL` | Bella | Female | Warm welcome messages |
| `pNInz6obpgDQGcFmaJgB` | Adam | Male | Emergency alerts |

Custom or cloned voices from your ElevenLabs account are also available.

## Greeting Templates

| Context | Spanish | English |
|---|---|---|
| `default` | Bienvenido a {siteName}. Por favor identifíquese... | Welcome to {siteName}. Please identify yourself... |
| `after_hours` | Fuera de horario de atención... | Outside business hours... |
| `emergency` | Atención. Protocolo de emergencia activado... | Attention. Emergency protocol activated... |
| `maintenance` | Sistema en mantenimiento... | System under maintenance... |

## Intercom Integration

When a call arrives at an intercom device in **AI mode**:
1. AION generates a context-appropriate greeting
2. VoiceService synthesizes audio via ElevenLabs (format: `ulaw_8000` for SIP)
3. Audio is sent to the SIP/VoIP bridge for playback
4. If mode is **mixed**, AION greets first, then transfers to human operator

## Error Handling & Fallback

1. If `ELEVENLABS_API_KEY` is not set → `NoopVoiceProvider` returns silent audio
2. If ElevenLabs API call fails → automatic fallback to NoopProvider
3. All errors are logged with `[VoiceService]` / `[ElevenLabs]` prefixes
4. Health check endpoint provides real-time status monitoring

## Quota & Pricing

| Tier | Characters/Month | Price |
|---|---|---|
| Free | 10,000 | $0 |
| Starter | 30,000 | $5/month |
| Creator | 100,000 | $22/month |
| Pro | 500,000 | $99/month |
| Scale | 2,000,000 | $330/month |

Each greeting is ~80-120 characters. Emergency broadcasts may use more.

## Testing

1. Set `ELEVENLABS_API_KEY` in `backend/.env`
2. Start backend: `cd backend && pnpm dev`
3. Navigate to Intercom > Voice AI tab
4. Click "Test Connection" → verifies API key + subscription
5. Click "Test TTS Playback" → synthesizes and plays sample audio
6. Select a voice and click play on any greeting template

### cURL Examples

```bash
# Health check
curl http://localhost:3000/voice/health -H "Authorization: Bearer $TOKEN"

# List voices
curl http://localhost:3000/voice/voices -H "Authorization: Bearer $TOKEN"

# Synthesize text
curl -X POST http://localhost:3000/voice/synthesize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Bienvenido al edificio"}' \
  --output greeting.mp3

# Generate greeting
curl -X POST http://localhost:3000/voice/greetings/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"context": "default", "language": "es", "siteName": "Torre Norte"}' \
  --output welcome.mp3
```

## Files

| File | Description |
|---|---|
| `backend/.../modules/voice/types.ts` | Provider interface, types |
| `backend/.../modules/voice/elevenlabs-provider.ts` | ElevenLabs implementation |
| `backend/.../modules/voice/noop-provider.ts` | Silent fallback provider |
| `backend/.../modules/voice/service.ts` | Voice orchestration service |
| `backend/.../modules/voice/routes.ts` | Fastify API routes |
| `backend/.../modules/voice/schemas.ts` | Zod request validation |
| `backend/.../config/env.ts` | Environment variable schema |
| `src/services/integrations/elevenlabs.ts` | Frontend client (proxies to backend) |
| `src/pages/IntercomPage.tsx` | Voice AI tab UI |
