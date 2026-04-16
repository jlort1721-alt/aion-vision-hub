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

export interface ISAPIResponse {
  statusCode: number;
  body: string;
}

/**
 * ISAPI HTTP client for Hikvision devices.
 * Uses HTTP Digest authentication (RFC 2617) as required by Hikvision firmware.
 * Falls back through: cached digest → challenge-response → error.
 */
export class ISAPIClient {
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
   * Core request method with Digest auth.
   * 1. If we have cached digest params, try with digest auth first.
   * 2. On 401, parse WWW-Authenticate, compute digest, retry.
   * 3. If the retry also returns 401, throw auth error.
   */
  private async _request(
    method: string,
    path: string,
    headers: Record<string, string>,
    reqBody?: string,
  ): Promise<ISAPIResponse> {
    const url = `${this.baseUrl}${path}`;
    const uri = path; // URI component for digest is the path

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
        method: method as "GET" | "PUT" | "POST" | "DELETE",
        headers: { ...headers, Authorization: authHeader },
        body: reqBody,
        headersTimeout: this.timeoutMs,
        bodyTimeout: this.timeoutMs,
      });

      const text = await resp.body.text();

      if (resp.statusCode !== 401) {
        return { statusCode: resp.statusCode, body: text };
      }

      // Nonce expired — fall through to re-challenge
      resetDigestState(this.digest);
    }

    // First request (or cache miss): send without auth to get 401 challenge
    const initialResp = await request(url, {
      method: method as "GET" | "PUT" | "POST" | "DELETE",
      headers,
      body: reqBody,
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });

    const initialText = await initialResp.body.text();

    if (initialResp.statusCode !== 401) {
      return { statusCode: initialResp.statusCode, body: initialText };
    }

    // Parse the WWW-Authenticate header
    const wwwAuth = initialResp.headers["www-authenticate"];
    const wwwAuthStr = Array.isArray(wwwAuth) ? wwwAuth[0] : wwwAuth;

    if (!wwwAuthStr || !wwwAuthStr.toLowerCase().includes("digest")) {
      throw new Error(
        "Authentication failed: device did not return Digest challenge",
      );
    }

    this.digest.params = parseDigestChallenge(wwwAuthStr);
    this.digest.nonceCount = 1;
    const nc = "00000001";
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

    // Retry with digest auth
    const retryResp = await request(url, {
      method: method as "GET" | "PUT" | "POST" | "DELETE",
      headers: { ...headers, Authorization: authHeader },
      body: reqBody,
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });

    const retryText = await retryResp.body.text();

    if (retryResp.statusCode === 401) {
      resetDigestState(this.digest);
      throw new Error("Authentication failed: invalid credentials");
    }

    return { statusCode: retryResp.statusCode, body: retryText };
  }

  async get(path: string): Promise<ISAPIResponse> {
    const result = await this._request("GET", path, {
      Accept: "application/xml",
    });
    if (result.statusCode !== 200) {
      throw new Error(`ISAPI GET ${path} returned ${result.statusCode}`);
    }
    return result;
  }

  async put(path: string, xmlBody: string): Promise<ISAPIResponse> {
    const result = await this._request(
      "PUT",
      path,
      { "Content-Type": "application/xml" },
      xmlBody,
    );
    if (result.statusCode !== 200) {
      throw new Error(`ISAPI PUT ${path} returned ${result.statusCode}`);
    }
    return result;
  }

  async post(path: string, xmlBody: string): Promise<ISAPIResponse> {
    const result = await this._request(
      "POST",
      path,
      { "Content-Type": "application/xml" },
      xmlBody,
    );
    return result;
  }
}
