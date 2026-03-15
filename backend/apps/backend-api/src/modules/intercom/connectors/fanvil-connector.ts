/**
 * Fanvil Intercom Connector
 *
 * Provides device management for Fanvil IP intercoms via HTTP API.
 * Supports auto-provisioning, SIP account configuration, door relay control,
 * and device information retrieval.
 *
 * COMPATIBLE MODELS:
 *   - Fanvil i10/i10V/i10D (single-button door phone)
 *   - Fanvil i12 (multi-button door phone)
 *   - Fanvil i16V/i16SV (video door phone)
 *   - Fanvil i18S (SIP video intercom)
 *   - Fanvil i20S/i20T (surface/flush mount)
 *   - Fanvil i23S (emergency intercom)
 *   - Fanvil i30 (video door phone)
 *   - Fanvil i33V/i33VF (facial recognition)
 *   - Fanvil PA2/PA2S (SIP paging gateway)
 *
 * PROVISIONING:
 *   Fanvil devices support HTTP-based auto-provisioning via CGI API:
 *   http://<device-ip>/cgi-bin/ConfigManApp.com?key=<param>&value=<val>
 *
 *   For bulk provisioning, use DHCP Option 66 pointing to:
 *   http://<provision-server>/fanvil/{mac}.cfg
 *
 * DOOR RELAY:
 *   Fanvil intercoms have 1-2 relay outputs for electric locks.
 *   Triggered via: http://<ip>/cgi-bin/ConfigManApp.com?key=Output1&value=1
 *   Duration configurable via: P3292 (relay hold time, default 5s)
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

/**
 * Get Fanvil credentials from env. No hardcoded defaults.
 * Falls back to env vars FANVIL_ADMIN_USER / FANVIL_ADMIN_PASSWORD,
 * which themselves have no defaults and must be explicitly set.
 */
function getEnvCredentials(): DeviceCredentials | null {
  if (config.FANVIL_ADMIN_USER && config.FANVIL_ADMIN_PASSWORD) {
    return { username: config.FANVIL_ADMIN_USER, password: config.FANVIL_ADMIN_PASSWORD };
  }
  return null;
}

function requireCredentials(explicit?: DeviceCredentials): DeviceCredentials {
  const creds = explicit ?? getEnvCredentials();
  if (!creds || !creds.username || !creds.password) {
    throw new Error(
      'Fanvil device credentials not configured. Set adminUser/adminPassword in device config or FANVIL_ADMIN_USER/FANVIL_ADMIN_PASSWORD in backend .env.',
    );
  }

  // Warn (but don't block) on weak credentials — gives operators visibility
  const strength = validateCredentialStrength(creds.username, creds.password);
  if (!strength.secure) {
    emitSecurityAudit({
      event: 'credential.weak_detected',
      tenantId: 'system',
      detail: strength.warnings.join('; '),
    });
  }

  return creds;
}

const FANVIL_HTTP_TIMEOUT = 8000;

export class FanvilConnector implements IntercomConnector {
  readonly brand: IntercomBrand = 'fanvil';
  readonly displayName = 'Fanvil SIP Intercom';

  async testDevice(ipAddress: string, config?: Record<string, unknown>): Promise<DeviceTestResult> {
    const start = Date.now();

    const ipCheck = validateDeviceIp(ipAddress);
    if (!ipCheck.valid) {
      return { reachable: false, httpReachable: false, latencyMs: 0, error: ipCheck.reason };
    }

    const creds = this.extractCredentials(config);

    try {
      // Test HTTP reachability (Fanvil web UI)
      const httpResult = await this.httpGet(ipAddress, '/cgi-bin/ConfigManApp.com?key=P-SIPServerAddr1', creds);
      const httpReachable = httpResult.ok;

      // Try to extract device model from HTTP response or alternate endpoint
      let deviceModel: string | undefined;
      let firmwareVersion: string | undefined;

      if (httpReachable) {
        try {
          const infoResult = await this.httpGet(ipAddress, '/cgi-bin/ConfigManApp.com?key=P-Model', creds);
          if (infoResult.ok) {
            deviceModel = infoResult.body?.trim();
          }
          const fwResult = await this.httpGet(ipAddress, '/cgi-bin/ConfigManApp.com?key=P-FWVersion', creds);
          if (fwResult.ok) {
            firmwareVersion = fwResult.body?.trim();
          }
        } catch {
          // Device info is optional
        }
      }

      return {
        reachable: httpReachable,
        httpReachable,
        sipReachable: undefined, // SIP OPTIONS requires a SIP stack
        latencyMs: Date.now() - start,
        deviceModel,
        firmwareVersion,
      };
    } catch (err) {
      return {
        reachable: false,
        httpReachable: false,
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Device test failed',
      };
    }
  }

