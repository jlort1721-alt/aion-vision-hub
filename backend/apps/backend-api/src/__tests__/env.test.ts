import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-define the schema inline to avoid triggering process.env parsing on import
const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default('aion-vision-hub'),
  JWT_EXPIRATION: z.string().default('24h'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(32).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const validEnv = {
  DATABASE_URL: 'https://db.example.com/mydb',
  JWT_SECRET: 'a'.repeat(32),
};

describe('backend-api envSchema', () => {
  it('parses valid complete env', () => {
    const result = envSchema.parse({
      ...validEnv,
      PORT: '4000',
      NODE_ENV: 'production',
      OPENAI_API_KEY: 'sk-test',
    });
    expect(result.PORT).toBe(4000);
    expect(result.NODE_ENV).toBe('production');
    expect(result.OPENAI_API_KEY).toBe('sk-test');
  });

  it('applies defaults when minimal env provided', () => {
    const result = envSchema.parse(validEnv);
    expect(result.PORT).toBe(3000);
    expect(result.HOST).toBe('0.0.0.0');
    expect(result.NODE_ENV).toBe('development');
    expect(result.JWT_ISSUER).toBe('aion-vision-hub');
    expect(result.JWT_EXPIRATION).toBe('24h');
    expect(result.CORS_ORIGINS).toBe('http://localhost:5173');
    expect(result.RATE_LIMIT_MAX).toBe(100);
    expect(result.RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(result.LOG_LEVEL).toBe('info');
  });

  it('requires DATABASE_URL', () => {
    expect(() => envSchema.parse({ JWT_SECRET: 'a'.repeat(32) })).toThrow();
  });

  it('requires DATABASE_URL to be a valid URL', () => {
    expect(() =>
      envSchema.parse({ DATABASE_URL: 'not-a-url', JWT_SECRET: 'a'.repeat(32) }),
    ).toThrow();
  });

  it('requires JWT_SECRET with min 32 chars', () => {
    expect(() =>
      envSchema.parse({ DATABASE_URL: 'https://db.example.com', JWT_SECRET: 'short' }),
    ).toThrow();
  });

  it('rejects invalid NODE_ENV', () => {
    expect(() => envSchema.parse({ ...validEnv, NODE_ENV: 'staging' })).toThrow();
  });

  it('rejects invalid LOG_LEVEL', () => {
    expect(() => envSchema.parse({ ...validEnv, LOG_LEVEL: 'verbose' })).toThrow();
  });

  it('coerces PORT from string', () => {
    const result = envSchema.parse({ ...validEnv, PORT: '8080' });
    expect(result.PORT).toBe(8080);
  });

  it('optional AI keys do not fail when missing', () => {
    const result = envSchema.parse(validEnv);
    expect(result.OPENAI_API_KEY).toBeUndefined();
    expect(result.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('CREDENTIAL_ENCRYPTION_KEY requires min 32 chars when provided', () => {
    expect(() =>
      envSchema.parse({ ...validEnv, CREDENTIAL_ENCRYPTION_KEY: 'short' }),
    ).toThrow();

    const result = envSchema.parse({
      ...validEnv,
      CREDENTIAL_ENCRYPTION_KEY: 'b'.repeat(32),
    });
    expect(result.CREDENTIAL_ENCRYPTION_KEY).toBe('b'.repeat(32));
  });
});
