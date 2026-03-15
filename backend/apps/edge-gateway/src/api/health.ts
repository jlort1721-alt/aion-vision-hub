import type { FastifyInstance } from 'fastify';
import type { DeviceManager } from '../services/device-manager.js';
import type { HealthMonitor } from '../services/health-monitor.js';
import type { StreamManager } from '../services/stream-manager.js';

const startTime = Date.now();

export async function registerHealthRoutes(
  app: FastifyInstance,
  deviceManager: DeviceManager,
  healthMonitor: HealthMonitor,
  streamManager: StreamManager,
) {
  app.get('/health', async () => ({
    status: 'healthy',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    gatewayId: process.env.GATEWAY_ID ?? 'gw-default',
    connectedDevices: deviceManager.listDevices().length,
    activeStreams: streamManager.listRegistrations().length,
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/ready', async () => ({
    status: 'ready',
    timestamp: new Date().toISOString(),
  }));

  app.get('/health/devices', async () => {
    const health = healthMonitor.getAllHealth();
    return {
      success: true,
      data: health.map((h) => ({
        deviceId: h.deviceId,
        online: h.health.online,
        latencyMs: h.health.latencyMs,
        consecutiveFailures: h.consecutiveFailures,
        lastSuccess: h.lastSuccess?.toISOString(),
        errors: h.health.errors,
      })),
    };
  });
}
