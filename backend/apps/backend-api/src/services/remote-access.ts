/**
 * AION Remote Access Service
 *
 * Universal remote connectivity proxy for security devices behind NAT.
 * Provides HTTP reverse proxy, TCP tunnel management, and device web
 * interface access through the AION VPS without client-side VPN software.
 *
 * Supported device types:
 * - Cameras (Hikvision, Dahua, Axis, Uniview, Hanwha, Vivotek)
 * - DVR/NVR/XVR recorders
 * - Routers (MikroTik, Linksys, Cisco, TP-Link, Ubiquiti)
 * - Intercoms (Fanvil, Grandstream, Hikvision)
 * - Access Control (ZKTeco, Hikvision)
 * - IoT/Domotic (eWeLink/Sonoff)
 */

import net from 'net';
import { EventEmitter } from 'events';
import { db } from '../db/client.js';
import { devices, sites } from '../db/schema/index.js';
import { eq, and, isNotNull } from 'drizzle-orm';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RemoteTarget {
  /** Device ID from database */
  deviceId: string;
  /** Device name */
  name: string;
  /** Site name */
  siteName: string;
  /** Target host (WAN IP or direct IP) */
  host: string;
  /** Target port (mapped port on router) */
  port: number;
  /** Protocol to use */
  protocol: 'http' | 'https' | 'tcp' | 'rtsp';
  /** Device type */
  deviceType: string;
  /** Device brand */
  brand: string;
  /** Credentials (if available) */
  credentials?: { username: string; password: string };
}

export interface ProxySession {
  id: string;
  deviceId: string;
  deviceName: string;
  siteName: string;
  targetHost: string;
  targetPort: number;
  protocol: string;
  status: 'active' | 'error' | 'closed';
  createdAt: string;
  lastActivityAt: string;
  bytesTransferred: number;
  latencyMs: number | null;
  error?: string;
}

export interface DeviceAccessInfo {
  deviceId: string;
  name: string;
  siteName: string;
  siteId: string;
  type: string;
  brand: string;
  /** LAN IP (internal network) */
  lanIp: string | null;
  /** WAN IP (public, from site) */
  wanIp: string | null;
  /** Mapped port on router */
  mappedPort: number | null;
  /** Computed remote address (WAN:port) */
  remoteAddress: string | null;
  /** Available access methods */
  accessMethods: AccessMethod[];
  /** Connectivity status */
  connectivity: {
    reachable: boolean;
    latencyMs: number | null;
    lastChecked: string | null;
  };
  /** Port forwarding requirements */
  portForwarding: PortForwardRule[];
}

export interface AccessMethod {
  protocol: string;
  port: number;
  url: string;
  description: string;
  requiresAuth: boolean;
}

export interface PortForwardRule {
  externalPort: number;
  internalPort: number;
  protocol: 'TCP' | 'UDP' | 'TCP/UDP';
  service: string;
  description: string;
}

export interface ProxyRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: Buffer | string;
  timeout?: number;
}

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer;
  latencyMs: number;
}

// ── Port mapping by device brand/type ────────────────────────────────────

