/**
 * ZKTeco Device Integration Service
 *
 * Supports three communication modes:
 *  - HTTP/REST API  (InBio / ProBio controllers via CGI endpoints)
 *  - PUSH protocol  (device → server webhook)
 *  - TCP socket     (legacy ZK protocol on port 4370, stub for future impl)
 *
 * All HTTP calls honour a per-request AbortSignal timeout so a single
 * unreachable device never blocks the event loop.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface DeviceInfo {
  serialNumber: string;
  model: string;
  firmwareVersion: string;
  platform: string;
  macAddress: string;
  ip: string;
  doorCount: number;
  readerCount: number;
  auxInputCount: number;
  auxOutputCount: number;
}

export interface ZKUser {
  id: string;
  name: string;
  privilege: number;   // 0 = user, 14 = admin
  cardNumber?: string;
  password?: string;
  enabled: boolean;
}

export interface AttendanceLog {
  userId: string;
  timestamp: Date;
  status: number;       // 0 = check-in, 1 = check-out, etc.
  verifyMethod: string; // fingerprint | card | face | password
  deviceSerial?: string;
}

export interface DoorStatus {
  door1: 'open' | 'closed' | 'unknown';
  door2?: 'open' | 'closed' | 'unknown';
}

export interface ZKPushEvent {
  serialNumber: string;
  eventTime: string;
  pin: string;         // user id on device
  cardNumber?: string;
  door: number;
  eventType: number;
  verifyMode: number;
  inOutState: number;  // 0 = in, 1 = out
}

interface ConnectResult {
  connected: boolean;
  serialNumber?: string;
  model?: string;
  error?: string;
}

interface TestResult {
  reachable: boolean;
  latencyMs: number;
}

interface EnrollResult {
  enrolled: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_HTTP_PORT = 80;
const DEFAULT_TIMEOUT_MS = 8_000;
const OPEN_DOOR_DEFAULT_SECONDS = 5;

function deviceUrl(ip: string, port: number | undefined, path: string): string {
  const p = port ?? DEFAULT_HTTP_PORT;
  const base = p === 443 ? `https://${ip}` : `http://${ip}:${p}`;
  return `${base}${path}`;
}

async function deviceFetch(
  ip: string,
  port: number | undefined,
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const url = deviceUrl(ip, port, path);
  const timeout = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse the key=value text body that ZKTeco CGI endpoints return.
 * Example:
 *   serialNumber=ABCD1234
 *   model=inBio160
 */
function parseKVBody(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of body.split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return result;
}

/**
 * Parse CSV-style user list returned by /cgi-bin/userinfo.cgi
 * Format per line: "CardNo=12345\tPin=1\tName=John\tPri=0\tPasswd=\tGrp=0\tTZ=..."
 */
function parseUserList(body: string): ZKUser[] {
  const users: ZKUser[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields: Record<string, string> = {};
    for (const pair of line.split('\t')) {
      const idx = pair.indexOf('=');
      if (idx > 0) {
        fields[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
      }
    }
    if (fields['Pin']) {
      users.push({
        id: fields['Pin'],
        name: fields['Name'] ?? '',
        privilege: parseInt(fields['Pri'] ?? '0', 10),
        cardNumber: fields['CardNo'] || undefined,
        password: fields['Passwd'] || undefined,
        enabled: fields['Verify'] !== '-1',
      });
    }
  }
  return users;
}

/**
 * Parse access/attendance log records.
 * Line format: "2024-01-15 08:30:00\t1\t1\t15\t0\t1"
 * Fields: datetime, pin, verifyMode, eventType, inOutState, workCode
 */
function parseAttendanceLogs(body: string, deviceSerial?: string): AttendanceLog[] {
  const VERIFY_METHODS: Record<string, string> = {
    '0': 'password',
    '1': 'fingerprint',
    '2': 'card',
    '3': 'password+fingerprint',
    '4': 'password+card',
    '5': 'fingerprint+card',
    '6': 'password+fingerprint+card',
    '7': 'multi-credential',
    '9': 'face',
    '15': 'face+fingerprint',
  };

  const logs: AttendanceLog[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 4) continue;
    const [datetime, pin, verifyMode, statusRaw] = parts;
    if (!datetime || !pin) continue;
    logs.push({
      userId: pin.trim(),
      timestamp: new Date(datetime.trim()),
      status: parseInt(statusRaw?.trim() ?? '0', 10),
      verifyMethod: VERIFY_METHODS[verifyMode?.trim() ?? ''] ?? 'unknown',
      deviceSerial,
    });
  }
  return logs;
}

