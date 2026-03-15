import { z } from 'zod';
import 'dotenv/config';

export const envSchema = z.object({
  PORT: z.coerce.number().default(3100),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // ── Supabase ──
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),

  // ── Security ──
  JWT_SECRET: z.string().min(32),
  CREDENTIAL_ENCRYPTION_KEY: z.string().default('aion-change-me-in-production'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // ── MediaMTX ──
  MEDIAMTX_API_URL: z.string().url().default('http://localhost:9997'),
  MEDIAMTX_WEBRTC_PORT: z.coerce.number().default(8889),
  MEDIAMTX_HLS_PORT: z.coerce.number().default(8888),
  MEDIAMTX_RTSP_PORT: z.coerce.number().default(8554),

  // ── Device timeouts ──
  DEVICE_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  DEVICE_PING_INTERVAL_MS: z.coerce.number().default(30000),
  DEVICE_REQUEST_TIMEOUT_MS: z.coerce.number().default(8000),

  // ── Discovery ──
  DISCOVERY_TIMEOUT_MS: z.coerce.number().default(10000),
  DISCOVERY_NETWORK_RANGE: z.string().default('192.168.1.0/24'),

  // ── Event ingestion ──
  EVENT_FLUSH_INTERVAL_MS: z.coerce.number().default(5000),
  EVENT_BUFFER_MAX_SIZE: z.coerce.number().default(500),
  EVENT_LISTENER_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),

  // ── Reconnection ──
  RECONNECT_MAX_ATTEMPTS: z.coerce.number().default(10),
  RECONNECT_BASE_DELAY_MS: z.coerce.number().default(5000),
  RECONNECT_MAX_DELAY_MS: z.coerce.number().default(300000),

  // ── Logging ──
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
