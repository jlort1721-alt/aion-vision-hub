/**
 * Grandstream Intercom Connector
 *
 * COMPATIBLE MODELS: GXP2130, GXP2170, GRP2612, GRP2614, GRP2616, GDS3710, GDS3712
 *
 * API: POST /cgi-bin/api.values.get (read), POST /cgi-bin/api.values.post (write)
 * P-codes: P47=SIP Server, P48=SIP User ID, P35=Auth Password, P34=Auth ID, P3=Display Name
 * Door relay: P-RemoteUnlock1=1 | Reboot: P-Reboot=1
 */

import type {
  IntercomConnector,
  IntercomBrand,
  DeviceTestResult,
  DeviceSipProvision,
  ProvisionResult,
  DeviceCredentials,
  IntercomDeviceInfo,
  DoorActionResult,
  SipServerConfig,
} from '../types.js';
import { config } from '../../../config/env.js';
import {
  validateDeviceIp,
  validateCredentialStrength,
  emitSecurityAudit,
  maskPassword,
} from '../security-utils.js';

const GS_TIMEOUT = 8000;

function getEnvCredentials(): DeviceCredentials | null {
  if (config.FANVIL_ADMIN_USER && config.FANVIL_ADMIN_PASSWORD) {
    return { username: config.FANVIL_ADMIN_USER, password: config.FANVIL_ADMIN_PASSWORD };
  }
  return null;
}

function requireCredentials(explicit?: DeviceCredentials): DeviceCredentials {
  const creds = explicit ?? getEnvCredentials();
  if (!creds?.username || !creds?.password) {
    throw new Error('Grandstream credentials not configured. Set FANVIL_ADMIN_USER/FANVIL_ADMIN_PASSWORD in .env.');
  }
  const strength = validateCredentialStrength(creds.username, creds.password);
  if (!strength.secure) {
    emitSecurityAudit({ event: 'credential.weak_detected', tenantId: 'system', detail: strength.warnings.join('; ') });
  }
  return creds;
}

export class GrandstreamConnector implements IntercomConnector {
  readonly brand: IntercomBrand = 'grandstream';
  readonly displayName = 'Grandstream SIP Intercom';

  async testDevice(ipAddress: string, deviceConfig?: Record<string, unknown>): Promise<DeviceTestResult> {
    const start = Date.now();
    const ipCheck = validateDeviceIp(ipAddress);
    if (!ipCheck.valid) return { reachable: false, httpReachable: false, latencyMs: 0, error: ipCheck.reason };

    const creds = this.extractCredentials(deviceConfig);
    try {
      const result = await this.cgiGet(ipAddress, 'P-Model,P-FWVersion', creds);
      const httpReachable = result.ok;
      let deviceModel: string | undefined;
      let firmwareVersion: string | undefined;
      if (httpReachable && result.body) {
        deviceModel = this.parsePValue(result.body, 'P-Model');
        firmwareVersion = this.parsePValue(result.body, 'P-FWVersion');
      }
      return { reachable: httpReachable, httpReachable, latencyMs: Date.now() - start, deviceModel, firmwareVersion };
    } catch (err) {
      return { reachable: false, httpReachable: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : 'Device test failed' };
    }
  }

