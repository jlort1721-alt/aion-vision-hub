/**
 * Universal Relay Controller Service
 *
 * Controls physical relays via multiple backends:
 * 1. eWeLink/Sonoff — Cloud API (already integrated)
 * 2. HTTP Relay — Generic HTTP relay modules (ESP8266, ESP32, Shelly, etc.)
 * 3. Raspberry Pi GPIO — Direct GPIO control via local agent API
 * 4. ZKTeco — Door relay on access control panels
 *
 * Used by LPR (gate open), access control (door unlock),
 * automation rules, and manual operator actions.
 */

export type RelayBackend = 'ewelink' | 'http_relay' | 'raspberry_pi' | 'zkteco' | 'hikvision' | 'dahua';

export interface RelayConfig {
  backend: RelayBackend;
  // eWeLink
  ewelinkDeviceId?: string;
  ewelinkOutlet?: number;
  // HTTP Relay
  httpUrl?: string;         // Full URL to trigger relay
  httpMethod?: string;      // GET or POST
  httpOnBody?: string;      // Body for ON command
  httpOffBody?: string;     // Body for OFF command
  httpHeaders?: Record<string, string>;
  // Raspberry Pi
  piHost?: string;          // IP of the Pi agent
  piPort?: number;          // Agent API port (default 5000)
  gpioPin?: number;         // GPIO BCM pin number
  // ZKTeco
  zktecoIp?: string;
  zktecoDoor?: number;      // Door number (1-4)
  // Hikvision/Dahua ISAPI
  deviceIp?: string;
  deviceUser?: string;
  devicePass?: string;
  // Common
  pulseDurationMs?: number; // How long to keep relay ON (default 3000ms)
}

export interface RelayAction {
  action: 'on' | 'off' | 'pulse' | 'toggle';
  durationMs?: number;
}

export interface RelayResult {
  success: boolean;
  backend: RelayBackend;
  action: string;
  durationMs?: number;
  error?: string;
}

const EWELINK_API = process.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Execute a relay action using the configured backend.
 */
export async function executeRelay(config: RelayConfig, action: RelayAction): Promise<RelayResult> {
  const duration = action.durationMs || config.pulseDurationMs || 3000;

  try {
    switch (config.backend) {
      case 'ewelink':
        return await executeEWeLinkRelay(config, action, duration);
      case 'http_relay':
        return await executeHttpRelay(config, action, duration);
      case 'raspberry_pi':
        return await executeRaspberryPiRelay(config, action, duration);
      case 'zkteco':
        return await executeZKTecoRelay(config, action, duration);
      case 'hikvision':
        return await executeHikvisionRelay(config, action, duration);
      case 'dahua':
        return await executeDahuaRelay(config, action, duration);
      default:
        return { success: false, backend: config.backend, action: action.action, error: `Backend no soportado: ${config.backend}` };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    return { success: false, backend: config.backend, action: action.action, error: msg };
  }
}

/**
 * eWeLink/Sonoff relay control via existing eWeLink service.
 */
async function executeEWeLinkRelay(config: RelayConfig, action: RelayAction, duration: number): Promise<RelayResult> {
  if (!config.ewelinkDeviceId) {
    return { success: false, backend: 'ewelink', action: action.action, error: 'ewelinkDeviceId no configurado' };
  }

  const command = action.action === 'off' ? 'off' : 'on';

  const resp = await fetch(`${EWELINK_API}/api/v1/ewelink/devices/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: config.ewelinkDeviceId,
      action: command,
      outlet: config.ewelinkOutlet || 0,
    }),
  });

  const data = await resp.json() as { success: boolean; error?: string };
  if (!data.success) {
    return { success: false, backend: 'ewelink', action: command, error: data.error };
  }

  // For pulse action, turn off after duration
  if (action.action === 'pulse' || action.action === 'on') {
    setTimeout(async () => {
      await fetch(`${EWELINK_API}/api/v1/ewelink/devices/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: config.ewelinkDeviceId,
          action: 'off',
          outlet: config.ewelinkOutlet || 0,
        }),
      }).catch(() => { /* best effort */ });
    }, duration);
  }

  return { success: true, backend: 'ewelink', action: command, durationMs: duration };
}

