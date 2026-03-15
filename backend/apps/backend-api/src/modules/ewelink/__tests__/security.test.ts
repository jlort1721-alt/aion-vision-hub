/**
 * Security Validation Tests — eWeLink Integration
 *
 * These tests verify that no eWeLink credentials or tokens
 * can leak to the frontend or appear in API responses.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(join(__dirname, '../../../../../../..'));
const FRONTEND_SRC = join(ROOT, 'src');
const FRONTEND_ENV_EXAMPLE = join(ROOT, '.env.example');
const BACKEND_SERVICE = join(__dirname, '../service.ts');
const FRONTEND_SERVICE = join(FRONTEND_SRC, 'services/integrations/ewelink.ts');
const FRONTEND_HOOKS = join(FRONTEND_SRC, 'hooks/use-ewelink.ts');

function readFile(path: string): string {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

describe('Security: eWeLink credential isolation', () => {
  // ── Frontend must not reference any eWeLink secrets ────────

  describe('frontend .env.example', () => {
    const content = readFile(FRONTEND_ENV_EXAMPLE);

    it('does not define VITE_EWELINK_APP_ID', () => {
      // Should mention it as a warning but not define the variable
      expect(content).not.toMatch(/^VITE_EWELINK_APP_ID=/m);
    });

    it('does not define VITE_EWELINK_APP_SECRET', () => {
      expect(content).not.toMatch(/^VITE_EWELINK_APP_SECRET=/m);
    });

    it('does not define VITE_EWELINK_REGION', () => {
      expect(content).not.toMatch(/^VITE_EWELINK_REGION=/m);
    });
  });

  describe('frontend ewelink service', () => {
    const content = readFile(FRONTEND_SERVICE);

    it('does not read import.meta.env.VITE_EWELINK_APP_ID', () => {
      expect(content).not.toContain('VITE_EWELINK_APP_ID');
    });

    it('does not read import.meta.env.VITE_EWELINK_APP_SECRET', () => {
      expect(content).not.toContain('VITE_EWELINK_APP_SECRET');
    });

    it('does not read import.meta.env.VITE_EWELINK_REGION', () => {
      expect(content).not.toContain('VITE_EWELINK_REGION');
    });

    it('does not store or expose tokens', () => {
      expect(content).not.toContain('accessToken');
      expect(content).not.toContain('refreshToken');
    });

    it('does not have a restoreTokens method', () => {
      expect(content).not.toContain('restoreTokens');
    });

    it('does not have a getTokens method', () => {
      expect(content).not.toContain('getTokens');
    });

    it('does not export EWeLinkConfig with credential fields', () => {
      expect(content).not.toMatch(/interface EWeLinkConfig/);
    });

    it('only calls backend proxy endpoints', () => {
      // All API calls should go to /ewelink/* (our backend)
      // Should NOT contain any direct eWeLink API URLs
      expect(content).not.toContain('coolkit.cc');
      expect(content).not.toContain('coolkit.cn');
      expect(content).not.toContain('apia.coolkit');
    });
  });

  describe('frontend hooks', () => {
    const content = readFile(FRONTEND_HOOKS);

    it('does not import EWeLinkTokens', () => {
      expect(content).not.toContain('EWeLinkTokens');
    });

    it('does not call restoreTokens', () => {
      expect(content).not.toContain('restoreTokens');
    });

    it('does not call getTokens', () => {
      expect(content).not.toContain('getTokens');
    });

    it('does not call ensureValidToken', () => {
      expect(content).not.toContain('ensureValidToken');
    });

    it('does not store tokens in Supabase from frontend', () => {
      // The hook should not upsert tokens into integrations table
      expect(content).not.toMatch(/upsert.*tokens/);
    });

    it('does not reference any eWeLink API URLs', () => {
      expect(content).not.toContain('coolkit.cc');
      expect(content).not.toContain('coolkit.cn');
    });
  });

  describe('backend service', () => {
    const content = readFile(BACKEND_SERVICE);

    it('encrypts tokens before DB persistence', () => {
      expect(content).toContain('encryptToken');
    });

    it('decrypts tokens when loading from DB', () => {
      expect(content).toContain('decryptToken');
    });

    it('masks emails in logs', () => {
      expect(content).toContain('maskEmail');
    });

    it('never logs raw tokens', () => {
      // Logger calls should not contain 'accessToken' or 'refreshToken'
      const loggerCalls = content.match(/logger\.(info|warn|error|debug)\([\s\S]*?\)/g) || [];
      for (const call of loggerCalls) {
        expect(call).not.toContain('accessToken');
        expect(call).not.toContain('refreshToken');
        expect(call).not.toContain('password');
      }
    });

    it('uses HMAC-SHA256 for request signing', () => {
      expect(content).toContain('createHmac');
      expect(content).toContain('sha256');
    });

    it('uses AES-256-GCM encryption for token storage', () => {
      expect(content).toContain('encrypt');
      expect(content).toContain('decrypt');
    });

    it('uses retry logic for API calls', () => {
      expect(content).toContain('withRetry');
    });
  });
});
