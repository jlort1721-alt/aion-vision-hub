import { describe, it, expect } from 'vitest';
import { loginSchema, refreshTokenSchema, verifyTokenSchema } from '../modules/auth/schemas.js';

describe('Auth Zod Schemas', () => {
  describe('loginSchema', () => {
    it('accepts valid supabaseToken', () => {
      const result = loginSchema.safeParse({ supabaseToken: 'eyJhbGciOiJIUzI1NiJ9.test' });
      expect(result.success).toBe(true);
    });

    it('rejects missing supabaseToken', () => {
      const result = loginSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects empty supabaseToken', () => {
      const result = loginSchema.safeParse({ supabaseToken: '' });
      expect(result.success).toBe(false);
    });

    it('rejects non-string supabaseToken', () => {
      const result = loginSchema.safeParse({ supabaseToken: 12345 });
      expect(result.success).toBe(false);
    });

    it('rejects null body', () => {
      const result = loginSchema.safeParse(null);
      expect(result.success).toBe(false);
    });
  });

  describe('refreshTokenSchema', () => {
    it('accepts valid refreshToken', () => {
      const result = refreshTokenSchema.safeParse({ refreshToken: 'abc-def-ghi' });
      expect(result.success).toBe(true);
    });

    it('rejects missing refreshToken', () => {
      const result = refreshTokenSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects empty refreshToken', () => {
      const result = refreshTokenSchema.safeParse({ refreshToken: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('verifyTokenSchema', () => {
    it('accepts valid token', () => {
      const result = verifyTokenSchema.safeParse({ token: 'valid-token' });
      expect(result.success).toBe(true);
    });

    it('rejects empty token', () => {
      const result = verifyTokenSchema.safeParse({ token: '' });
      expect(result.success).toBe(false);
    });
  });
});
