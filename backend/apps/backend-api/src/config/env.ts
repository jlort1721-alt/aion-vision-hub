import { z } from 'zod';
import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production';

export const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis (optional — falls back to in-memory when not configured)
  REDIS_URL: z.string().url().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('aion-vision-hub'),
  JWT_EXPIRATION: z.string().default('24h'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:5173').refine(
    (val) => !val.split(',').some((o) => o.trim() === '*'),
    { message: 'CORS_ORIGINS must not contain wildcard (*). Specify explicit origins.' },
  ),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),

  // AI providers
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // ElevenLabs TTS
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_DEFAULT_VOICE_ID: z.string().optional(),
  ELEVENLABS_MODEL_ID: z.string().default('eleven_multilingual_v2'),

  // Encryption key for credential storage — REQUIRED in production
  CREDENTIAL_ENCRYPTION_KEY: isProduction
    ? z.string().min(32, 'CREDENTIAL_ENCRYPTION_KEY is required in production (min 32 chars)')
    : z.string().min(32).optional(),

  // Email provider (pick one: resend, sendgrid, or smtp)
  RESEND_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM_ADDRESS: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().optional(),

  // WhatsApp Business API (Cloud API)
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().min(32).optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),

  // Twilio WhatsApp (alternative to Meta Cloud API)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_API_KEY_SID: z.string().optional(),
  TWILIO_API_KEY_SECRET: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),

  // SIP / VoIP / Intercom
  SIP_HOST: z.string().optional(),
  SIP_PORT: z.coerce.number().default(5060),
  SIP_TRANSPORT: z.enum(['udp', 'tcp', 'tls', 'wss']).default('udp'),
  SIP_DOMAIN: z.string().optional(),
  SIP_ARI_URL: z.string().optional(),
  SIP_ARI_USERNAME: z.string().optional(),
  SIP_ARI_PASSWORD: z.string().optional(),
  // Fanvil — no defaults. Must be explicitly configured when intercom module is used.
  FANVIL_ADMIN_USER: z.string().optional(),
  FANVIL_ADMIN_PASSWORD: z.string().optional(),

  // eWeLink / Sonoff (backend proxy — credentials MUST NOT be in frontend)
  EWELINK_APP_ID: z.string().optional(),
  EWELINK_APP_SECRET: z.string().optional(),
  EWELINK_REGION: z.enum(['us', 'eu', 'as', 'cn']).default('us'),

  // eWeLink stored accounts for auto-login (up to 2 accounts for 22 sites)
  EWELINK_EMAIL_1: z.string().email().optional(),
  EWELINK_PASSWORD_1: z.string().optional(),
  EWELINK_EMAIL_2: z.string().email().optional(),
  EWELINK_PASSWORD_2: z.string().optional(),

  // Push notifications (VAPID)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@aionvisionhub.com'),

  // IMOU / Dahua Cloud API (P2P cloud relay for XVR devices)
  IMOU_APP_ID: z.string().default(''),
  IMOU_APP_SECRET: z.string().default(''),

  // go2rtc stream gateway
  GO2RTC_URL: z.string().default('http://localhost:1984'),

  // HikConnect Cloud
  HIKCONNECT_AK: z.string().optional(),
  HIKCONNECT_SK: z.string().optional(),
  HIKCONNECT_URL: z.string().default('https://open.hikvision.com'),

  // Face Recognition service
  FACE_RECOGNITION_URL: z.string().default('http://localhost:5050'),

  // VLLM / local AI
  VLLM_API_URL: z.string().optional(),
  VLLM_MODEL: z.string().optional(),

  // Asterisk / ARI
  ASTERISK_AMI_PORT: z.coerce.number().default(5038),

  // SIP provisioning
  SIP_DEFAULT_PASSWORD: z.string().optional(),
  SIP_SERVER_ADDR: z.string().default('0.0.0.0'),

  // eWeLink MCP endpoint
  EWELINK_MCP_URL: z.string().optional(),

  // Nginx health check
  NGINX_HEALTH_URL: z.string().default('http://localhost:80'),

  // CLAVE bridge
  CLAVE_API_URL: z.string().default('http://localhost:8002/api/v1'),

  // Telegram alerts
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ALERT_CHAT_ID: z.string().optional(),

  // Sentry error tracking
  SENTRY_DSN: z.string().optional(),

  // Twilio phone (voice) & TwiML
  TWILIO_PHONE_NUMBER: z.string().optional(),       // Colombian landline (Voice only)
  TWILIO_PHONE_NUMBER_US: z.string().optional(),    // US number (Voice + SMS)
  TWILIO_TWIML_APP_SID: z.string().optional(),
  TWILIO_WEBHOOK_BASE: z.string().url().optional(),

  // Webhook secret
  WEBHOOK_SECRET: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Monitoring / Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  PROMETHEUS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  GRAFANA_ADMIN_PASSWORD: z.string().optional(),

  // MQTT
  MQTT_BROKER_URL: z.string().url().optional(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),

  // n8n
  N8N_WEBHOOK_URL: z.string().url().optional(),
  N8N_WEBHOOK_SECRET: z.string().optional(),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