const DEVICE_PORT_TEMPLATES: Record<string, PortForwardRule[]> = {
  // Hikvision cameras/DVR/NVR
  hikvision: [
    { externalPort: 8000, internalPort: 8000, protocol: 'TCP', service: 'Hikvision SDK', description: 'SDK port para streaming RTSP y control ISAPI' },
    { externalPort: 80, internalPort: 80, protocol: 'TCP', service: 'HTTP Web', description: 'Interfaz web del dispositivo' },
    { externalPort: 443, internalPort: 443, protocol: 'TCP', service: 'HTTPS Web', description: 'Interfaz web segura' },
    { externalPort: 554, internalPort: 554, protocol: 'TCP', service: 'RTSP', description: 'Streaming RTSP nativo' },
  ],
  // Dahua cameras/XVR
  dahua: [
    { externalPort: 37777, internalPort: 37777, protocol: 'TCP', service: 'Dahua SDK', description: 'SDK port para streaming y control' },
    { externalPort: 80, internalPort: 80, protocol: 'TCP', service: 'HTTP Web', description: 'Interfaz web del dispositivo' },
    { externalPort: 443, internalPort: 443, protocol: 'TCP', service: 'HTTPS Web', description: 'Interfaz web segura' },
    { externalPort: 554, internalPort: 554, protocol: 'TCP', service: 'RTSP', description: 'Streaming RTSP nativo' },
  ],
  // Fanvil intercoms/phones
  fanvil: [
    { externalPort: 5060, internalPort: 5060, protocol: 'TCP/UDP', service: 'SIP', description: 'Protocolo SIP para llamadas' },
    { externalPort: 80, internalPort: 80, protocol: 'TCP', service: 'HTTP Web', description: 'Interfaz web de configuración' },
    { externalPort: 554, internalPort: 554, protocol: 'TCP', service: 'RTSP', description: 'Video del citófono' },
  ],
  // Grandstream intercoms
  grandstream: [
    { externalPort: 5060, internalPort: 5060, protocol: 'TCP/UDP', service: 'SIP', description: 'Protocolo SIP' },
    { externalPort: 80, internalPort: 80, protocol: 'TCP', service: 'HTTP Web', description: 'Interfaz web' },
    { externalPort: 554, internalPort: 554, protocol: 'TCP', service: 'RTSP', description: 'Video streaming' },
  ],
  // MikroTik routers
  mikrotik: [
    { externalPort: 8291, internalPort: 8291, protocol: 'TCP', service: 'WinBox', description: 'Administración WinBox' },
    { externalPort: 8728, internalPort: 8728, protocol: 'TCP', service: 'API', description: 'API MikroTik RouterOS' },
    { externalPort: 8729, internalPort: 8729, protocol: 'TCP', service: 'API-SSL', description: 'API segura MikroTik' },
    { externalPort: 80, internalPort: 80, protocol: 'TCP', service: 'HTTP Web', description: 'WebFig administración' },
    { externalPort: 22, internalPort: 22, protocol: 'TCP', service: 'SSH', description: 'Terminal SSH' },
  ],
  // Linksys/TP-Link/Generic routers
  router: [
    { externalPort: 80, internalPort: 80, protocol: 'TCP', service: 'HTTP Web', description: 'Panel de administración web' },
    { externalPort: 443, internalPort: 443, protocol: 'TCP', service: 'HTTPS', description: 'Panel seguro HTTPS' },
    { externalPort: 22, internalPort: 22, protocol: 'TCP', service: 'SSH', description: 'Terminal SSH (si disponible)' },
  ],
  // Ubiquiti routers/APs
  ubiquiti: [
    { externalPort: 443, internalPort: 443, protocol: 'TCP', service: 'HTTPS', description: 'UniFi Controller / EdgeOS' },
    { externalPort: 22, internalPort: 22, protocol: 'TCP', service: 'SSH', description: 'Terminal SSH' },
    { externalPort: 8443, internalPort: 8443, protocol: 'TCP', service: 'UniFi HTTPS', description: 'UniFi Controller alternativo' },
  ],
  // ZKTeco access control
  zkteco: [
    { externalPort: 4370, internalPort: 4370, protocol: 'TCP', service: 'ZKTeco SDK', description: 'Comunicación ZKTeco' },
    { externalPort: 80, internalPort: 80, protocol: 'TCP', service: 'HTTP Web', description: 'Interfaz web ZKBio' },
  ],
  // Axis cameras
  axis: [
    { externalPort: 80, internalPort: 80, protocol: 'TCP', service: 'HTTP/VAPIX', description: 'Web + API VAPIX' },
    { externalPort: 443, internalPort: 443, protocol: 'TCP', service: 'HTTPS', description: 'Web segura' },
    { externalPort: 554, internalPort: 554, protocol: 'TCP', service: 'RTSP', description: 'Streaming RTSP' },
  ],
  // Generic ONVIF
  generic_onvif: [
    { externalPort: 80, internalPort: 80, protocol: 'TCP', service: 'HTTP/ONVIF', description: 'Web + ONVIF service' },
    { externalPort: 554, internalPort: 554, protocol: 'TCP', service: 'RTSP', description: 'Streaming RTSP' },
  ],
};

// ── RemoteAccessService class ────────────────────────────────────────────

export class RemoteAccessService extends EventEmitter {
  private sessions: Map<string, ProxySession> = new Map();

  // ── Device Access Information ────────────────────────────────────────

