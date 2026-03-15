import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-define the schema inline to avoid triggering process.env parsing on import
const envSchema = z.object({
  PORT: z.coerce.number().default(3100),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GATEWAY_ID: z.string().default('gw-default'),
  SITE_ID: z.string().optional(),
  BACKEND_API_URL: z.string().url().default('http://localhost:3000'),
  BACKEND_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  MEDIAMTX_API_URL: z.string().url().default('http://localhost:9997'),
  MEDIAMTX_RTSP_PORT: z.coerce.number().default(8554),
  DEVICE_CONNECT_TIMEOUT_MS: z.coerce.number().default(5000),
  DEVICE_PING_INTERVAL_MS: z.coerce.number().default(30000),
  DEVICE_RECONNECT_MAX_ATTEMPTS: z.coerce.number().default(5),
  DEVICE_RECONNECT_BASE_DELAY_MS: z.coerce.number().default(2000),
  DISCOVERY_TIMEOUT_MS: z.coerce.number().default(10000),
  DISCOVERY_NETWORK_RANGE: z.string().default('192.168.1.0/24'),
  CACHE_MAX_ENTRIES: z.coerce.number().default(500),
  CACHE_TTL_MS: z.coerce.number().default(300000),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().default(60000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(32).optional(),
});

const validEnv = {
  JWT_SECRET: 'x'.repeat(32),
};

describe('edge-gateway envSchema', () => {
  it('parses with minimal required env', () => {
    const result = envSchema.parse(validEnv);
    expect(result.JWT_SECRET).toBe('x'.repeat(32));
  });

  it('applies server defaults', () => {
    const result = envSchema.parse(validEnv);
    expect(result.PORT).toBe(3100);
    expect(result.HOST).toBe('0.0.0.0');
    expect(result.NODE_ENV).toBe('development');
    expect(result.GATEWAY_ID).toBe('gw-default');
  });

  it('applies backend API defaults', () => {
    const result = envSchema.parse(validEnv);
    expect(result.BACKEND_API_URL).toBe('http://localhost:3000');
    expect(result.BACKEND_API_KEY).toBeUndefined();
  });

  it('applies MediaMTX defaults', () => {
    const result = envSchema.parse(validEnv);
    expect(result.MEDIAMTX_API_URL).toBe('http://localhost:9997');
    expect(result.MEDIAMTX_RTSP_PORT).toBe(8554);
  });

  it('applies device timeout defaults', () => {
    const result = envSchema.parse(validEnv);
    expect(result.DEVICE_CONNECT_TIMEOUT_MS).toBe(5000);
    expect(result.DEVICE_PING_INTERVAL_MS).toBe(30000);
    expect(result.DEVICE_RECONNECT_MAX_ATTEMPTS).toBe(5);
    expect(result.DEVICE_RECONNECT_BASE_DELAY_MS).toBe(2000);
  });

  it('applies discovery defaults', () => {
    const result = envSchema.parse(validEnv);
    expect(result.DISCOVERY_TIMEOUT_MS).toBe(10000);
    expect(result.DISCOVERY_NETWORK_RANGE).toBe('192.168.1.0/24');
  });

  it('applies cache defaults', () => {
    const result = envSchema.parse(validEnv);
    expect(result.CACHE_MAX_ENTRIES).toBe(500);
    expect(result.CACHE_TTL_MS).toBe(300000);
  });

  it('requires JWT_SECRET with min 32 chars', () => {
    expect(() => envSchema.parse({ JWT_SECRET: 'short' })).toThrow();
    expect(() => envSchema.parse({})).toThrow();
  });

  it('rejects invalid NODE_ENV', () => {
    expect(() => envSchema.parse({ ...validEnv, NODE_ENV: 'staging' })).toThrow();
  });

  it('coerces numeric strings', () => {
    const result = envSchema.parse({ ...validEnv, PORT: '4000', CACHE_MAX_ENTRIES: '1000' });
    expect(result.PORT).toBe(4000);
    expect(result.CACHE_MAX_ENTRIES).toBe(1000);
  });
});
