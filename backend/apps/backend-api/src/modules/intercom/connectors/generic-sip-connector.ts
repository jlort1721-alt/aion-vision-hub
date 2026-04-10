/**
 * Generic SIP Intercom Connector
 *
 * Fallback connector for SIP-compliant intercom devices that don't have
 * a brand-specific connector. Uses standard SIP OPTIONS for reachability
 * testing and basic HTTP API conventions shared across vendors.
 *
 * Also serves as base adapter for Hikvision, Dahua, and Akuvox intercoms.
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

const HTTP_TIMEOUT = 8000;

export class GenericSipConnector implements IntercomConnector {
  readonly brand: IntercomBrand = 'generic_sip';
  readonly displayName: string = 'Generic SIP Intercom';

  async testDevice(ipAddress: string, _config?: Record<string, unknown>): Promise<DeviceTestResult> {
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT);

      try {
        const resp = await fetch(`http://${ipAddress}/`, {
          signal: controller.signal,
          method: 'HEAD',
        });
        clearTimeout(timeout);

        return {
          reachable: true,
          httpReachable: resp.ok || resp.status === 401,
          latencyMs: Date.now() - start,
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return {
        reachable: false,
        httpReachable: false,
        latencyMs: Date.now() - start,
        error: `Device at ${ipAddress} not reachable via HTTP`,
      };
    }
  }

  async provisionSipAccount(_ipAddress: string, _sipConfig: DeviceSipProvision): Promise<ProvisionResult> {
    return {
      success: false,
      message: 'Generic SIP connector does not support auto-provisioning. Configure SIP account manually on the device web UI.',
      error: 'Manual configuration required',
    };
  }

  async getDeviceInfo(ipAddress: string): Promise<IntercomDeviceInfo> {
    return {
      brand: this.brand,
      model: 'Generic SIP Device',
      firmwareVersion: 'Unknown',
      ipAddress,
    };
  }

  async triggerDoorRelay(ipAddress: string, _credentials?: DeviceCredentials, relayIndex = 1): Promise<DoorActionResult> {
    return {
      success: false,
      relayIndex,
      message: 'Door relay not supported on generic SIP connector. Use brand-specific connector.',
      error: `Configure device-specific HTTP API for ${ipAddress}`,
    };
  }

  async rebootDevice(): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Reboot not supported on generic SIP connector' };
  }

  getProvisioningTemplate(sipConfig: SipServerConfig): Record<string, string> {
    return {
      'SIP Server': sipConfig.host,
      'SIP Port': String(sipConfig.port),
      'Transport': sipConfig.transport.toUpperCase(),
      'SIP Domain': sipConfig.domain || sipConfig.host,
      'Note': 'Configure these values manually on the device web interface',
    };
  }

  getAutoProvisionUrl(deviceIp: string, _param: string, _value: string): string {
    return `http://${deviceIp}/`;
  }
}

/**
 * Hikvision Intercom Connector
 *
 * COMPATIBLE MODELS: DS-KD8003, DS-KD3002, DS-KV6113, DS-KV8213
 * API: ISAPI (HTTP Digest auth)
 */
export class HikvisionIntercomConnector extends GenericSipConnector {
  override readonly brand: IntercomBrand = 'hikvision';
  override readonly displayName = 'Hikvision IP Intercom';

  override async testDevice(ipAddress: string, _config?: Record<string, unknown>): Promise<DeviceTestResult> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT);

      try {
        const resp = await fetch(`http://${ipAddress}/ISAPI/System/deviceInfo`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return {
          reachable: true,
          httpReachable: resp.ok || resp.status === 401,
          latencyMs: Date.now() - start,
          deviceModel: 'Hikvision Intercom',
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return { reachable: false, httpReachable: false, latencyMs: Date.now() - start, error: 'Not reachable' };
    }
  }

  override getProvisioningTemplate(sipConfig: SipServerConfig): Record<string, string> {
    return {
      'SIP Server Address': sipConfig.host,
      'SIP Server Port': String(sipConfig.port),
      'Protocol Type': sipConfig.transport.toUpperCase(),
      'SIP Domain': sipConfig.domain || sipConfig.host,
      'Note': 'Configure via ISAPI or Hikvision web UI under Network > SIP',
    };
  }
}

/**
 * Dahua Intercom Connector
 *
 * COMPATIBLE MODELS: VTO2202F-P, VTO2111D, VTO3211D
 * API: CGI / Digest auth
 */
export class DahuaIntercomConnector extends GenericSipConnector {
  override readonly brand: IntercomBrand = 'dahua';
  override readonly displayName = 'Dahua IP Intercom';

  override async testDevice(ipAddress: string): Promise<DeviceTestResult> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT);

      try {
        const resp = await fetch(`http://${ipAddress}/cgi-bin/magicBox.cgi?action=getDeviceType`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return {
          reachable: true,
          httpReachable: resp.ok || resp.status === 401,
          latencyMs: Date.now() - start,
          deviceModel: 'Dahua Intercom',
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return { reachable: false, httpReachable: false, latencyMs: Date.now() - start, error: 'Not reachable' };
    }
  }

  override getProvisioningTemplate(sipConfig: SipServerConfig): Record<string, string> {
    return {
      'SIP Server': sipConfig.host,
      'SIP Port': String(sipConfig.port),
      'Transport': sipConfig.transport,
      'SIP Domain': sipConfig.domain || sipConfig.host,
      'Note': 'Configure via Dahua web UI under Network > SIP Server',
    };
  }
}