  /**
   * Get comprehensive access information for all devices at a site.
   * Returns connection details, port forwarding requirements, and access methods.
   */
  async getSiteAccessMap(tenantId: string, siteId: string): Promise<{
    site: { id: string; name: string; wanIp: string | null; address: string | null };
    devices: DeviceAccessInfo[];
    portForwardingSummary: PortForwardRule[];
  }> {
    const [site] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)))
      .limit(1);

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    const siteDevices = await db
      .select()
      .from(devices)
      .where(and(eq(devices.siteId, siteId), eq(devices.tenantId, tenantId)));

    const deviceInfos: DeviceAccessInfo[] = [];
    const allPortRules: PortForwardRule[] = [];

    for (const device of siteDevices) {
      const brand = (device.brand ?? 'generic_onvif').toLowerCase();
      const wanIp = site.wanIp;
      const port = device.port;
      const remoteAddress = wanIp && port ? `${wanIp}:${port}` : null;

      // Build access methods
      const accessMethods: AccessMethod[] = [];

      if (remoteAddress) {
        // HTTP Web Interface
        accessMethods.push({
          protocol: 'http',
          port: port!,
          url: `http://${remoteAddress}`,
          description: 'Interfaz web del dispositivo',
          requiresAuth: true,
        });

        // RTSP streaming (if camera/DVR/NVR)
        if (['camera', 'nvr', 'dvr', 'xvr', 'encoder'].includes(device.type)) {
          const rtspPort = device.rtspPort ?? 554;
          const rtspUrl = this.buildRtspUrl(brand, wanIp!, rtspPort, device.username, device.password);
          accessMethods.push({
            protocol: 'rtsp',
            port: rtspPort,
            url: rtspUrl,
            description: 'Streaming RTSP',
            requiresAuth: true,
          });
        }

        // ISAPI (Hikvision)
        if (brand === 'hikvision') {
          accessMethods.push({
            protocol: 'http',
            port: port!,
            url: `http://${remoteAddress}/ISAPI/System/deviceInfo`,
            description: 'ISAPI Device Info',
            requiresAuth: true,
          });
        }

        // SIP (Fanvil/Grandstream intercoms)
        if (['intercom', 'fanvil', 'grandstream'].includes(device.type) || ['fanvil', 'grandstream'].includes(brand)) {
          accessMethods.push({
            protocol: 'sip',
            port: 5060,
            url: `sip:${device.extension ?? '100'}@${wanIp}:5060`,
            description: 'Llamada SIP al citófono',
            requiresAuth: true,
          });
        }
      }

      // Port forwarding rules based on brand
      const brandKey = this.resolveBrandKey(brand, device.type);
      const portRules = this.generatePortForwardRules(brandKey, device.ipAddress, port);

      allPortRules.push(...portRules);

      deviceInfos.push({
        deviceId: device.id,
        name: device.name,
        siteName: site.name,
        siteId: site.id,
        type: device.type,
        brand: brand,
        lanIp: device.ipAddress,
        wanIp: wanIp,
        mappedPort: port,
        remoteAddress,
        accessMethods,
        connectivity: {
          reachable: false,
          latencyMs: null,
          lastChecked: null,
        },
        portForwarding: portRules,
      });
    }

    // Deduplicate port forwarding rules
    const uniqueRules = this.deduplicatePortRules(allPortRules);

    return {
      site: {
        id: site.id,
        name: site.name,
        wanIp: site.wanIp,
        address: site.address,
      },
      devices: deviceInfos,
      portForwardingSummary: uniqueRules,
    };
  }

  // ── HTTP Reverse Proxy ──────────────────────────────────────────────

  /**
   * Proxy an HTTP request to a remote device.
   * The AION VPS acts as an intermediary, forwarding the request
   * to the device via its WAN IP and port-forwarded port.
   */
  async proxyHttpRequest(
    target: RemoteTarget,
    req: ProxyRequest,
  ): Promise<ProxyResponse> {
    const sessionId = `${target.deviceId}-${Date.now()}`;
    const startTime = Date.now();

    const session: ProxySession = {
      id: sessionId,
      deviceId: target.deviceId,
      deviceName: target.name,
      siteName: target.siteName,
      targetHost: target.host,
      targetPort: target.port,
      protocol: target.protocol,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      bytesTransferred: 0,
      latencyMs: null,
    };

    this.sessions.set(sessionId, session);

    try {
      const response = await this.executeHttpProxy(target, req);
      const latencyMs = Date.now() - startTime;

      session.status = 'closed';
      session.latencyMs = latencyMs;
      session.bytesTransferred = response.body.length;
      session.lastActivityAt = new Date().toISOString();

      this.emit('proxy:success', { sessionId, target, latencyMs });

      return response;
    } catch (err) {
      session.status = 'error';
      session.error = err instanceof Error ? err.message : 'Proxy failed';
      session.lastActivityAt = new Date().toISOString();

      this.emit('proxy:error', { sessionId, target, error: session.error });
      throw err;
    }
  }

  /**
   * Execute the actual HTTP proxy request with digest auth support.
   */
  private async executeHttpProxy(
    target: RemoteTarget,
    req: ProxyRequest,
  ): Promise<ProxyResponse> {
    const timeout = req.timeout ?? 15000;
    const isHttps = target.protocol === 'https';
    const baseUrl = `${isHttps ? 'https' : 'http'}://${target.host}:${target.port}`;
    const fullUrl = `${baseUrl}${req.path}`;

    const headers: Record<string, string> = {
      ...req.headers,
      'User-Agent': 'AION-RemoteAccess/1.0',
    };

    // Add Basic Auth if credentials available
    if (target.credentials) {
      const auth = Buffer.from(`${target.credentials.username}:${target.credentials.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const startTime = Date.now();

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
        signal: controller.signal,
        redirect: 'follow',
      };

      if (req.body && !['GET', 'HEAD'].includes(req.method)) {
        fetchOptions.body = req.body;
      }

      const response = await fetch(fullUrl, fetchOptions);
      clearTimeout(timer);

      const responseBody = Buffer.from(await response.arrayBuffer());
      const latencyMs = Date.now() - startTime;

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        statusCode: response.status,
        headers: responseHeaders,
        body: responseBody,
        latencyMs,
      };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  // ── TCP Connectivity Probe ──────────────────────────────────────────

  /**
   * Test TCP connectivity to a remote device.
   */
  async testDeviceConnectivity(
    host: string,
    port: number,
    timeout = 5000,
  ): Promise<{ reachable: boolean; latencyMs: number }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      socket.on('connect', () => {
        const latencyMs = Date.now() - startTime;
        socket.destroy();
        resolve({ reachable: true, latencyMs });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ reachable: false, latencyMs: Date.now() - startTime });
      });

      socket.on('error', () => {
        socket.destroy();
        resolve({ reachable: false, latencyMs: Date.now() - startTime });
      });

      socket.connect(port, host);
    });
  }

  /**
   * Batch test connectivity for all devices at a site.
   */
  async testSiteConnectivity(
    tenantId: string,
    siteId: string,
  ): Promise<Array<{ deviceId: string; name: string; host: string; port: number; reachable: boolean; latencyMs: number }>> {
    const [site] = await db
      .select({ wanIp: sites.wanIp })
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)))
      .limit(1);

    if (!site?.wanIp) {
      throw new Error('Site not found or has no WAN IP configured');
    }

    const siteDevices = await db
      .select({
        id: devices.id,
        name: devices.name,
        port: devices.port,
        ipAddress: devices.ipAddress,
      })
      .from(devices)
      .where(and(eq(devices.siteId, siteId), eq(devices.tenantId, tenantId), isNotNull(devices.port)));

    const results = await Promise.all(
      siteDevices.map(async (device) => {
        const host = site.wanIp!;
        const port = device.port!;
        const { reachable, latencyMs } = await this.testDeviceConnectivity(host, port);
        return {
          deviceId: device.id,
          name: device.name,
          host,
          port,
          reachable,
          latencyMs,
        };
      }),
    );

    return results;
  }

  // ── Build Remote Target from Device ─────────────────────────────────

  /**
   * Resolve a device ID into a RemoteTarget for proxying.
   */
  async resolveTarget(
    tenantId: string,
    deviceId: string,
    overridePort?: number,
    overrideProtocol?: 'http' | 'https' | 'tcp' | 'rtsp',
  ): Promise<RemoteTarget> {
    const [device] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)))
      .limit(1);

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const [site] = await db
      .select({ name: sites.name, wanIp: sites.wanIp })
      .from(sites)
      .where(eq(sites.id, device.siteId))
      .limit(1);

    if (!site?.wanIp) {
      throw new Error(`Site for device ${deviceId} has no WAN IP`);
    }

    const port = overridePort ?? device.port ?? device.httpPort ?? 80;
    const protocol = overrideProtocol ?? 'http';

    return {
      deviceId: device.id,
      name: device.name,
      siteName: site.name,
      host: site.wanIp,
      port,
      protocol,
      deviceType: device.type,
      brand: device.brand ?? 'generic_onvif',
      credentials: device.username
        ? { username: device.username, password: device.password ?? '' }
        : undefined,
    };
  }

  // ── Port Forwarding Guide Generator ─────────────────────────────────

  /**
   * Generate a complete port forwarding guide for a site.
   * Returns all rules needed to access all devices remotely.
   */
  async generatePortForwardingGuide(
    tenantId: string,
    siteId: string,
  ): Promise<{
    siteName: string;
    wanIp: string | null;
    rules: Array<PortForwardRule & { deviceName: string; deviceIp: string | null }>;
    routerAccessUrl: string | null;
  }> {
    const [site] = await db
      .select()
      .from(sites)
      .where(and(eq(sites.id, siteId), eq(sites.tenantId, tenantId)))
      .limit(1);

    if (!site) {
      throw new Error(`Site ${siteId} not found`);
    }

    const siteDevices = await db
      .select()
      .from(devices)
      .where(and(eq(devices.siteId, siteId), eq(devices.tenantId, tenantId)));

    const rules: Array<PortForwardRule & { deviceName: string; deviceIp: string | null }> = [];
    let nextExternalPort = 8000;
    const usedPorts = new Set<number>();

    // Collect already-assigned ports
    for (const device of siteDevices) {
      if (device.port) usedPorts.add(device.port);
    }

    for (const device of siteDevices) {
      const brand = (device.brand ?? 'generic_onvif').toLowerCase();
      const brandKey = this.resolveBrandKey(brand, device.type);
      const template = DEVICE_PORT_TEMPLATES[brandKey] ?? DEVICE_PORT_TEMPLATES.generic_onvif;

      if (!template) continue;

      for (const rule of template) {
        let extPort = device.port ?? rule.externalPort;

        // Avoid port conflicts — find next available
        while (usedPorts.has(extPort)) {
          extPort = nextExternalPort++;
        }
        usedPorts.add(extPort);

        rules.push({
          ...rule,
          externalPort: extPort,
          deviceName: device.name,
          deviceIp: device.ipAddress,
        });
      }
    }

    // Detect router access URL
    const routerDevice = siteDevices.find(
      (d) => d.type === 'router' || d.type === 'network_wan',
    );
    const routerAccessUrl = routerDevice && site.wanIp && routerDevice.port
      ? `http://${site.wanIp}:${routerDevice.port}`
      : site.wanIp
        ? `http://${site.wanIp}:8181`
        : null;

    return {
      siteName: site.name,
      wanIp: site.wanIp,
      rules,
      routerAccessUrl,
    };
  }

  // ── Session Management ──────────────────────────────────────────────

  getActiveSessions(): ProxySession[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.status === 'active')
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  }

  getAllSessions(limit = 50): ProxySession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  clearClosedSessions(): number {
    let cleared = 0;
    for (const [id, session] of this.sessions) {
      if (session.status !== 'active') {
        this.sessions.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  // ── RTSP URL Builder ────────────────────────────────────────────────

  private buildRtspUrl(
    brand: string,
    host: string,
    port: number,
    username?: string | null,
    password?: string | null,
  ): string {
    const auth = username ? `${username}:${password ?? ''}@` : '';
    const base = `rtsp://${auth}${host}:${port}`;

    switch (brand.toLowerCase()) {
      case 'hikvision':
        return `${base}/Streaming/Channels/102`;
      case 'dahua':
        return `${base}/cam/realmonitor?channel=1&subtype=1`;
      case 'axis':
        return `${base}/axis-media/media.amp`;
      case 'uniview':
        return `${base}/media/video1`;
      case 'vivotek':
        return `${base}/live.sdp`;
      case 'hanwha':
        return `${base}/profile2/media.smp`;
      case 'grandstream':
        return `${base}/0`;
      default:
        return `${base}/stream1`;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private resolveBrandKey(brand: string, deviceType: string): string {
    const b = brand.toLowerCase();

    // Direct match
    if (DEVICE_PORT_TEMPLATES[b]) return b;

    // Type-based fallback
    if (['router', 'network_wan', 'access_point'].includes(deviceType)) {
      if (b.includes('mikrotik')) return 'mikrotik';
      if (b.includes('ubiquiti') || b.includes('unifi')) return 'ubiquiti';
      return 'router';
    }
    if (['intercom'].includes(deviceType)) {
      if (b.includes('fanvil')) return 'fanvil';
      if (b.includes('grandstream')) return 'grandstream';
      return 'fanvil'; // default intercom
    }
    if (b.includes('zkteco') || b.includes('zkbio')) return 'zkteco';

    return 'generic_onvif';
  }

  private generatePortForwardRules(
    brandKey: string,
    _deviceIp: string | null,
    mappedPort: number | null,
  ): PortForwardRule[] {
    const template = DEVICE_PORT_TEMPLATES[brandKey] ?? DEVICE_PORT_TEMPLATES.generic_onvif;
    if (!template) return [];

    return template.map((rule) => ({
      ...rule,
      externalPort: mappedPort ?? rule.externalPort,
    }));
  }

  private deduplicatePortRules(rules: PortForwardRule[]): PortForwardRule[] {
    const seen = new Set<string>();
    const unique: PortForwardRule[] = [];

    for (const rule of rules) {
      const key = `${rule.externalPort}:${rule.service}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rule);
      }
    }

    return unique.sort((a, b) => a.externalPort - b.externalPort);
  }
}

// ── Singleton export ────────────────────────────────────────────────────

export const remoteAccess = new RemoteAccessService();
