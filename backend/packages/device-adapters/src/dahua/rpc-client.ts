import { randomBytes } from "crypto";
import { request } from "undici";
import type { DeviceConnectionConfig } from "@aion/shared-contracts";
import {
  type DigestState,
  createDigestState,
  parseDigestChallenge,
  buildDigestHeader,
  resetDigestState,
} from "../shared/digest-auth.js";

export interface CGIResponse {
  statusCode: number;
  data: Record<string, string>;
  raw: string;
}

/**
 * Dahua CGI/RPC HTTP client.
 * Uses HTTP Digest authentication (RFC 2617) as required by newer Dahua firmware.
 * Falls back to Basic Auth for legacy devices that don't send a Digest challenge.
 * Parses Dahua's key=value response format.
 */
export class DahuaRPCClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private timeoutMs: number;
  private digest: DigestState;

  constructor(config: DeviceConnectionConfig, timeoutMs = 5000) {
    const protocol = config.useTls ? "https" : "http";
    this.baseUrl = `${protocol}://${config.ip}:${config.port}`;
    this.username = config.username;
    this.password = config.password;
    this.timeoutMs = timeoutMs;
    this.digest = createDigestState();
  }

  /**
   * Core request method with Digest auth (fallback to Basic for legacy devices).
   * 1. If we have cached digest params, try with digest auth first.
   * 2. On 401, parse WWW-Authenticate: if Digest → challenge-response; if Basic → use Basic.
   * 3. If the retry also returns 401, throw auth error.
   */
  private async _request(
    method: string,
    path: string,
  ): Promise<{ statusCode: number; raw: string }> {
    const url = `${this.baseUrl}${path}`;
    const uri = path;

    // If we have cached digest params, build auth header upfront
    if (this.digest.params) {
      this.digest.nonceCount++;
      const nc = this.digest.nonceCount.toString(16).padStart(8, "0");
      const cnonce = randomBytes(8).toString("hex");
      const authHeader = buildDigestHeader({
        username: this.username,
        password: this.password,
        realm: this.digest.params.realm,
        nonce: this.digest.params.nonce,
        uri,
        method,
        qop: this.digest.params.qop,
        nc,
        cnonce,
        opaque: this.digest.params.opaque,
      });

      const resp = await request(url, {
        method: method as "GET" | "POST",
        headers: { Authorization: authHeader },
        headersTimeout: this.timeoutMs,
        bodyTimeout: this.timeoutMs,
      });

      const text = await resp.body.text();

      if (resp.statusCode !== 401) {
        return { statusCode: resp.statusCode, raw: text };
      }

      // Nonce expired — fall through to re-challenge
      resetDigestState(this.digest);
    }

    // First request: send without auth to get 401 challenge
    const initialResp = await request(url, {
      method: method as "GET" | "POST",
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });

    const initialText = await initialResp.body.text();

    // If the device didn't challenge us, return as-is
    if (initialResp.statusCode !== 401) {
      return { statusCode: initialResp.statusCode, raw: initialText };
    }

    // Parse the WWW-Authenticate header
    const wwwAuth = initialResp.headers["www-authenticate"];
    const wwwAuthStr = Array.isArray(wwwAuth) ? wwwAuth[0] : wwwAuth;

    if (!wwwAuthStr) {
      throw new Error("Authentication failed: no WWW-Authenticate header");
    }

    let authHeader: string;

    if (wwwAuthStr.toLowerCase().includes("digest")) {
      // Digest auth (newer Dahua firmware)
      this.digest.params = parseDigestChallenge(wwwAuthStr);
      this.digest.nonceCount = 1;
      const nc = "00000001";
      const cnonce = randomBytes(8).toString("hex");

      authHeader = buildDigestHeader({
        username: this.username,
        password: this.password,
        realm: this.digest.params.realm,
        nonce: this.digest.params.nonce,
        uri,
        method,
        qop: this.digest.params.qop,
        nc,
        cnonce,
        opaque: this.digest.params.opaque,
      });
    } else {
      // Basic auth fallback (legacy Dahua devices)
      authHeader = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString("base64")}`;
    }

    // Retry with auth
    const retryResp = await request(url, {
      method: method as "GET" | "POST",
      headers: { Authorization: authHeader },
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });

    const retryText = await retryResp.body.text();

    if (retryResp.statusCode === 401) {
      resetDigestState(this.digest);
      throw new Error("Authentication failed: invalid credentials");
    }

    return { statusCode: retryResp.statusCode, raw: retryText };
  }

  async get(path: string): Promise<CGIResponse> {
    const { statusCode, raw } = await this._request("GET", path);

    if (statusCode === 401) {
      throw new Error("Authentication failed: invalid credentials");
    }
    if (statusCode !== 200) {
      throw new Error(`Dahua CGI ${path} returned ${statusCode}`);
    }

    return { statusCode, data: this.parseKeyValue(raw), raw };
  }

  async getRaw(path: string): Promise<{ statusCode: number; raw: string }> {
    return this._request("GET", path);
  }

  /** GET request returning binary Buffer (for snapshots/downloads) */
  async getBuffer(
    path: string,
  ): Promise<{ statusCode: number; buffer: Buffer }> {
    const url = `${this.baseUrl}${path}`;
    const uri = path;

    // Build auth header if cached
    let authHeader: string | undefined;
    if (this.digest.params) {
      this.digest.nonceCount++;
      const nc = this.digest.nonceCount.toString(16).padStart(8, "0");
      const cnonce = randomBytes(8).toString("hex");
      authHeader = buildDigestHeader({
        username: this.username,
        password: this.password,
        realm: this.digest.params.realm,
        nonce: this.digest.params.nonce,
        uri,
        method: "GET",
        qop: this.digest.params.qop,
        nc,
        cnonce,
        opaque: this.digest.params.opaque,
      });
    }

    const headers: Record<string, string> = {};
    if (authHeader) headers.Authorization = authHeader;

    const resp = await request(url, {
      method: "GET",
      headers,
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });

    if (resp.statusCode === 401 && !authHeader) {
      // Need to do digest challenge — fall back to text-based _request for challenge
      // then retry with buffer
      const textResult = await this._request("GET", path);
      if (textResult.statusCode !== 200) {
        return { statusCode: textResult.statusCode, buffer: Buffer.alloc(0) };
      }
      // Re-request with now-cached digest params
      return this.getBuffer(path);
    }

    const arrayBuf = await resp.body.arrayBuffer();
    return { statusCode: resp.statusCode, buffer: Buffer.from(arrayBuf) };
  }

  private parseKeyValue(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const eqIndex = line.indexOf("=");
      if (eqIndex > 0) {
        const key = line.substring(0, eqIndex).trim();
        const value = line.substring(eqIndex + 1).trim();
        result[key] = value;
      }
    }
    return result;
  }
}