/**
 * Generic HTTP relay control (ESP8266, ESP32, Shelly, etc.)
 */
async function executeHttpRelay(config: RelayConfig, action: RelayAction, duration: number): Promise<RelayResult> {
  if (!config.httpUrl) {
    return { success: false, backend: 'http_relay', action: action.action, error: 'httpUrl no configurado' };
  }

  const method = (config.httpMethod || 'GET').toUpperCase();
  const isOn = action.action !== 'off';
  const body = isOn ? config.httpOnBody : config.httpOffBody;

  const opts: RequestInit = {
    method,
    headers: config.httpHeaders || {},
  };
  if (body && method === 'POST') {
    opts.body = body;
    (opts.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  const resp = await fetch(config.httpUrl, opts);
  if (!resp.ok) {
    return { success: false, backend: 'http_relay', action: action.action, error: `HTTP ${resp.status}` };
  }

  // Pulse: turn off after duration
  if ((action.action === 'pulse' || action.action === 'on') && config.httpOffBody) {
    setTimeout(async () => {
      await fetch(config.httpUrl!, {
        method,
        headers: config.httpHeaders || {},
        body: config.httpOffBody || undefined,
      }).catch(() => { /* best effort */ });
    }, duration);
  }

  return { success: true, backend: 'http_relay', action: action.action, durationMs: duration };
}

/**
 * Raspberry Pi GPIO relay control via local agent API.
 *
 * The Pi runs a lightweight HTTP agent that controls GPIO pins.
 * Agent API:
 *   POST http://{piHost}:{piPort}/gpio/{pin}/on
 *   POST http://{piHost}:{piPort}/gpio/{pin}/off
 *   POST http://{piHost}:{piPort}/gpio/{pin}/pulse?duration={ms}
 *   GET  http://{piHost}:{piPort}/gpio/{pin}/state
 *
 * See: scripts/raspberry-pi-agent.py for the agent code.
 */
async function executeRaspberryPiRelay(config: RelayConfig, action: RelayAction, duration: number): Promise<RelayResult> {
  if (!config.piHost || !config.gpioPin) {
    return { success: false, backend: 'raspberry_pi', action: action.action, error: 'piHost y gpioPin son obligatorios' };
  }

  const port = config.piPort || 5000;
  const pin = config.gpioPin;
  const baseUrl = `http://${config.piHost}:${port}/gpio/${pin}`;

  let endpoint: string;
  if (action.action === 'pulse') {
    endpoint = `${baseUrl}/pulse?duration=${duration}`;
  } else if (action.action === 'on') {
    endpoint = `${baseUrl}/on`;
  } else if (action.action === 'off') {
    endpoint = `${baseUrl}/off`;
  } else {
    // toggle: read state, then flip
    const stateResp = await fetch(`${baseUrl}/state`);
    const stateData = await stateResp.json() as { state: string };
    endpoint = stateData.state === 'on' ? `${baseUrl}/off` : `${baseUrl}/on`;
  }

  const resp = await fetch(endpoint, { method: 'POST' });
  if (!resp.ok) {
    return { success: false, backend: 'raspberry_pi', action: action.action, error: `Pi agent error: HTTP ${resp.status}` };
  }

  return { success: true, backend: 'raspberry_pi', action: action.action, durationMs: duration };
}

/**
 * ZKTeco door relay control via HTTP CGI.
 */
async function executeZKTecoRelay(config: RelayConfig, action: RelayAction, duration: number): Promise<RelayResult> {
  if (!config.zktecoIp) {
    return { success: false, backend: 'zkteco', action: action.action, error: 'zktecoIp no configurado' };
  }

  const door = config.zktecoDoor || 1;
  const url = `http://${config.zktecoIp}/cgi-bin/remotecontrol.cgi?cmd=OPEN_DOOR&door=${door}&duration=${Math.round(duration / 1000)}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    return { success: false, backend: 'zkteco', action: action.action, error: `ZKTeco error: HTTP ${resp.status}` };
  }

  return { success: true, backend: 'zkteco', action: action.action, durationMs: duration };
}

/**
 * Hikvision ISAPI door/relay control.
 */
async function executeHikvisionRelay(config: RelayConfig, action: RelayAction, duration: number): Promise<RelayResult> {
  if (!config.deviceIp) {
    return { success: false, backend: 'hikvision', action: action.action, error: 'deviceIp no configurado' };
  }

  const auth = config.deviceUser && config.devicePass
    ? `${config.deviceUser}:${config.devicePass}@`
    : '';

  const url = `http://${auth}${config.deviceIp}/ISAPI/AccessControl/RemoteControl/door/1`;
  const body = `<RemoteControlDoor><cmd>${action.action === 'off' ? 'close' : 'open'}</cmd></RemoteControlDoor>`;

  const resp = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/xml' },
    body,
  });

  if (!resp.ok) {
    return { success: false, backend: 'hikvision', action: action.action, error: `ISAPI error: HTTP ${resp.status}` };
  }

  // Auto-close after duration
  if (action.action !== 'off') {
    setTimeout(async () => {
      await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/xml' },
        body: '<RemoteControlDoor><cmd>close</cmd></RemoteControlDoor>',
      }).catch(() => {});
    }, duration);
  }

  return { success: true, backend: 'hikvision', action: action.action, durationMs: duration };
}

