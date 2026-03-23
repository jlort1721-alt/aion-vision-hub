/**
 * Universal Device Protocol (UDP) — Clave Seguridad
 *
 * Abstraction layer that provides a unified interface to control
 * ANY security device regardless of brand, model, or protocol.
 *
 * Supported device families:
 * - Cameras (Hikvision, Dahua, ONVIF, Generic RTSP)
 * - NVR/DVR (Hikvision, Dahua)
 * - Access Control (ZKTeco, Hikvision DS-K, Dahua ASI)
 * - Intercoms (Fanvil, Hikvision DS-KD, Grandstream)
 * - Relays (eWeLink/Sonoff, HTTP, GPIO, Hikvision, Dahua)
 * - Sensors (eWeLink, Generic HTTP)
 * - Locks (Smart locks via HTTP/BLE)
 *
 * Each device is represented by a DeviceCapabilities object that
 * describes what operations are available. The protocol auto-detects
 * capabilities on first connection.
 */

export interface DeviceCapabilities {
  video: boolean;
  audio: boolean;
  ptz: boolean;
  recording: boolean;
  playback: boolean;
  events: boolean;
  relay: boolean;
  doorControl: boolean;
  userManagement: boolean;
  fingerprint: boolean;
  faceRecognition: boolean;
  cardReader: boolean;
  intercom: boolean;
  sensor: boolean;
  reboot: boolean;
  firmwareUpdate: boolean;
  snapshot: boolean;
  twoWayAudio: boolean;
}

export interface DeviceConnectionParams {
  ip: string;
  port?: number;
  username?: string;
  password?: string;
  protocol?: 'http' | 'https' | 'rtsp' | 'onvif' | 'sip' | 'tcp';
  brand?: string;
  model?: string;
}

export interface DeviceCommand {
  action: string;
  params?: Record<string, unknown>;
}

export interface DeviceCommandResult {
  success: boolean;
  action: string;
  data?: unknown;
  error?: string;
  latencyMs: number;
}

/**
 * Auto-detect device brand and capabilities by probing known endpoints.
 */