  async provisionSipAccount(ipAddress: string, sipConfig: DeviceSipProvision): Promise<ProvisionResult> {
    const ipCheck = validateDeviceIp(ipAddress);
    if (!ipCheck.valid) return { success: false, message: `Invalid IP: ${ipCheck.reason}`, error: ipCheck.reason };
    const creds = requireCredentials();

    const lineIdx = sipConfig.lineIndex ?? 1;
    const params = [
      `P47=${sipConfig.sipServer}`,
      `P2=${sipConfig.sipPort}`,
      `P48=${sipConfig.username}`,
      `P34=${sipConfig.username}`,
      `P35=${sipConfig.password}`,
      `P3=${sipConfig.displayName ?? sipConfig.username}`,
    ].join('&');

    try {
      const result = await this.cgiPost(ipAddress, params, creds);
      if (result.ok) {
        emitSecurityAudit({ event: 'device.provision', tenantId: 'system', detail: `Grandstream ${ipAddress} line ${lineIdx} provisioned (pass=${maskPassword(sipConfig.password)})` });
        return { success: true, message: `SIP provisioned on ${ipAddress}`, requiresReboot: true };
      }
      return { success: false, message: `HTTP ${result.status}`, error: result.body };
    } catch (err) {
      return { success: false, message: 'Provision failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  async getDeviceInfo(ipAddress: string, credentials?: DeviceCredentials): Promise<IntercomDeviceInfo> {
    const creds = requireCredentials(credentials);
    try {
      const result = await this.cgiGet(ipAddress, 'P-Model,P-FWVersion,P-MACAddr', creds);
      return {
        brand: 'grandstream',
        model: result.ok ? this.parsePValue(result.body ?? '', 'P-Model') ?? 'Unknown' : 'Unknown',
        firmwareVersion: result.ok ? this.parsePValue(result.body ?? '', 'P-FWVersion') ?? 'Unknown' : 'Unknown',
        macAddress: result.ok ? this.parsePValue(result.body ?? '', 'P-MACAddr') : undefined,
        ipAddress,
        relayCount: 1,
      };
    } catch {
      return { brand: 'grandstream', model: 'Unknown', firmwareVersion: 'Unknown', ipAddress };
    }
  }

  async triggerDoorRelay(ipAddress: string, credentials?: DeviceCredentials, relayIndex = 1): Promise<DoorActionResult> {
    const ipCheck = validateDeviceIp(ipAddress);
    if (!ipCheck.valid) return { success: false, relayIndex, message: `Invalid IP: ${ipCheck.reason}`, error: ipCheck.reason };
    if (relayIndex < 1 || relayIndex > 2) return { success: false, relayIndex, message: 'Relay index must be 1 or 2', error: 'Invalid relay index' };
    const creds = requireCredentials(credentials);

    try {
      const result = await this.cgiPost(ipAddress, `P-RemoteUnlock${relayIndex}=1`, creds);
      if (result.ok) {
        emitSecurityAudit({ event: 'door.open', tenantId: 'device', ipAddress, detail: `Grandstream relay ${relayIndex} (user=${creds.username})` });
        return { success: true, relayIndex, message: `Door relay ${relayIndex} triggered` };
      }
      return { success: false, relayIndex, message: `HTTP ${result.status}`, error: result.body };
    } catch (err) {
      return { success: false, relayIndex, message: 'Relay trigger failed', error: err instanceof Error ? err.message : String(err) };
    }
  }

  async rebootDevice(ipAddress: string, credentials?: DeviceCredentials): Promise<{ success: boolean; error?: string }> {
    const creds = requireCredentials(credentials);
    try {
      await this.cgiPost(ipAddress, 'P-Reboot=1', creds);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  getProvisioningTemplate(sipConfig: SipServerConfig): Record<string, string> {
    return {
      'SIP Server (P47)': sipConfig.host,
      'SIP Port (P2)': String(sipConfig.port),
      'Transport': sipConfig.transport,
      'SIP Domain': sipConfig.domain || sipConfig.host,
      'DTMF Mode': 'RFC2833',
      'SRTP': sipConfig.srtp ? 'Enabled' : 'Disabled',
    };
  }

  getAutoProvisionUrl(deviceIp: string, param: string, value: string): string {
    return `http://${deviceIp}/cgi-bin/api.values.post?${encodeURIComponent(param)}=${encodeURIComponent(value)}`;
  }

  // ── Private Helpers ──────────────────────────────────────

  private extractCredentials(deviceConfig?: Record<string, unknown>): DeviceCredentials {
    const envCreds = getEnvCredentials();
    if (!deviceConfig) {
      if (envCreds) return envCreds;
      throw new Error('Grandstream credentials not configured.');
    }
    const username = (deviceConfig.adminUser as string) || envCreds?.username;
    const password = (deviceConfig.adminPassword as string) || envCreds?.password;
    if (!username || !password) throw new Error('Grandstream credentials incomplete.');
    return { username, password };
  }

  private async cgiGet(ip: string, params: string, creds?: DeviceCredentials | null): Promise<{ ok: boolean; status: number; body?: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (creds) headers['Authorization'] = 'Basic ' + Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
    const response = await fetch(`http://${ip}/cgi-bin/api.values.get`, { method: 'POST', headers, body: `request=${params}`, signal: AbortSignal.timeout(GS_TIMEOUT) });
    return { ok: response.ok, status: response.status, body: await response.text() };
  }

  private async cgiPost(ip: string, body: string, creds?: DeviceCredentials | null): Promise<{ ok: boolean; status: number; body: string }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (creds) headers['Authorization'] = 'Basic ' + Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
    const response = await fetch(`http://${ip}/cgi-bin/api.values.post`, { method: 'POST', headers, body, signal: AbortSignal.timeout(GS_TIMEOUT) });
    return { ok: response.ok, status: response.status, body: await response.text() };
  }

  private parsePValue(text: string, key: string): string | undefined {
    const match = text.match(new RegExp(`${key}\\s*=\\s*(.+)`));
    return match?.[1]?.trim();
  }
}