// ── Service ──────────────────────────────────────────────────────────────────

class ZKTecoService {
  // ── Device management ─────────────────────────────────────────────────────

  /**
   * Connect to a ZKTeco device, validate reachability, and retrieve identity.
   */
  async connectDevice(ip: string, port: number): Promise<ConnectResult> {
    try {
      const info = await this.getDeviceInfo(ip, port);
      return {
        connected: true,
        serialNumber: info.serialNumber,
        model: info.model,
      };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : 'Unknown connection error',
      };
    }
  }

  /**
   * Retrieve full device information from the CGI status endpoint.
   */
  async getDeviceInfo(ip: string, port?: number): Promise<DeviceInfo> {
    const res = await deviceFetch(ip, port, '/cgi-bin/deviceinfo.cgi');
    if (!res.ok) {
      throw new Error(`Device ${ip} returned HTTP ${res.status}`);
    }
    const kv = parseKVBody(await res.text());
    return {
      serialNumber: kv['serialNumber'] ?? kv['SerialNumber'] ?? '',
      model: kv['model'] ?? kv['Model'] ?? kv['DeviceName'] ?? '',
      firmwareVersion: kv['firmwareVersion'] ?? kv['FirmwareVersion'] ?? kv['FWVersion'] ?? '',
      platform: kv['platform'] ?? kv['Platform'] ?? '',
      macAddress: kv['macAddress'] ?? kv['MACAddress'] ?? kv['MAC'] ?? '',
      ip,
      doorCount: parseInt(kv['DoorCount'] ?? kv['doorCount'] ?? '1', 10),
      readerCount: parseInt(kv['ReaderCount'] ?? kv['readerCount'] ?? '2', 10),
      auxInputCount: parseInt(kv['AuxInCount'] ?? kv['auxInCount'] ?? '0', 10),
      auxOutputCount: parseInt(kv['AuxOutCount'] ?? kv['auxOutCount'] ?? '0', 10),
    };
  }

  /**
   * Lightweight connectivity + latency test.
   */
  async testConnection(ip: string, port?: number): Promise<TestResult> {
    const start = performance.now();
    try {
      const res = await deviceFetch(ip, port, '/cgi-bin/deviceinfo.cgi', { timeoutMs: 5_000 });
      const latencyMs = Math.round(performance.now() - start);
      return { reachable: res.ok, latencyMs };
    } catch {
      const latencyMs = Math.round(performance.now() - start);
      return { reachable: false, latencyMs };
    }
  }

  // ── User / credential management ─────────────────────────────────────────

  /**
   * List all enrolled users on the device.
   */
  async getUsers(ip: string, port?: number): Promise<ZKUser[]> {
    const res = await deviceFetch(ip, port, '/cgi-bin/userinfo.cgi');
    if (!res.ok) throw new Error(`Failed to fetch users from ${ip}: HTTP ${res.status}`);
    return parseUserList(await res.text());
  }

  /**
   * Add or update a user on the device.
   */
  async addUser(
    ip: string,
    user: { id: string; name: string; privilege: number; cardNumber?: string },
    port?: number,
  ): Promise<boolean> {
    const params = new URLSearchParams({
      cmd: 'SET_USER',
      Pin: user.id,
      Name: user.name,
      Pri: String(user.privilege),
    });
    if (user.cardNumber) params.set('CardNo', user.cardNumber);

    const res = await deviceFetch(ip, port, `/cgi-bin/userinfo.cgi?${params.toString()}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to add user on ${ip}: HTTP ${res.status}`);
    const body = await res.text();
    return body.toLowerCase().includes('ok') || body.includes('200');
  }

  /**
   * Remove a user from the device.
   */
  async deleteUser(ip: string, userId: string, port?: number): Promise<boolean> {
    const params = new URLSearchParams({ cmd: 'DELETE_USER', Pin: userId });
    const res = await deviceFetch(ip, port, `/cgi-bin/userinfo.cgi?${params.toString()}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to delete user ${userId} on ${ip}: HTTP ${res.status}`);
    const body = await res.text();
    return body.toLowerCase().includes('ok') || body.includes('200');
  }

  /**
   * Start fingerprint enrollment for a user on a specific finger index (0-9).
   */
  async enrollFingerprint(
    ip: string,
    userId: string,
    fingerId: number,
    port?: number,
  ): Promise<EnrollResult> {
    if (fingerId < 0 || fingerId > 9) {
      throw new Error('fingerId must be between 0 and 9');
    }
    const params = new URLSearchParams({
      cmd: 'ENROLL_FP',
      Pin: userId,
      Fid: String(fingerId),
    });
    const res = await deviceFetch(ip, port, `/cgi-bin/fingerprint.cgi?${params.toString()}`, {
      method: 'POST',
      timeoutMs: 30_000, // enrollment takes longer – user must place finger
    });
    if (!res.ok) {
      return { enrolled: false };
    }
    const body = await res.text();
    return { enrolled: body.toLowerCase().includes('ok') || body.includes('200') };
  }

  // ── Attendance / access logs ──────────────────────────────────────────────

  /**
   * Retrieve attendance / access log records from the device.
   */
  async getAttendanceLogs(ip: string, from?: Date, port?: number): Promise<AttendanceLog[]> {
    let path = '/cgi-bin/accessrecord.cgi';
    if (from) {
      const iso = from.toISOString().slice(0, 19).replace('T', ' ');
      path += `?from=${encodeURIComponent(iso)}`;
    }
    const res = await deviceFetch(ip, port, path, { timeoutMs: 15_000 });
    if (!res.ok) throw new Error(`Failed to fetch logs from ${ip}: HTTP ${res.status}`);
    // Try to read device serial from response headers or body header line
    const body = await res.text();
    return parseAttendanceLogs(body);
  }

  /**
   * Clear all attendance logs from the device.
   */
  async clearAttendanceLogs(ip: string, port?: number): Promise<boolean> {
    const res = await deviceFetch(ip, port, '/cgi-bin/accessrecord.cgi?cmd=CLEAR', {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to clear logs on ${ip}: HTTP ${res.status}`);
    const body = await res.text();
    return body.toLowerCase().includes('ok') || body.includes('200');
  }

  // ── Door / relay control ──────────────────────────────────────────────────

  /**
   * Trigger a door open relay on the device.
   * @param doorId 1-based door index (default 1)
   * @param duration seconds to keep door unlocked (default 5)
   */
  async openDoor(
    ip: string,
    doorId: number = 1,
    duration: number = OPEN_DOOR_DEFAULT_SECONDS,
    port?: number,
  ): Promise<boolean> {
    const params = new URLSearchParams({
      cmd: 'OPEN_DOOR',
      door: String(doorId),
      time: String(duration),
    });
    const res = await deviceFetch(ip, port, `/cgi-bin/remotecontrol.cgi?${params.toString()}`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Failed to open door ${doorId} on ${ip}: HTTP ${res.status}`);
    const body = await res.text();
    return body.toLowerCase().includes('ok') || body.includes('200');
  }

  /**
   * Query current door sensor status.
   */
  async getDoorStatus(ip: string, port?: number): Promise<DoorStatus> {
    const res = await deviceFetch(ip, port, '/cgi-bin/doorstatus.cgi');
    if (!res.ok) throw new Error(`Failed to get door status from ${ip}: HTTP ${res.status}`);
    const kv = parseKVBody(await res.text());

    const mapStatus = (raw: string | undefined): 'open' | 'closed' | 'unknown' => {
      if (!raw) return 'unknown';
      const v = raw.toLowerCase();
      if (v === '1' || v === 'open') return 'open';
      if (v === '0' || v === 'closed') return 'closed';
      return 'unknown';
    };

    const status: DoorStatus = { door1: mapStatus(kv['Door1'] ?? kv['door1']) };
    const d2 = kv['Door2'] ?? kv['door2'];
    if (d2 !== undefined) {
      status.door2 = mapStatus(d2);
    }
    return status;
  }

  // ── Real-time event push ──────────────────────────────────────────────────

  /**
   * Configure the ZKTeco device to push real-time events to the given callback URL.
   */
  async enablePushEvents(ip: string, callbackUrl: string, port?: number): Promise<boolean> {
    const params = new URLSearchParams({
      cmd: 'SET_PUSH',
      url: callbackUrl,
      event: 'all',
    });
    const res = await deviceFetch(ip, port, `/cgi-bin/push.cgi?${params.toString()}`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(`Failed to enable push events on ${ip}: HTTP ${res.status}`);
    }
    const body = await res.text();
    return body.toLowerCase().includes('ok') || body.includes('200');
  }

  // ── Push event parsing ────────────────────────────────────────────────────

  /**
   * Parse a raw push event body from the ZKTeco device webhook POST.
   * Devices typically send either JSON or key-value pairs.
   */
  parsePushEvent(body: unknown): ZKPushEvent | null {
    // JSON format (newer firmware)
    if (typeof body === 'object' && body !== null) {
      const b = body as Record<string, unknown>;
      return {
        serialNumber: String(b['SN'] ?? b['serialNumber'] ?? b['sn'] ?? ''),
        eventTime: String(b['EventTime'] ?? b['time'] ?? b['eventTime'] ?? ''),
        pin: String(b['Pin'] ?? b['pin'] ?? b['UserID'] ?? b['userId'] ?? ''),
        cardNumber: b['CardNo'] ? String(b['CardNo']) : (b['cardNumber'] ? String(b['cardNumber']) : undefined),
        door: parseInt(String(b['Door'] ?? b['door'] ?? '1'), 10),
        eventType: parseInt(String(b['EventType'] ?? b['eventType'] ?? '0'), 10),
        verifyMode: parseInt(String(b['VerifyMode'] ?? b['verifyMode'] ?? '0'), 10),
        inOutState: parseInt(String(b['InOutState'] ?? b['inOutState'] ?? '0'), 10),
      };
    }

    // Key-value text format (older firmware)
    if (typeof body === 'string') {
      const kv = parseKVBody(body);
      if (!kv['SN'] && !kv['serialNumber'] && !kv['sn']) return null;
      return {
        serialNumber: kv['SN'] ?? kv['serialNumber'] ?? kv['sn'] ?? '',
        eventTime: kv['EventTime'] ?? kv['time'] ?? kv['eventTime'] ?? '',
        pin: kv['Pin'] ?? kv['pin'] ?? kv['UserID'] ?? '',
        cardNumber: kv['CardNo'] ?? kv['cardNumber'] ?? undefined,
        door: parseInt(kv['Door'] ?? kv['door'] ?? '1', 10),
        eventType: parseInt(kv['EventType'] ?? kv['eventType'] ?? '0', 10),
        verifyMode: parseInt(kv['VerifyMode'] ?? kv['verifyMode'] ?? '0', 10),
        inOutState: parseInt(kv['InOutState'] ?? kv['inOutState'] ?? '0', 10),
      };
    }

    return null;
  }
}

export const zktecoService = new ZKTecoService();