/**
 * Dahua CGI door/relay control.
 */
async function executeDahuaRelay(config: RelayConfig, action: RelayAction, duration: number): Promise<RelayResult> {
  if (!config.deviceIp) {
    return { success: false, backend: 'dahua', action: action.action, error: 'deviceIp no configurado' };
  }

  const auth = config.deviceUser && config.devicePass
    ? `${config.deviceUser}:${config.devicePass}@`
    : '';
  const door = config.zktecoDoor || 1;

  const cmd = action.action === 'off' ? 'close' : 'open';
  const url = `http://${auth}${config.deviceIp}/cgi-bin/accessControl.cgi?action=${cmd}&channel=${door}&UserID=0&Type=Remote`;

  const resp = await fetch(url);
  if (!resp.ok) {
    return { success: false, backend: 'dahua', action: action.action, error: `Dahua CGI error: HTTP ${resp.status}` };
  }

  if (action.action !== 'off') {
    setTimeout(async () => {
      await fetch(`http://${auth}${config.deviceIp}/cgi-bin/accessControl.cgi?action=close&channel=${door}&UserID=0&Type=Remote`).catch(() => {});
    }, duration);
  }

  return { success: true, backend: 'dahua', action: action.action, durationMs: duration };
}

/**
 * List supported relay backends with their requirements.
 */
export function getSupportedBackends(): Array<{ id: RelayBackend; name: string; requires: string[] }> {
  return [
    { id: 'ewelink', name: 'Sonoff / eWeLink', requires: ['ewelinkDeviceId'] },
    { id: 'http_relay', name: 'Relé HTTP (ESP8266/ESP32/Shelly)', requires: ['httpUrl'] },
    { id: 'raspberry_pi', name: 'Raspberry Pi GPIO', requires: ['piHost', 'gpioPin'] },
    { id: 'zkteco', name: 'ZKTeco (Panel de Acceso)', requires: ['zktecoIp'] },
    { id: 'hikvision', name: 'Hikvision ISAPI', requires: ['deviceIp', 'deviceUser', 'devicePass'] },
    { id: 'dahua', name: 'Dahua CGI', requires: ['deviceIp', 'deviceUser', 'devicePass'] },
  ];
}
