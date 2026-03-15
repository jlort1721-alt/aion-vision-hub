import { describe, it, expect } from 'vitest';
import { maskCredentialsInUrl } from '../utils/digest-auth.js';

describe('digest-auth utilities', () => {
  describe('maskCredentialsInUrl', () => {
    it('masks password in RTSP URL', () => {
      const url = 'rtsp://admin:SuperSecret123@192.168.1.100:554/Streaming/Channels/101';
      const masked = maskCredentialsInUrl(url);
      expect(masked).toBe('rtsp://admin:****@192.168.1.100:554/Streaming/Channels/101');
      expect(masked).not.toContain('SuperSecret123');
    });

    it('masks password in HTTP URL', () => {
      const url = 'http://admin:pass@10.0.0.1:80/cgi-bin/test';
      const masked = maskCredentialsInUrl(url);
      expect(masked).toBe('http://admin:****@10.0.0.1:80/cgi-bin/test');
    });

    it('handles URLs without credentials', () => {
      const url = 'rtsp://192.168.1.100:554/stream';
      const masked = maskCredentialsInUrl(url);
      expect(masked).toBe(url);
    });

    it('handles empty password', () => {
      const url = 'rtsp://admin:@192.168.1.100:554/stream';
      // Empty password between : and @ — the regex won't match empty [^@/:]+
      const masked = maskCredentialsInUrl(url);
      // Should remain unchanged since password is empty
      expect(masked).toBe(url);
    });
  });
});
