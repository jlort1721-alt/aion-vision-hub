/**
 * Network Scanner Service
 *
 * Comprehensive network scanning for security device discovery:
 * - TCP port scanning (single host, range, CIDR)
 * - ONVIF WS-Discovery multicast
 * - Device brand identification via HTTP fingerprinting
 * - ARP table parsing for MAC/vendor lookup
 * - Local network interface enumeration
 */

import net from 'net';
import os from 'os';
import dgram from 'dgram';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ── Types ──────────────────────────────────────────────────────────────────

export interface PortResult {
  port: number;
  service: string;
  open: boolean;
  latencyMs: number | null;
}

export interface HostScanResult {
  ip: string;
  hostname: string | null;
  ports: PortResult[];
  os_hint: string | null;
  brand_hint: string | null;
}

export interface OnvifDevice {
  urn: string;
  name: string | null;
  xaddrs: string[];
  scopes: string[];
  ip: string | null;
}

export interface DeviceIdentification {
  ip: string;
  port: number;
  brand: string | null;
  model: string | null;
  server: string | null;
  title: string | null;
  onvifCapable: boolean;
}

export interface ArpEntry {
  ip: string;
  mac: string;
  vendor?: string;
}

export interface NetworkInterface {
  name: string;
  ip: string;
  netmask: string;
  cidr: string;
}

// ── Well-known security device ports ───────────────────────────────────────

const SECURITY_PORTS: Array<{ port: number; service: string }> = [
  { port: 22, service: 'SSH' },
  { port: 80, service: 'HTTP' },
  { port: 443, service: 'HTTPS' },
  { port: 554, service: 'RTSP' },
  { port: 4370, service: 'ZKTeco' },
  { port: 5060, service: 'SIP' },
  { port: 8000, service: 'Hikvision SDK' },
  { port: 8080, service: 'Alt HTTP' },
  { port: 8443, service: 'Alt HTTPS' },
  { port: 8554, service: 'RTSP Alt' },
  { port: 9997, service: 'MediaMTX' },
  { port: 37020, service: 'SADP Discovery' },
  { port: 37777, service: 'Dahua SDK' },
  { port: 37810, service: 'Dahua Discovery' },
];

// ── CIDR / Range Parsing ──────────────────────────────────────────────────

