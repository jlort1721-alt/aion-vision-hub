import type { FastifyInstance } from 'fastify';

export function registerHealthRoutes(app: FastifyInstance) {
  // Basic liveness probe
  app.get('/health', async () => ({
    status: 'ok',
    service: 'aion-gateway',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  // Readiness probe with component details
  app.get('/health/ready', async () => {
    const deviceManager = (app as any).deviceManager;
    const streamManager = (app as any).streamManager;
    const reconnectManager = (app as any).reconnectManager;
    const eventIngestion = (app as any).eventIngestion;
    const eventListener = (app as any).eventListener;
    const playbackManager = (app as any).playbackManager;

    const connectedDevices = deviceManager.listConnected();
    const activeStreams = streamManager.listActive();
    const memUsage = process.memoryUsage();

    return {
      status: 'ready',
      components: {
        deviceManager: {
          status: 'ok',
          connectedDevices: connectedDevices.length,
          devices: connectedDevices.map((d: any) => ({
            id: d.id,
            brand: d.brand,
          })),
        },
        streamManager: {
          status: 'ok',
          activeStreams: activeStreams.length,
          mediamtxHealthy: streamManager.isMediaMTXHealthy(),
          streams: activeStreams.map((s: any) => ({
            deviceId: s.deviceId,
            type: s.streamType,
            healthy: s.healthy,
            startedAt: s.startedAt,
          })),
        },
        reconnectManager: reconnectManager ? {
          status: 'ok',
          pendingReconnects: reconnectManager.getStatus().length,
          entries: reconnectManager.getStatus(),
        } : { status: 'not_initialized' },
        eventIngestion: eventIngestion ? {
          status: 'ok',
          ...eventIngestion.getStats(),
        } : { status: 'not_initialized' },
        eventListener: eventListener ? {
          status: 'ok',
          activeListeners: eventListener.getActiveListeners().length,
          listeners: eventListener.getActiveListeners(),
        } : { status: 'not_initialized' },
        playbackManager: playbackManager ? {
          status: 'ok',
          activeSessions: playbackManager.listSessions().length,
        } : { status: 'not_initialized' },
      },
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryMB: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
        },
        nodeVersion: process.version,
        platform: process.platform,
      },
      timestamp: new Date().toISOString(),
    };
  });

  // Detailed device health endpoint
  app.get('/health/devices', async () => {
    const deviceManager = (app as any).deviceManager;
    const connected = deviceManager.listConnected();

    const healthReports = await Promise.allSettled(
      connected.map(async (device: any) => {
        const health = await deviceManager.getHealth(device.id);
        return {
          deviceId: device.id,
          brand: device.brand,
          ...health,
        };
      })
    );

    return {
      total: connected.length,
      healthy: healthReports.filter(
        (r) => r.status === 'fulfilled' && r.value.online
      ).length,
      unhealthy: healthReports.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.online)
      ).length,
      devices: healthReports.map((r) =>
        r.status === 'fulfilled'
          ? r.value
          : { error: r.reason?.message || 'Health check failed' }
      ),
    };
  });
}