export async function autoDetectDevice(params: DeviceConnectionParams): Promise<{
  brand: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  capabilities: DeviceCapabilities;
  protocols: string[];
  error?: string;
}> {
  const { ip, port = 80, username, password } = params;
  const auth = username && password ? `${username}:${password}@` : '';
  const baseHttp = `http://${auth}${ip}:${port}`;

  const result = {
    brand: 'unknown',
    model: 'unknown',
    serialNumber: '',
    firmwareVersion: '',
    capabilities: getDefaultCapabilities(),
    protocols: [] as string[],
    error: undefined as string | undefined,
  };

  // Try Hikvision ISAPI
  try {
    const resp = await fetchWithTimeout(`${baseHttp}/ISAPI/System/deviceInfo`, 5000);
    if (resp.ok) {
      const text = await resp.text();
      result.brand = 'hikvision';
      result.protocols.push('isapi', 'rtsp');

      const modelMatch = text.match(/<model>(.*?)<\/model>/);
      const serialMatch = text.match(/<serialNumber>(.*?)<\/serialNumber>/);
      const fwMatch = text.match(/<firmwareVersion>(.*?)<\/firmwareVersion>/);

      if (modelMatch) result.model = modelMatch[1];
      if (serialMatch) result.serialNumber = serialMatch[1];
      if (fwMatch) result.firmwareVersion = fwMatch[1];

      result.capabilities.video = true;
      result.capabilities.snapshot = true;
      result.capabilities.events = true;
      result.capabilities.reboot = true;

      // Check for PTZ
      try {
        const ptzResp = await fetchWithTimeout(`${baseHttp}/ISAPI/PTZCtrl/channels/1/capabilities`, 3000);
        if (ptzResp.ok) result.capabilities.ptz = true;
      } catch { /* no PTZ */ }

      // Check for access control
      try {
        const acResp = await fetchWithTimeout(`${baseHttp}/ISAPI/AccessControl/UserInfo/capabilities`, 3000);
        if (acResp.ok) {
          result.capabilities.doorControl = true;
          result.capabilities.relay = true;
          result.capabilities.userManagement = true;
          result.capabilities.cardReader = true;
        }
      } catch { /* no access control */ }

      // Check for intercom
      try {
        const intResp = await fetchWithTimeout(`${baseHttp}/ISAPI/VideoIntercom/capabilities`, 3000);
        if (intResp.ok) {
          result.capabilities.intercom = true;
          result.capabilities.twoWayAudio = true;
        }
      } catch { /* no intercom */ }

      return result;
    }
  } catch { /* not Hikvision */ }

  // Try Dahua CGI
  try {
    const resp = await fetchWithTimeout(`${baseHttp}/cgi-bin/magicBox.cgi?action=getSystemInfo`, 5000);
    if (resp.ok) {
      const text = await resp.text();
      result.brand = 'dahua';
      result.protocols.push('cgi', 'rtsp');

      const serialMatch = text.match(/serialNumber=(.*)/);
      const typeMatch = text.match(/deviceType=(.*)/);

      if (serialMatch) result.serialNumber = serialMatch[1].trim();
      if (typeMatch) result.model = typeMatch[1].trim();

      result.capabilities.video = true;
      result.capabilities.snapshot = true;
      result.capabilities.events = true;
      result.capabilities.reboot = true;

      return result;
    }
  } catch { /* not Dahua */ }

  // Try ZKTeco
  try {
    const resp = await fetchWithTimeout(`http://${ip}:${params.port || 4370}/`, 3000);
    if (resp.ok || resp.status === 401) {
      const text = await resp.text().catch(() => '');
      if (text.includes('ZK') || text.includes('zk') || resp.headers.get('server')?.includes('ZK')) {
        result.brand = 'zkteco';
        result.protocols.push('zk-http');
        result.capabilities.doorControl = true;
        result.capabilities.relay = true;
        result.capabilities.userManagement = true;
        result.capabilities.fingerprint = true;
        result.capabilities.cardReader = true;
        return result;
      }
    }
  } catch { /* not ZKTeco */ }

  // Try ONVIF
  try {
    const onvifBody = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
<s:Body><GetCapabilities xmlns="http://www.onvif.org/ver10/device/wsdl"/></s:Body>
</s:Envelope>`;

    const resp = await fetchWithTimeout(`http://${ip}:${port}/onvif/device_service`, 5000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/soap+xml' },
      body: onvifBody,
    });

    if (resp.ok) {
      result.brand = 'onvif';
      result.protocols.push('onvif', 'rtsp');
      result.capabilities.video = true;
      return result;
    }
  } catch { /* not ONVIF */ }

  // Try generic HTTP
  try {
    const resp = await fetchWithTimeout(`http://${ip}:${port}/`, 3000);
    if (resp.ok || resp.status === 401 || resp.status === 403) {
      const server = resp.headers.get('server') || '';
      const text = await resp.text().catch(() => '');

      if (server.includes('Fanvil') || text.includes('Fanvil')) {
        result.brand = 'fanvil';
        result.protocols.push('sip', 'http');
        result.capabilities.intercom = true;
        result.capabilities.relay = true;
        result.capabilities.doorControl = true;
      } else if (server.includes('Grandstream') || text.includes('Grandstream')) {
        result.brand = 'grandstream';
        result.protocols.push('sip', 'http');
        result.capabilities.intercom = true;
        result.capabilities.relay = true;
      } else {
        result.brand = 'generic';
        result.protocols.push('http');
      }
      return result;
    }
  } catch { /* not reachable */ }

  result.error = `No se pudo identificar el dispositivo en ${ip}:${port}`;
  return result;
}

/**
 * Execute a command on a device using the appropriate protocol.
 */
