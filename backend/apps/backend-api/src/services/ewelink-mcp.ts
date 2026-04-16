/**
 * eWeLink MCP Client — Controls smart devices via eWeLink's MCP Server
 * Uses Streamable HTTP MCP transport with SSE responses
 */
import { createLogger } from '@aion/common-utils';
import { fetchWithTimeout } from '../lib/http-client.js';

const logger = createLogger({ name: 'ewelink-mcp' });

// Read env var lazily (not at import time) to ensure dotenv has loaded
function getEwelinkMcpUrl(): string {
  return process.env.EWELINK_MCP_URL || '';
}

interface EwelinkDevice {
  deviceid: string;
  name: string;
  online: boolean;
  params: Record<string, unknown>;
  uiid: number;
  family?: { familyid: string; roomid: string };
}

export class EwelinkMCPClient {
  private sessionId: string | null = null;

  isConfigured(): boolean {
    return !!getEwelinkMcpUrl();
  }

  private async mcpRequest(method: string, params?: Record<string, unknown>, id?: number): Promise<Record<string, unknown>> {
    const url = getEwelinkMcpUrl();
    if (!url) throw new Error('EWELINK_MCP_URL not configured');

    const body: Record<string, unknown> = { jsonrpc: '2.0', method };
    if (id) body.id = id;
    if (params) body.params = params;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };
    if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;

    const resp = await fetchWithTimeout(url, { timeout: 5000,
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const sid = resp.headers.get('mcp-session-id');
    if (sid) this.sessionId = sid;

    const text = await resp.text();
    const dataLines = text.split('\n').filter(l => l.startsWith('data:'));
    if (dataLines.length === 0) return {};
    return JSON.parse(dataLines[0].slice(6)) as Record<string, unknown>;
  }

  async ensureSession(): Promise<void> {
    if (this.sessionId) return;
    await this.mcpRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'aion-vms', version: '1.0' },
    }, 1);
    await this.mcpRequest('notifications/initialized');
    logger.info('eWeLink MCP session established');
  }

  async getDevices(): Promise<EwelinkDevice[]> {
    await this.ensureSession();
    const result = await this.mcpRequest('tools/call', {
      name: 'getBasicInformation',
      arguments: { extraParams: {} },
    }, 10);

    const content = ((result.result as Record<string, unknown>)?.content as Array<{ text: string }>) || [];
    for (const c of content) {
      try {
        const parsed = JSON.parse(c.text);
        if (parsed.devices && Array.isArray(parsed.devices)) {
          logger.info({ count: parsed.devices.length }, 'eWeLink devices fetched');
          return parsed.devices as EwelinkDevice[];
        }
        if (Array.isArray(parsed)) return parsed as EwelinkDevice[];
      } catch { /* continue */ }
    }
    return [];
  }

  async controlDevice(deviceid: string, action: string): Promise<boolean> {
    await this.ensureSession();
    const result = await this.mcpRequest('tools/call', {
      name: 'controlSingleDevice',
      arguments: {
        deviceId: deviceid,
        action,
        extraParams: {},
      },
    }, 20);

    const content = ((result.result as Record<string, unknown>)?.content as Array<{ text: string }>) || [];
    logger.info({ deviceid, action }, 'eWeLink device controlled');
    return content.length > 0;
  }

  async toggleDevice(deviceid: string, on: boolean): Promise<boolean> {
    return this.controlDevice(deviceid, on ? 'turn on' : 'turn off');
  }
}

export const ewelinkMCP = new EwelinkMCPClient();
