/**
 * eWeLink Router — MCP-first with Direct API fallback
 *
 * Attempts MCP for all operations. If MCP fails 3 consecutive times
 * or times out, automatically switches to direct API.
 * Periodically checks MCP health to restore it as primary.
 */
import { createLogger } from '@aion/common-utils';
import type { EwelinkMCPClient } from './ewelink-mcp.js';
import type { EwelinkDirectService, EwelinkDevice } from './ewelink-direct.js';

const logger = createLogger({ name: 'ewelink-router' });

export interface RouterStatus {
  mcp: 'online' | 'degraded' | 'offline';
  direct: 'online' | 'offline';
  activeSource: 'mcp' | 'direct';
  lastMcpError?: string;
  lastMcpErrorTime?: string;
  consecutiveMcpFailures: number;
}

export class EwelinkRouter {
  private mcp: EwelinkMCPClient;
  private direct: EwelinkDirectService;
  private mcpTimeoutMs: number;
  private fallbackEnabled: boolean;

  private mcpHealthy = true;
  private consecutiveMcpFailures = 0;
  private lastMcpError: string | null = null;
  private lastMcpErrorTime: Date | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  private static readonly MAX_MCP_FAILURES = 3;

  constructor(options: {
    mcpService: EwelinkMCPClient;
    directService: EwelinkDirectService;
    mcpTimeoutMs?: number;
    fallbackEnabled?: boolean;
  }) {
    this.mcp = options.mcpService;
    this.direct = options.directService;
    this.mcpTimeoutMs = options.mcpTimeoutMs || 5000;
    this.fallbackEnabled = options.fallbackEnabled !== false;
  }

  /** Start periodic health checks */
  startHealthChecks(intervalMs = 60000): void {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    this.healthCheckTimer = setInterval(() => this.healthCheck(), intervalMs);
  }

  /** Stop health checks */
  stop(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /** Check MCP health and restore if recovered */
  async healthCheck(): Promise<void> {
    if (this.mcpHealthy) return; // Already healthy

    try {
      if (!this.mcp.isConfigured()) {
        this.mcpHealthy = false;
        return;
      }
      // Try a lightweight MCP call
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.mcpTimeoutMs);
      await this.mcp.getDevices();
      clearTimeout(timeout);

      // MCP recovered
      this.mcpHealthy = true;
      this.consecutiveMcpFailures = 0;
      logger.info('MCP eWeLink recovered — restored as primary');
    } catch {
      // Still down
    }
  }

  /** Get current status */
  getStatus(): RouterStatus {
    return {
      mcp: this.mcpHealthy ? 'online' : this.consecutiveMcpFailures > 0 ? 'degraded' : 'offline',
      direct: this.direct.isHealthy() ? 'online' : 'offline',
      activeSource: this.mcpHealthy ? 'mcp' : 'direct',
      lastMcpError: this.lastMcpError || undefined,
      lastMcpErrorTime: this.lastMcpErrorTime?.toISOString(),
      consecutiveMcpFailures: this.consecutiveMcpFailures,
    };
  }

  /** Try MCP with timeout, return null on failure */
  private async tryMcp<T>(fn: () => Promise<T>): Promise<T | null> {
    if (!this.mcpHealthy || !this.mcp.isConfigured()) return null;

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('MCP_TIMEOUT')), this.mcpTimeoutMs)
        ),
      ]);
      // MCP succeeded — reset failure counter
      if (this.consecutiveMcpFailures > 0) {
        this.consecutiveMcpFailures = 0;
        logger.info('MCP eWeLink responding again');
      }
      return result;
    } catch (err) {
      this.consecutiveMcpFailures++;
      this.lastMcpError = (err as Error).message;
      this.lastMcpErrorTime = new Date();

      if (this.consecutiveMcpFailures >= EwelinkRouter.MAX_MCP_FAILURES) {
        this.mcpHealthy = false;
        logger.warn({ failures: this.consecutiveMcpFailures }, 'MCP eWeLink marked offline — switching to direct API');
      }
      return null;
    }
  }

  // ── Public API (used by routes) ────────────────────────────

  async getDevices(): Promise<EwelinkDevice[]> {
    // Try MCP first
    const mcpResult = await this.tryMcp(() => this.mcp.getDevices());
    if (mcpResult) {
      return (mcpResult as unknown as Array<Record<string, unknown>>).map(d => ({
        deviceid: (d.deviceid || d.id || '') as string,
        name: (d.name || '') as string,
        online: d.online === true,
        params: (d.params || {}) as Record<string, unknown>,
        uiid: d.uiid as number,
        account: 'mcp',
      }));
    }

    // Fallback to direct
    if (this.fallbackEnabled && this.direct.isConfigured()) {
      try {
        const devices = await this.direct.getDevices();
        return devices;
      } catch (err) {
        logger.error({ err: (err as Error).message }, 'Direct API also failed');
      }
    }

    return [];
  }

  async toggleDevice(deviceId: string, state: boolean, accountLabel?: string): Promise<{ success: boolean; source: string }> {
    const stateStr = state ? 'on' : 'off';

    // Try MCP
    const mcpResult = await this.tryMcp(() => this.mcp.toggleDevice(deviceId, state));
    if (mcpResult !== null) {
      return { success: true, source: 'mcp' };
    }

    // Fallback to direct
    if (this.fallbackEnabled && this.direct.isConfigured()) {
      const ok = await this.direct.toggleDevice(deviceId, stateStr, accountLabel);
      return { success: ok, source: 'direct' };
    }

    return { success: false, source: 'none' };
  }

  async pulseDevice(deviceId: string, durationMs = 1000, accountLabel?: string): Promise<{ success: boolean; source: string }> {
    // MCP doesn't have pulse — go direct
    if (this.direct.isConfigured()) {
      const ok = await this.direct.pulseDevice(deviceId, durationMs, accountLabel);
      return { success: ok, source: 'direct' };
    }

    // Fallback: toggle on, wait, toggle off via MCP
    const onResult = await this.tryMcp(() => this.mcp.toggleDevice(deviceId, true));
    if (onResult !== null) {
      setTimeout(async () => {
        try { await this.mcp.toggleDevice(deviceId, false); } catch { /* best effort */ }
      }, durationMs);
      return { success: true, source: 'mcp_simulated_pulse' };
    }

    return { success: false, source: 'none' };
  }

  async getDeviceStatus(deviceId: string, accountLabel?: string): Promise<Record<string, unknown> | null> {
    if (this.direct.isConfigured()) {
      return this.direct.getDeviceStatus(deviceId, accountLabel);
    }
    return null;
  }
}
