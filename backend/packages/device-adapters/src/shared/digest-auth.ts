import { createHash, randomBytes } from "crypto";

/**
 * Shared HTTP Digest Authentication utilities (RFC 2617).
 * Used by both Hikvision ISAPI and Dahua CGI clients.
 */

export interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
}

export interface DigestState {
  params: DigestChallenge | null;
  nonceCount: number;
}

/**
 * Parse a WWW-Authenticate: Digest header into its component parts.
 */
export function parseDigestChallenge(header: string): DigestChallenge {
  const params: Record<string, string> = {};
  const stripped = header.replace(/^Digest\s+/i, "");
  const regex = /(\w+)=(?:"([^"]*)"|([\w-]+))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(stripped)) !== null) {
    params[match[1]] = match[2] ?? match[3];
  }
  return {
    realm: params.realm ?? "",
    nonce: params.nonce ?? "",
    qop: params.qop,
    opaque: params.opaque,
    algorithm: params.algorithm,
  };
}

/**
 * Compute MD5 hex digest.
 */
export function md5(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

/**
 * Build a Digest Authorization header value.
 */
export function buildDigestHeader(params: {
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

  if (qop === "auth" || qop?.includes("auth")) {
    const nc = params.nc || "00000001";
    const cnonce = params.cnonce || randomBytes(8).toString("hex");
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
 * Create a fresh digest state for a new client instance.
 */
export function createDigestState(): DigestState {
  return { params: null, nonceCount: 0 };
}

/**
 * Generate digest auth header from cached state, incrementing nonce count.
 */
export function buildAuthFromState(
  state: DigestState,
  opts: { username: string; password: string; method: string; uri: string },
): string | null {
  if (!state.params) return null;

  state.nonceCount++;
  const nc = state.nonceCount.toString(16).padStart(8, "0");
  const cnonce = randomBytes(8).toString("hex");

  return buildDigestHeader({
    username: opts.username,
    password: opts.password,
    realm: state.params.realm,
    nonce: state.params.nonce,
    uri: opts.uri,
    method: opts.method,
    qop: state.params.qop,
    nc,
    cnonce,
    opaque: state.params.opaque,
  });
}

/**
 * Reset digest state (e.g., after auth failure or nonce expiry).
 */
export function resetDigestState(state: DigestState): void {
  state.params = null;
  state.nonceCount = 0;
}