  async provisionSipAccount(ipAddress: string, sipConfig: DeviceSipProvision): Promise<ProvisionResult> {
    const ipCheck = validateDeviceIp(ipAddress);
    if (!ipCheck.valid) {
      return { success: false, message: `Invalid device IP: ${ipCheck.reason}`, error: ipCheck.reason };
    }

    const lineIdx = sipConfig.lineIndex ?? 1;
    const creds = requireCredentials();

    // Fanvil parameter mapping for SIP Line 1
    // P-prefixed parameters are the standard Fanvil CGI parameter names
    const params: Record<string, string> = {
      [`P-SIPServerAddr${lineIdx}`]: sipConfig.sipServer,
      [`P-SIPServerPort${lineIdx}`]: String(sipConfig.sipPort),
      [`P-SIPTransport${lineIdx}`]: this.mapTransport(sipConfig.transport),
      [`P-SIPUser${lineIdx}`]: sipConfig.username,
      [`P-SIPAuthUser${lineIdx}`]: sipConfig.username,
      [`P-SIPAuthPwd${lineIdx}`]: sipConfig.password,
      [`P-SIPDisplayName${lineIdx}`]: sipConfig.displayName || sipConfig.username,
    };

    if (sipConfig.domain) {
      params[`P-SIPDomain${lineIdx}`] = sipConfig.domain;
    }

    const errors: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      try {
        const result = await this.httpGet(
          ipAddress,
          `/cgi-bin/ConfigManApp.com?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`,
          creds,
        );
        if (!result.ok) {
          errors.push(`${key}: HTTP ${result.status}`);
        }
      } catch (err) {
        errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: `Provisioning partially failed: ${errors.join('; ')}`,
        requiresReboot: true,
        error: errors.join('; '),
      };
    }

