import { z } from 'zod';
import 'dotenv/config';

export const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3100),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GATEWAY_ID: z.string().default('gw-default'),
  SITE_ID: z.string().optional(),

  // Backend API (cloud)
  BACKEND_API_URL: z.string().url().default('http://localhost:3000'),
  BACKEND_API_KEY: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // MediaMTX (RTSP → WebRTC proxy)
  MEDIAMTX_API_URL: z.string().url().default('http://localhost:9997'),
  MEDIAMTX_RTSP_PORT: z.coerce.number().default(8554),

  // Device timeouts
  DEVICE_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  DEVICE_PING_INTERVAL_MS: z.coerce.number().default(30000),
  DEVICE_RECONNECT_MAX_ATTEMPTS: z.coerce.number().default(5),
  DEVICE_RECONNECT_BASE_DELAY_MS: z.coerce.number().default(2000),

  // Discovery
  DISCOVERY_TIMEOUT_MS: z.coerce.number().default(10000),
  DISCOVERY_NETWORK_RANGE: z.string().default('192.168.1.0/24'),

  // Cache
  CACHE_MAX_ENTRIES: z.coerce.number().default(500),
  CACHE_TTL_MS: z.coerce.number().default(300000),

  // Heartbeat
  HEARTBEAT_INTERVAL_MS: z.coerce.number().default(60000),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Credential encryption — REQUIRED in production
  CREDENTIAL_ENCRYPTION_KEY: process.env.NODE_ENV === 'production'
    ? z.string().min(32, 'CREDENTIAL_ENCRYPTION_KEY is required in production (min 32 chars)')
    : z.string().min(32).optional(),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