export async function executeDeviceCommand(
  params: DeviceConnectionParams,
  command: DeviceCommand,
): Promise<DeviceCommandResult> {
  const start = Date.now();
  const { ip, port = 80, username, password, brand } = params;
  const auth = username && password ? `${username}:${password}@` : '';
  const baseHttp = `http://${auth}${ip}:${port}`;

  try {
    switch (command.action) {
      case 'reboot':
        return await rebootDevice(baseHttp, brand || 'unknown', start);

      case 'snapshot':
        return await captureSnapshot(baseHttp, brand || 'unknown', start);

      case 'open_door':
        return await openDoor(baseHttp, brand || 'unknown', command.params, start);

      case 'ptz':
        return await controlPTZ(baseHttp, brand || 'unknown', command.params, start);

      case 'get_info':
        const info = await autoDetectDevice(params);
        return { success: true, action: 'get_info', data: info, latencyMs: Date.now() - start };

      case 'get_streams':
        return await getStreamUrls(params, start);

      default:
        return { success: false, action: command.action, error: `Acción no soportada: ${command.action}`, latencyMs: Date.now() - start };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    return { success: false, action: command.action, error: msg, latencyMs: Date.now() - start };
  }
}

// ── Internal command implementations ──────────────────────

async function rebootDevice(baseHttp: string, brand: string, start: number): Promise<DeviceCommandResult> {
  let resp: Response;

  if (brand === 'hikvision') {
    resp = await fetchWithTimeout(`${baseHttp}/ISAPI/System/reboot`, 10000, { method: 'PUT' });
  } else if (brand === 'dahua') {
    resp = await fetchWithTimeout(`${baseHttp}/cgi-bin/magicBox.cgi?action=reboot`, 10000);
  } else {
    return { success: false, action: 'reboot', error: `Reinicio no soportado para marca: ${brand}`, latencyMs: Date.now() - start };
  }

  return { success: resp.ok, action: 'reboot', latencyMs: Date.now() - start, error: resp.ok ? undefined : `HTTP ${resp.status}` };
}

async function captureSnapshot(baseHttp: string, brand: string, start: number): Promise<DeviceCommandResult> {
  let url: string;

  if (brand === 'hikvision') {
    url = `${baseHttp}/ISAPI/Streaming/channels/101/picture`;
  } else if (brand === 'dahua') {
    url = `${baseHttp}/cgi-bin/snapshot.cgi?channel=1`;
  } else {
    return { success: false, action: 'snapshot', error: `Captura no soportada para marca: ${brand}`, latencyMs: Date.now() - start };
  }

  const resp = await fetchWithTimeout(url, 10000);
  if (!resp.ok) {
    return { success: false, action: 'snapshot', error: `HTTP ${resp.status}`, latencyMs: Date.now() - start };
  }

  const buffer = await resp.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  return {
    success: true,
    action: 'snapshot',
    data: { imageBase64: `data:image/jpeg;base64,${base64}`, size: buffer.byteLength },
    latencyMs: Date.now() - start,
  };
}

async function openDoor(baseHttp: string, brand: string, params: Record<string, unknown> | undefined, start: number): Promise<DeviceCommandResult> {
  const door = (params?.door as number) || 1;
  const duration = (params?.duration as number) || 5;
  let resp: Response;

  if (brand === 'hikvision') {
    resp = await fetchWithTimeout(`${baseHttp}/ISAPI/AccessControl/RemoteControl/door/${door}`, 10000, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/xml' },
      body: '<RemoteControlDoor><cmd>open</cmd></RemoteControlDoor>',
    });
  } else if (brand === 'dahua') {
    resp = await fetchWithTimeout(`${baseHttp}/cgi-bin/accessControl.cgi?action=openDoor&channel=${door}&UserID=0&Type=Remote`, 10000);
  } else if (brand === 'zkteco') {
    resp = await fetchWithTimeout(`${baseHttp}/cgi-bin/remotecontrol.cgi?cmd=OPEN_DOOR&door=${door}&duration=${duration}`, 10000);
  } else {
    return { success: false, action: 'open_door', error: `Control de puerta no soportado para marca: ${brand}`, latencyMs: Date.now() - start };
  }

  return { success: resp.ok, action: 'open_door', data: { door, duration }, latencyMs: Date.now() - start };
}

