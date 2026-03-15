import { createHash, randomBytes } from 'node:crypto';
import { request, type Dispatcher } from 'undici';

/**
 * HTTP Digest Authentication client.
 *
 * Both Hikvision (ISAPI) and Dahua (CGI) require Digest Auth.
 * Basic auth will return 401 on any real device.
 *
 * Flow:
 *   1. Send request without auth → 401 + WWW-Authenticate header
 *   2. Parse nonce, realm, qop from challenge
 *   3. Compute HA1 = MD5(user:realm:pass)
 *   4. Compute HA2 = MD5(method:uri)
 *   5. Compute response = MD5(HA1:nonce:nc:cnonce:qop:HA2)
 *   6. Resend request with Authorization header
 */

interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
}

interface DigestRequestOptions {
  url: string;
  method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  username: string;
  password: string;
  body?: string;
  contentType?: string;
  timeoutMs?: number;
}

interface DigestResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

// Per-host nonce cache to avoid double-request on every call
const nonceCache = new Map<string, { challenge: DigestChallenge; nc: number }>();

function md5(data: string): string {
  return createHash('md5').update(data).digest('hex');
}

function parseWWWAuthenticate(header: string): DigestChallenge | null {
  if (!header.toLowerCase().startsWith('digest ')) return null;

  const params = header.substring(7);
  const extract = (key: string): string | undefined => {
    const regex = new RegExp(`${key}="?([^",]+)"?`, 'i');
    const match = params.match(regex);
    return match?.[1];
  };

  const realm = extract('realm');
  const nonce = extract('nonce');
  if (!realm || !nonce) return null;

  return {
    realm,
    nonce,
    qop: extract('qop'),
    opaque: extract('opaque'),
    algorithm: extract('algorithm'),
  };
}

function buildDigestHeader(
  challenge: DigestChallenge,
  method: string,
  uri: string,
  username: string,
  password: string,
  nc: number,
): string {
  const cnonce = randomBytes(8).toString('hex');
  const ncHex = nc.toString(16).padStart(8, '0');

  const ha1 = md5(`${username}:${challenge.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);

  let response: string;
  if (challenge.qop) {
    response = md5(`${ha1}:${challenge.nonce}:${ncHex}:${cnonce}:auth:${ha2}`);
  } else {
    response = md5(`${ha1}:${challenge.nonce}:${ha2}`);
  }

  let header = `Digest username="${username}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${uri}", response="${response}"`;

  if (challenge.qop) {
    header += `, qop=auth, nc=${ncHex}, cnonce="${cnonce}"`;
  }
  if (challenge.opaque) {
    header += `, opaque="${challenge.opaque}"`;
  }

  return header;
}

/**
 * Execute an HTTP request with Digest Authentication.
 *
 * Caches nonce per-host to reduce round-trips after first request.
 * Automatically retries once if nonce becomes stale.
 */
export async function digestRequest(opts: DigestRequestOptions): Promise<DigestResponse> {
  const url = new URL(opts.url);
  const uri = url.pathname + url.search;
  const hostKey = `${opts.username}@${url.host}`;
  const timeoutMs = opts.timeoutMs ?? 8000;

  const baseHeaders: Record<string, string> = {};
  if (opts.contentType) {
    baseHeaders['Content-Type'] = opts.contentType;
  }

  const requestOpts: Dispatcher.RequestOptions & { headersTimeout: number; bodyTimeout: number } = {
    origin: url.origin,
    path: uri,
    method: opts.method,
    headers: baseHeaders,
    body: opts.body,
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  };

  // Try cached nonce first
  const cached = nonceCache.get(hostKey);
  if (cached) {
    cached.nc++;
    const authHeader = buildDigestHeader(
      cached.challenge,
      opts.method,
      uri,
      opts.username,
      opts.password,
      cached.nc,
    );
    const { statusCode, body, headers } = await request(opts.url, {
      ...requestOpts,
      headers: { ...baseHeaders, Authorization: authHeader },
    });
    const text = await body.text();

    if (statusCode !== 401) {
      return { statusCode, body: text, headers: headers as any };
    }
    // Nonce stale — fall through to re-challenge
    nonceCache.delete(hostKey);
  }

  // Step 1: Initial request (expect 401)
  const { statusCode: initStatus, body: initBody, headers: initHeaders } = await request(opts.url, {
    ...requestOpts,
    headers: baseHeaders,
  });

  const initText = await initBody.text();

  if (initStatus !== 401) {
    // Some endpoints don't require auth or returned an error
    return { statusCode: initStatus, body: initText, headers: initHeaders as any };
  }

  // Step 2: Parse challenge
  const wwwAuth = (initHeaders as any)['www-authenticate'] as string | undefined;
  if (!wwwAuth) {
    throw new Error(`Digest auth: 401 without WWW-Authenticate header from ${opts.url}`);
  }

  const challenge = parseWWWAuthenticate(wwwAuth);
  if (!challenge) {
    throw new Error(`Digest auth: Failed to parse WWW-Authenticate from ${opts.url}`);
  }

  // Step 3: Retry with auth
  const nc = 1;
  const authHeader = buildDigestHeader(challenge, opts.method, uri, opts.username, opts.password, nc);
  const { statusCode, body: authBody, headers } = await request(opts.url, {
    ...requestOpts,
    headers: { ...baseHeaders, Authorization: authHeader },
  });
  const text = await authBody.text();

  // Cache nonce for future requests
  nonceCache.set(hostKey, { challenge, nc });

  if (statusCode === 401) {
    throw new Error(`Digest auth: Invalid credentials for ${opts.username}@${url.host}`);
  }

  return { statusCode, body: text, headers: headers as any };
}

/**
 * Clear cached nonces for a host (call on disconnect).
 */
export function clearDigestCache(host: string, username: string): void {
  nonceCache.delete(`${username}@${host}`);
}

/**
 * Mask credentials in a URL for logging.
 * Turns rtsp://admin:pass@1.2.3.4/... into rtsp://admin:****@1.2.3.4/...
 */
export function maskCredentialsInUrl(url: string): string {
  return url.replace(/:([^@/:]+)@/, ':****@');
}