function ipToLong(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function longToIp(long: number): string {
  return [
    (long >>> 24) & 0xff,
    (long >>> 16) & 0xff,
    (long >>> 8) & 0xff,
    long & 0xff,
  ].join('.');
}

/**
 * Parse a CIDR notation (e.g. 192.168.1.0/24) into an array of host IPs.
 * Excludes network address and broadcast address for /24 and larger.
 */
function parseCIDR(cidr: string): string[] {
  const [baseIp, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR prefix: ${prefixStr}`);
  }

  const baseNum = ipToLong(baseIp);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const networkAddr = (baseNum & mask) >>> 0;
  const broadcastAddr = (networkAddr | (~mask >>> 0)) >>> 0;

  const ips: string[] = [];
  // For /31 and /32, include all addresses
  if (prefix >= 31) {
    for (let i = networkAddr; i <= broadcastAddr; i++) {
      ips.push(longToIp(i));
    }
  } else {
    // Exclude network and broadcast
    for (let i = networkAddr + 1; i < broadcastAddr; i++) {
      ips.push(longToIp(i));
    }
  }

  return ips;
}

/**
 * Parse an IP range string. Supports:
 * - CIDR: 192.168.1.0/24
 * - Dash range: 192.168.1.1-192.168.1.50
 * - Dash range shorthand: 192.168.1.1-50
 */
function parseRange(range: string): string[] {
  range = range.trim();

  // CIDR notation
  if (range.includes('/')) {
    return parseCIDR(range);
  }

  // Dash range
  if (range.includes('-')) {
    const [startPart, endPart] = range.split('-');
    const startIp = startPart.trim();
    let endIp = endPart.trim();

    // Shorthand: 192.168.1.1-50 → 192.168.1.1-192.168.1.50
    if (!endIp.includes('.')) {
      const prefix = startIp.substring(0, startIp.lastIndexOf('.') + 1);
      endIp = prefix + endIp;
    }

    const startNum = ipToLong(startIp);
    const endNum = ipToLong(endIp);

    if (endNum < startNum) {
      throw new Error(`Invalid range: end (${endIp}) is before start (${startIp})`);
    }
    if (endNum - startNum > 65534) {
      throw new Error('Range too large: maximum 65534 hosts');
    }

    const ips: string[] = [];
    for (let i = startNum; i <= endNum; i++) {
      ips.push(longToIp(i));
    }
    return ips;
  }

  // Single IP
  return [range];
}

// ── Concurrency limiter ───────────────────────────────────────────────────

async function parallelLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < tasks.length) {
      const taskIdx = idx++;
      results[taskIdx] = await tasks[taskIdx]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── NetworkScanner class ──────────────────────────────────────────────────

export class NetworkScanner {

  // ── TCP port scan ─────────────────────────────────────────────────────

  /**
   * Probe a single TCP port on a host.
   */
  async scanPort(
    host: string,
    port: number,
    timeoutMs = 3000,
  ): Promise<{ open: boolean; latencyMs: number }> {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);

      socket.on('connect', () => {
        const latencyMs = Date.now() - start;
        socket.destroy();
        resolve({ open: true, latencyMs });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ open: false, latencyMs: Date.now() - start });
      });

      socket.on('error', () => {
        socket.destroy();
        resolve({ open: false, latencyMs: Date.now() - start });
      });

      socket.connect(port, host);
    });
  }

  // ── Host scan (all common security ports) ─────────────────────────────

  /**
   * Scan all well-known security device ports on a host.
   */
  async scanHost(host: string, options?: { ports?: Array<{ port: number; service: string }>; timeout?: number }): Promise<HostScanResult> {
    const portsToScan = options?.ports ?? SECURITY_PORTS;
    const timeout = options?.timeout ?? 3000;

    const portResults = await Promise.all(
      portsToScan.map(async ({ port, service }) => {
        const result = await this.scanPort(host, port, timeout);
        return {
          port,
          service,
          open: result.open,
          latencyMs: result.open ? result.latencyMs : null,
        };
      }),
    );

    // Derive brand hint from open ports
    let brand_hint: string | null = null;
    const openPorts = new Set(portResults.filter((p) => p.open).map((p) => p.port));

    if (openPorts.has(8000) || openPorts.has(37020)) brand_hint = 'Hikvision';
    else if (openPorts.has(37777) || openPorts.has(37810)) brand_hint = 'Dahua';
    else if (openPorts.has(4370)) brand_hint = 'ZKTeco';

    // OS hint from common ports
    let os_hint: string | null = null;
    if (openPorts.has(22) && !openPorts.has(554)) os_hint = 'Linux/Unix';
    else if (openPorts.has(554) || openPorts.has(8000) || openPorts.has(37777)) os_hint = 'Embedded/RTOS';

    return {
      ip: host,
      hostname: null,
      ports: portResults,
      os_hint,
      brand_hint,
    };
  }

  // ── Range scan ────────────────────────────────────────────────────────

  /**
   * Scan a range of IPs (CIDR or dash-range notation).
   */
  async scanRange(
    range: string,
    options?: { ports?: number[]; concurrency?: number; timeout?: number },
  ): Promise<HostScanResult[]> {
    const ips = parseRange(range);
    const concurrency = options?.concurrency ?? 20;
    const timeout = options?.timeout ?? 3000;

    // If specific ports provided, build custom port list
    const customPorts = options?.ports
      ? options.ports.map((p) => ({
          port: p,
          service: SECURITY_PORTS.find((sp) => sp.port === p)?.service ?? `TCP/${p}`,
        }))
      : undefined;

    const tasks = ips.map((ip) => () => this.scanHost(ip, { ports: customPorts, timeout }));
    const allResults = await parallelLimit(tasks, concurrency);

    // Return only hosts with at least one open port
    return allResults.filter((r) => r.ports.some((p) => p.open));
  }

  // ── ONVIF WS-Discovery ───────────────────────────────────────────────

  /**
   * Send WS-Discovery multicast probe and collect ONVIF device responses.
   */
  async discoverOnvif(timeout = 5000): Promise<OnvifDevice[]> {
    const MULTICAST_ADDR = '239.255.255.250';
    const MULTICAST_PORT = 3702;

    const probeId = `uuid:${crypto.randomUUID()}`;
    const probeXml = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"',
      '  xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"',
      '  xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery"',
      '  xmlns:dn="http://www.onvif.org/ver10/network/wsdl">',
      '  <soap:Header>',
      `    <wsa:MessageID>${probeId}</wsa:MessageID>`,
      '    <wsa:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>',
      '    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>',
      '  </soap:Header>',
      '  <soap:Body>',
      '    <wsd:Probe>',
      '      <wsd:Types>dn:NetworkVideoTransmitter</wsd:Types>',
      '    </wsd:Probe>',
      '  </soap:Body>',
      '</soap:Envelope>',
    ].join('\n');

    return new Promise((resolve) => {
      const devices: OnvifDevice[] = [];
      const seen = new Set<string>();
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      const timer = setTimeout(() => {
        socket.close();
        resolve(devices);
      }, timeout);

      socket.on('message', (msg) => {
        try {
          const xml = msg.toString();

          // Parse URN
          const urnMatch = xml.match(/<wsa:Address>(urn:[^<]+)<\/wsa:Address>/);
          const urn = urnMatch?.[1] ?? '';
          if (seen.has(urn)) return;
          seen.add(urn);

          // Parse XAddrs
          const xaddrsMatch = xml.match(/<(?:\w+:)?XAddrs>([^<]+)<\/(?:\w+:)?XAddrs>/);
          const xaddrs = xaddrsMatch?.[1]?.split(/\s+/) ?? [];

          // Parse scopes
          const scopesMatch = xml.match(/<(?:\w+:)?Scopes>([^<]+)<\/(?:\w+:)?Scopes>/);
          const scopes = scopesMatch?.[1]?.split(/\s+/) ?? [];

          // Extract IP from XAddrs
          let ip: string | null = null;
          for (const addr of xaddrs) {
            const ipMatch = addr.match(/\/\/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch) {
              ip = ipMatch[1];
              break;
            }
          }

          // Extract name from scopes
          let name: string | null = null;
          for (const scope of scopes) {
            const nameMatch = scope.match(/onvif:\/\/www\.onvif\.org\/name\/(.+)/);
            if (nameMatch) {
              name = decodeURIComponent(nameMatch[1]);
              break;
            }
          }

          devices.push({ urn, name, xaddrs, scopes, ip });
        } catch {
          // Ignore malformed responses
        }
      });

      socket.on('error', () => {
        clearTimeout(timer);
        socket.close();
        resolve(devices);
      });

      socket.bind(0, () => {
        try {
          socket.addMembership(MULTICAST_ADDR);
        } catch {
          // Membership may fail if interface doesn't support multicast
        }
        const buf = Buffer.from(probeXml, 'utf-8');
        socket.send(buf, 0, buf.length, MULTICAST_PORT, MULTICAST_ADDR);
      });
    });
  }

  // ── Device identification via HTTP fingerprint ────────────────────────

  /**
   * Identify a device brand/model by probing its HTTP endpoint.
   */
  async identifyDevice(host: string, port = 80): Promise<DeviceIdentification> {
    const result: DeviceIdentification = {
      ip: host,
      port,
      brand: null,
      model: null,
      server: null,
      title: null,
      onvifCapable: false,
    };

    // Try HTTP probe
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const url = port === 443 || port === 8443
        ? `https://${host}:${port}/`
        : `http://${host}:${port}/`;

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'ClaveSeguridad/1.0 NetworkScanner' },
      });
      clearTimeout(timer);

      result.server = response.headers.get('server');
      const body = await response.text();

      // Extract HTML title
      const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) result.title = titleMatch[1].trim();

      // Brand identification
      const bodyUpper = body.toUpperCase();
      const serverUpper = (result.server ?? '').toUpperCase();
      const combinedText = `${bodyUpper} ${serverUpper}`;

      if (combinedText.includes('DNVRS-WEBS') || combinedText.includes('APP-WEBS') ||
          combinedText.includes('HIKVISION') || combinedText.includes('HIKDIGITAL')) {
        result.brand = 'Hikvision';
      } else if (combinedText.includes('DH_WEB') || combinedText.includes('DAHUA') ||
                 combinedText.includes('DHI-') || combinedText.includes('DH-')) {
        result.brand = 'Dahua';
      } else if (combinedText.includes('ZKTECO') || combinedText.includes('ZK WEB') ||
                 combinedText.includes('ZKBIO')) {
        result.brand = 'ZKTeco';
      } else if (combinedText.includes('AXIS') || combinedText.includes('VAPIX')) {
        result.brand = 'Axis';
      } else if (combinedText.includes('VIVOTEK') || combinedText.includes('VAST')) {
        result.brand = 'Vivotek';
      } else if (combinedText.includes('HANWHA') || combinedText.includes('WISENET') ||
                 combinedText.includes('SAMSUNG TECHWIN')) {
        result.brand = 'Hanwha';
      } else if (combinedText.includes('UNIVIEW') || combinedText.includes('UNV')) {
        result.brand = 'Uniview';
      }

      // Try to extract model from common patterns
      const modelMatch = body.match(/(?:model|device)["\s:=]+["']?([A-Z0-9][\w-]{2,30})/i);
      if (modelMatch) result.model = modelMatch[1];

    } catch {
      // HTTP probe failed — device may not have a web interface on this port
    }

    // Try ONVIF GetCapabilities to check ONVIF support
    try {
      const onvifPort = port === 80 ? 80 : port;
      const onvifUrl = `http://${host}:${onvifPort}/onvif/device_service`;
      const soapEnvelope = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"',
        '  xmlns:tds="http://www.onvif.org/ver10/device/wsdl">',
        '  <soap:Body>',
        '    <tds:GetCapabilities>',
        '      <tds:Category>All</tds:Category>',
        '    </tds:GetCapabilities>',
        '  </soap:Body>',
        '</soap:Envelope>',
      ].join('\n');

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);

      const onvifResp = await fetch(onvifUrl, {
        method: 'POST',
        body: soapEnvelope,
        headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      const onvifBody = await onvifResp.text();
      if (onvifBody.includes('GetCapabilitiesResponse') || onvifBody.includes('Capabilities')) {
        result.onvifCapable = true;
      }
    } catch {
      // ONVIF not available
    }

    return result;
  }

  // ── ARP table ─────────────────────────────────────────────────────────

  /**
   * Read the local ARP table for IP → MAC mappings.
   */
  async getArpTable(): Promise<ArpEntry[]> {
    const entries: ArpEntry[] = [];

    try {
      const { stdout } = await execAsync('arp -a', { timeout: 10000 });
      const lines = stdout.split('\n');

      for (const line of lines) {
        // macOS/Linux: host (192.168.1.1) at aa:bb:cc:dd:ee:ff [ether] on en0
        const macLinux = line.match(
          /\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-fA-F:.-]{11,17})/,
        );
        if (macLinux) {
          entries.push({ ip: macLinux[1], mac: macLinux[2].toLowerCase() });
          continue;
        }

        // Windows: 192.168.1.1    aa-bb-cc-dd-ee-ff    dynamic
        const macWin = line.match(
          /(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F-]{17})\s+/,
        );
        if (macWin) {
          entries.push({ ip: macWin[1], mac: macWin[2].replace(/-/g, ':').toLowerCase() });
        }
      }
    } catch {
      // ARP command not available or permission denied
    }

    return entries;
  }

  // ── Local network interfaces ──────────────────────────────────────────

  /**
   * List local network interfaces with IPv4 addresses.
   */
  async getLocalInterfaces(): Promise<NetworkInterface[]> {
    const interfaces = os.networkInterfaces();
    const results: NetworkInterface[] = [];

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family !== 'IPv4' || addr.internal) continue;

        const netmask = addr.netmask;
        // Calculate CIDR prefix from netmask
        const prefix = netmask
          .split('.')
          .reduce((acc, octet) => acc + (parseInt(octet, 10) >>> 0).toString(2).replace(/0/g, '').length, 0);

        // Network address
        const ipNum = ipToLong(addr.address);
        const maskNum = ipToLong(netmask);
        const networkAddr = longToIp((ipNum & maskNum) >>> 0);

        results.push({
          name,
          ip: addr.address,
          netmask,
          cidr: `${networkAddr}/${prefix}`,
        });
      }
    }

    return results;
  }
}

// ── Singleton export ────────────────────────────────────────────────────

export const networkScanner = new NetworkScanner();