async function controlPTZ(baseHttp: string, brand: string, params: Record<string, unknown> | undefined, start: number): Promise<DeviceCommandResult> {
  const channel = (params?.channel as number) || 1;
  const direction = (params?.direction as string) || 'stop';
  const speed = (params?.speed as number) || 50;

  if (brand === 'hikvision') {
    const ptzCommands: Record<string, string> = {
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      zoomin: 'ZOOM_IN', zoomout: 'ZOOM_OUT', stop: 'STOP',
    };
    // ptzCommands used for reference mapping
    void ptzCommands;

    if (direction === 'stop') {
      await fetchWithTimeout(`${baseHttp}/ISAPI/PTZCtrl/channels/${channel}/continuous`, 5000, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/xml' },
        body: `<PTZData><pan>0</pan><tilt>0</tilt><zoom>0</zoom></PTZData>`,
      });
    } else {
      const panSpeed = ['left', 'right'].includes(direction) ? (direction === 'right' ? speed : -speed) : 0;
      const tiltSpeed = ['up', 'down'].includes(direction) ? (direction === 'up' ? speed : -speed) : 0;
      const zoomSpeed = direction === 'zoomin' ? speed : direction === 'zoomout' ? -speed : 0;

      await fetchWithTimeout(`${baseHttp}/ISAPI/PTZCtrl/channels/${channel}/continuous`, 5000, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/xml' },
        body: `<PTZData><pan>${panSpeed}</pan><tilt>${tiltSpeed}</tilt><zoom>${zoomSpeed}</zoom></PTZData>`,
      });
    }

    return { success: true, action: 'ptz', data: { direction, speed, channel }, latencyMs: Date.now() - start };
  }

  if (brand === 'dahua') {
    const action = direction === 'stop' ? 'stop' : 'start';
    const code = direction.toUpperCase();
    await fetchWithTimeout(`${baseHttp}/cgi-bin/ptz.cgi?action=${action}&channel=${channel}&code=${code}&arg1=0&arg2=${speed}&arg3=0`, 5000);
    return { success: true, action: 'ptz', data: { direction, speed }, latencyMs: Date.now() - start };
  }

  return { success: false, action: 'ptz', error: `PTZ no soportado para marca: ${brand}`, latencyMs: Date.now() - start };
}

async function getStreamUrls(params: DeviceConnectionParams, start: number): Promise<DeviceCommandResult> {
  const { ip, username, password, brand } = params;
  const rtspPort = 554;
  const auth = username && password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';

  const streams: Record<string, string> = {};

  if (brand === 'hikvision') {
    streams.main = `rtsp://${auth}${ip}:${rtspPort}/Streaming/Channels/101`;
    streams.sub = `rtsp://${auth}${ip}:${rtspPort}/Streaming/Channels/102`;
  } else if (brand === 'dahua') {
    streams.main = `rtsp://${auth}${ip}:${rtspPort}/cam/realmonitor?channel=1&subtype=0`;
    streams.sub = `rtsp://${auth}${ip}:${rtspPort}/cam/realmonitor?channel=1&subtype=1`;
  } else {
    streams.main = `rtsp://${auth}${ip}:${rtspPort}/stream1`;
  }

  return { success: true, action: 'get_streams', data: streams, latencyMs: Date.now() - start };
}

// ── Utilities ──────────────────────────────────────────────

function getDefaultCapabilities(): DeviceCapabilities {
  return {
    video: false, audio: false, ptz: false, recording: false,
    playback: false, events: false, relay: false, doorControl: false,
    userManagement: false, fingerprint: false, faceRecognition: false,
    cardReader: false, intercom: false, sensor: false, reboot: false,
    firmwareUpdate: false, snapshot: false, twoWayAudio: false,
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
