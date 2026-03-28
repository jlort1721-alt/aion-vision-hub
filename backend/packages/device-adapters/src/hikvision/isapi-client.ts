import { createHash, randomBytes } from 'crypto';
import { request } from 'undici';
import type { DeviceConnectionConfig } from '@aion/shared-contracts';

export interface ISAPIResponse {
  statusCode: number;
  body: string;
}

/**
 * Parse a WWW-Authenticate: Digest header into its component parts.
 */
function parseDigestChallenge(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  // Remove "Digest " prefix
  const stripped = header.replace(/^Digest\s+/i, '');
  // Match key="value" or key=value pairs
  const regex = /(\w+)=(?:"([^"]*)"|([\w-]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(stripped)) !== null) {
    params[match[1]] = match[2] ?? match[3];
  }
  return params;
}

/**
 * Compute MD5 hex digest of a string.
 */
function md5(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

/**
 * Build a Digest Authorization header value.
 */
function buildDigestHeader(params: {
  username: string;
  password: string;
  realm: string;
  nonce: string;
  uri: string;
  method: string;
  qop?: string;
  nc?: string;
  cnonce?: string;
  opaque?: string;
}): string {
  const { username, password, realm, nonce, uri, method, qop, opaque } = params;
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);

  let response: string;
  let headerParts: string;

  if (qop === 'auth' || qop?.includes('auth')) {
    const nc = params.nc || '00000001';
    const cnonce = params.cnonce || randomBytes(8).toString('hex');
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:auth:${ha2}`);
    headerParts = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=auth, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
    headerParts = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  }

  if (opaque) {
    headerParts += `, opaque="${opaque}"`;
  }

  return headerParts;
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

  /** Cached digest challenge params from the last 401 response */
  private digestParams: Record<string, string> | null = null;
  /** Incrementing nonce count for digest auth */
  private nonceCount = 0;

  constructor(config: DeviceConnectionConfig, timeoutMs = 5000) {
    const protocol = config.useTls ? 'https' : 'http';
    this.baseUrl = `${protocol}://${config.ip}:${config.port}`;
    this.username = config.username;
    this.password = config.password;
    this.timeoutMs = timeoutMs;
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
    if (this.digestParams) {
      this.nonceCount++;
      const nc = this.nonceCount.toString(16).padStart(8, '0');
      const cnonce = randomBytes(8).toString('hex');
      const authHeader = buildDigestHeader({
        username: this.username,
        password: this.password,
        realm: this.digestParams.realm,
        nonce: this.digestParams.nonce,
        uri,
        method,
        qop: this.digestParams.qop,
        nc,
        cnonce,
        opaque: this.digestParams.opaque,
      });

      const resp = await request(url, {
        method: method as 'GET' | 'PUT' | 'POST' | 'DELETE',
        headers: { ...headers, Authorization: authHeader },
        body: reqBody,
        headersTimeout: this.timeoutMs,
        bodyTimeout: this.timeoutMs,
      });

      const text = await resp.body.text();

      // If cached nonce is still valid, return
      if (resp.statusCode !== 401) {
        return { statusCode: resp.statusCode, body: text };
      }

      // Nonce expired — fall through to re-challenge
      this.digestParams = null;
      this.nonceCount = 0;
    }

    // First request (or cache miss): send without auth to get 401 challenge
    const initialResp = await request(url, {
      method: method as 'GET' | 'PUT' | 'POST' | 'DELETE',
      headers,
      body: reqBody,
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });

    const initialText = await initialResp.body.text();

    // If the device didn't challenge us, return as-is
    if (initialResp.statusCode !== 401) {
      return { statusCode: initialResp.statusCode, body: initialText };
    }

    // Parse the WWW-Authenticate header
    const wwwAuth = initialResp.headers['www-authenticate'];
    const wwwAuthStr = Array.isArray(wwwAuth) ? wwwAuth[0] : wwwAuth;

    if (!wwwAuthStr || !wwwAuthStr.toLowerCase().includes('digest')) {
      throw new Error('Authentication failed: device did not return Digest challenge');
    }

    this.digestParams = parseDigestChallenge(wwwAuthStr);
    this.nonceCount = 1;
    const nc = '00000001';
    const cnonce = randomBytes(8).toString('hex');

    const authHeader = buildDigestHeader({
      username: this.username,
      password: this.password,
      realm: this.digestParams.realm,
      nonce: this.digestParams.nonce,
      uri,
      method,
      qop: this.digestParams.qop,
      nc,
      cnonce,
      opaque: this.digestParams.opaque,
    });

    // Retry with digest auth
    const retryResp = await request(url, {
      method: method as 'GET' | 'PUT' | 'POST' | 'DELETE',
      headers: { ...headers, Authorization: authHeader },
      body: reqBody,
      headersTimeout: this.timeoutMs,
      bodyTimeout: this.timeoutMs,
    });

    const retryText = await retryResp.body.text();

    if (retryResp.statusCode === 401) {
      // Invalidate cached params on auth failure
      this.digestParams = null;
      this.nonceCount = 0;
      throw new Error('Authentication failed: invalid credentials');
    }

    return { statusCode: retryResp.statusCode, body: retryText };
  }

  async get(path: string): Promise<ISAPIResponse> {
    const result = await this._request('GET', path, { Accept: 'application/xml' });
    if (result.statusCode !== 200) {
      throw new Error(`ISAPI GET ${path} returned ${result.statusCode}`);
    }
    return result;
  }

  async put(path: string, xmlBody: string): Promise<ISAPIResponse> {
    const result = await this._request('PUT', path, { 'Content-Type': 'application/xml' }, xmlBody);
    if (result.statusCode !== 200) {
      throw new Error(`ISAPI PUT ${path} returned ${result.statusCode}`);
    }
    return result;
  }

  async post(path: string, xmlBody: string): Promise<ISAPIResponse> {
    const result = await this._request('POST', path, { 'Content-Type': 'application/xml' }, xmlBody);
    return result;
  }
}