    return {
      success: true,
      message: `SIP Line ${lineIdx} provisioned on Fanvil device ${ipAddress}. Server: ${sipConfig.sipServer}:${sipConfig.sipPort} (${sipConfig.transport})`,
      requiresReboot: true,
    };
  }

  async getDeviceInfo(ipAddress: string, credentials?: DeviceCredentials): Promise<IntercomDeviceInfo> {
    const creds = requireCredentials(credentials);

    const [modelResp, fwResp, macResp] = await Promise.allSettled([
      this.httpGet(ipAddress, '/cgi-bin/ConfigManApp.com?key=P-Model', creds),
      this.httpGet(ipAddress, '/cgi-bin/ConfigManApp.com?key=P-FWVersion', creds),
      this.httpGet(ipAddress, '/cgi-bin/ConfigManApp.com?key=P-MACAddr', creds),
    ]);

    return {
      brand: 'fanvil',
      model: modelResp.status === 'fulfilled' && modelResp.value.ok ? modelResp.value.body?.trim() || 'Unknown' : 'Unknown',
      firmwareVersion: fwResp.status === 'fulfilled' && fwResp.value.ok ? fwResp.value.body?.trim() || 'Unknown' : 'Unknown',
      macAddress: macResp.status === 'fulfilled' && macResp.value.ok ? macResp.value.body?.trim() : undefined,
      ipAddress,
      relayCount: 2, // Most Fanvil intercoms have 2 relay outputs
      cameraEnabled: true, // Most video intercoms
    };
  }

  async triggerDoorRelay(ipAddress: string, credentials?: DeviceCredentials, relayIndex = 1): Promise<DoorActionResult> {
    const ipCheck = validateDeviceIp(ipAddress);
    if (!ipCheck.valid) {
      return { success: false, relayIndex, message: `Invalid device IP: ${ipCheck.reason}`, error: ipCheck.reason };
    }

    // Validate relay index bounds (Fanvil intercoms have 1-2 relays)
    if (relayIndex < 1 || relayIndex > 4) {
      return { success: false, relayIndex, message: 'Relay index must be between 1 and 4', error: 'Invalid relay index' };
    }

    const creds = requireCredentials(credentials);

    try {
      const result = await this.httpGet(
        ipAddress,
        `/cgi-bin/ConfigManApp.com?key=Output${relayIndex}&value=1`,
        creds,
      );

      if (result.ok) {
        emitSecurityAudit({
          event: 'door.open',
          tenantId: 'device',
          ipAddress,
          detail: `Relay ${relayIndex} triggered (creds user=${creds.username}, pass=${maskPassword(creds.password)})`,
        });
        return {
          success: true,
          relayIndex,
          message: `Door relay ${relayIndex} triggered successfully`,
        };
      }

      return {
        success: false,
        relayIndex,
        message: `Relay trigger returned HTTP ${result.status}`,
        error: result.body || 'Unknown error',
      };
    } catch (err) {
      return {
        success: false,
        relayIndex,
        message: 'Failed to trigger door relay',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async rebootDevice(ipAddress: string, credentials?: DeviceCredentials): Promise<{ success: boolean; error?: string }> {
    const creds = requireCredentials(credentials);

    try {
      await this.httpGet(ipAddress, '/cgi-bin/ConfigManApp.com?key=Reboot&value=1', creds);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  getProvisioningTemplate(sipConfig: SipServerConfig): Record<string, string> {
    return {
      'SIP Server (P-SIPServerAddr1)': sipConfig.host,
      'SIP Port (P-SIPServerPort1)': String(sipConfig.port),
      'Transport (P-SIPTransport1)': this.mapTransport(sipConfig.transport),
      'SIP Domain (P-SIPDomain1)': sipConfig.domain || sipConfig.host,
      'DTMF Mode': 'RFC2833',
      'Auto Answer': 'Enabled (P-AutoAnswer1=1)',
      'Relay 1 Hold Time (P3292)': '5 seconds',
      'SRTP': sipConfig.srtp ? 'Enabled' : 'Disabled',
      'Outbound Proxy': sipConfig.outboundProxy || 'N/A',
    };
  }

  getAutoProvisionUrl(deviceIp: string, param: string, value: string): string {
    return `http://${deviceIp}/cgi-bin/ConfigManApp.com?key=${encodeURIComponent(param)}&value=${encodeURIComponent(value)}`;
  }

  // ── Private Helpers ───────────────────────────────────────

  private extractCredentials(deviceConfig?: Record<string, unknown>): DeviceCredentials {
    const envCreds = getEnvCredentials();
    if (!deviceConfig) {
      if (envCreds) return envCreds;
      throw new Error('Fanvil device credentials not configured. Set FANVIL_ADMIN_USER/FANVIL_ADMIN_PASSWORD in backend .env.');
    }
    const username = (deviceConfig.adminUser as string) || envCreds?.username;
    const password = (deviceConfig.adminPassword as string) || envCreds?.password;
    if (!username || !password) {
      throw new Error('Fanvil device credentials incomplete. Both adminUser and adminPassword are required.');
    }
    return { username, password };
  }

  private mapTransport(transport: string): string {
    const map: Record<string, string> = { udp: '0', tcp: '1', tls: '2', wss: '3' };
    return map[transport.toLowerCase()] || '0';
  }

  private async httpGet(ip: string, path: string, creds: DeviceCredentials): Promise<{ ok: boolean; status: number; body?: string }> {
    const auth = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FANVIL_HTTP_TIMEOUT);

    try {
      const resp = await fetch(`http://${ip}${path}`, {
        headers: { Authorization: `Basic ${auth}` },
        signal: controller.signal,
      });
      const body = await resp.text();
      return { ok: resp.ok, status: resp.status, body };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, status: 0, body: 'Request timeout' };
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}
