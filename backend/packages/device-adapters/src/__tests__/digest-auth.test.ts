import { describe, it, expect } from "vitest";
import {
  parseDigestChallenge,
  md5,
  buildDigestHeader,
  createDigestState,
  buildAuthFromState,
  resetDigestState,
} from "../shared/digest-auth.js";

describe("digest-auth", () => {
  describe("md5()", () => {
    it("should compute correct MD5 hash", () => {
      expect(md5("hello")).toBe("5d41402abc4b2a76b9719d911017c592");
    });

    it("should handle empty string", () => {
      expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    });
  });

  describe("parseDigestChallenge()", () => {
    it("should parse standard Digest challenge", () => {
      const header =
        'Digest realm="Login to device", qop="auth", nonce="abc123", opaque="xyz789"';
      const result = parseDigestChallenge(header);
      expect(result.realm).toBe("Login to device");
      expect(result.qop).toBe("auth");
      expect(result.nonce).toBe("abc123");
      expect(result.opaque).toBe("xyz789");
    });

    it("should parse challenge without qop", () => {
      const header = 'Digest realm="testrealm", nonce="testnonce"';
      const result = parseDigestChallenge(header);
      expect(result.realm).toBe("testrealm");
      expect(result.nonce).toBe("testnonce");
      expect(result.qop).toBeUndefined();
      expect(result.opaque).toBeUndefined();
    });

    it("should handle unquoted values", () => {
      const header = 'Digest realm="myrealm", nonce="mynonce", algorithm=MD5';
      const result = parseDigestChallenge(header);
      expect(result.realm).toBe("myrealm");
      expect(result.algorithm).toBe("MD5");
    });
  });

  describe("buildDigestHeader()", () => {
    it("should build correct Digest header without qop", () => {
      const header = buildDigestHeader({
        username: "admin",
        password: "pass",
        realm: "testrealm",
        nonce: "testnonce",
        uri: "/path",
        method: "GET",
      });
      expect(header).toContain('Digest username="admin"');
      expect(header).toContain('realm="testrealm"');
      expect(header).toContain('nonce="testnonce"');
      expect(header).toContain('uri="/path"');
      expect(header).toContain('response="');
      expect(header).not.toContain("qop=");
    });

    it("should build correct Digest header with qop=auth", () => {
      const header = buildDigestHeader({
        username: "admin",
        password: "pass",
        realm: "testrealm",
        nonce: "testnonce",
        uri: "/path",
        method: "GET",
        qop: "auth",
        nc: "00000001",
        cnonce: "testcnonce",
      });
      expect(header).toContain("qop=auth");
      expect(header).toContain("nc=00000001");
      expect(header).toContain('cnonce="testcnonce"');
    });

    it("should include opaque when provided", () => {
      const header = buildDigestHeader({
        username: "admin",
        password: "pass",
        realm: "testrealm",
        nonce: "testnonce",
        uri: "/path",
        method: "GET",
        opaque: "myopaque",
      });
      expect(header).toContain('opaque="myopaque"');
    });

    it("should compute correct RFC 2617 response for known values", () => {
      // Known correct values from RFC 2617 example
      const ha1 = md5("admin:testrealm:pass");
      const ha2 = md5("GET:/path");
      const expectedResponse = md5(`${ha1}:testnonce:${ha2}`);

      const header = buildDigestHeader({
        username: "admin",
        password: "pass",
        realm: "testrealm",
        nonce: "testnonce",
        uri: "/path",
        method: "GET",
      });
      expect(header).toContain(`response="${expectedResponse}"`);
    });
  });

  describe("createDigestState()", () => {
    it("should create fresh state with null params and zero nonce count", () => {
      const state = createDigestState();
      expect(state.params).toBeNull();
      expect(state.nonceCount).toBe(0);
    });
  });

  describe("resetDigestState()", () => {
    it("should reset state to initial values", () => {
      const state = createDigestState();
      state.params = { realm: "r", nonce: "n" };
      state.nonceCount = 5;

      resetDigestState(state);
      expect(state.params).toBeNull();
      expect(state.nonceCount).toBe(0);
    });
  });

  describe("buildAuthFromState()", () => {
    it("should return null when no digest params cached", () => {
      const state = createDigestState();
      const result = buildAuthFromState(state, {
        username: "admin",
        password: "pass",
        method: "GET",
        uri: "/path",
      });
      expect(result).toBeNull();
    });

    it("should build auth header when state has params", () => {
      const state = createDigestState();
      state.params = { realm: "testrealm", nonce: "testnonce", qop: "auth" };

      const result = buildAuthFromState(state, {
        username: "admin",
        password: "pass",
        method: "GET",
        uri: "/path",
      });
      expect(result).toContain('Digest username="admin"');
      expect(state.nonceCount).toBe(1);
    });

    it("should increment nonce count on each call", () => {
      const state = createDigestState();
      state.params = { realm: "r", nonce: "n" };

      buildAuthFromState(state, {
        username: "a",
        password: "b",
        method: "GET",
        uri: "/",
      });
      expect(state.nonceCount).toBe(1);

      buildAuthFromState(state, {
        username: "a",
        password: "b",
        method: "GET",
        uri: "/",
      });
      expect(state.nonceCount).toBe(2);
    });
  });
});
