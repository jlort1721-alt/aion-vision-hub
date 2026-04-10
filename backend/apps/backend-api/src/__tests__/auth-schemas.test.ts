import { describe, it, expect } from 'vitest';
import { loginSchema, refreshTokenSchema, verifyTokenSchema } from '../modules/auth/schemas.js';

describe('Auth Zod Schemas', () => {
  describe('loginSchema', () => {
    it('accepts valid email + password', () => {
      const result = loginSchema.safeParse({ email: 'admin@aion.dev', password: 'secret123' });
      expect(result.success).toBe(true);
    });

    it('rejects missing email', () => {
      const result = loginSchema.safeParse({ password: 'secret123' });
      expect(result.success).toBe(false);
    });

    it('rejects missing password', () => {
      const result = loginSchema.safeParse({ email: 'admin@aion.dev' });
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
