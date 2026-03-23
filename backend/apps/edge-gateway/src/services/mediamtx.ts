// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Integration of WebRTC in Edge Gateway
// Edge proxy config to route streams to MediaMTX locally
// ═══════════════════════════════════════════════════════════

import { FastifyInstance } from 'fastify';

/**
 * Validates MediaMTX health and routes SDP offers directly
 * to the internal RTSP-to-WebRTC engine.
 */
export async function mediamtxPlugin(app: FastifyInstance) {
  const MEDIAMTX_API = process.env.MEDIAMTX_API_URL || 'http://mediamtx:9997/v3';

  // 1. Health Status check (internal validation)
  app.get('/api/v1/streams/health', async (_request, reply) => {
    try {
      const response = await fetch(`${MEDIAMTX_API}/paths/list`);
      if (!response.ok) throw new Error('MediaMTX API down');
      
      const payload = await response.json() as { items?: Array<{ ready: boolean; name: string }> };
      const activePaths = payload.items?.filter((i) => i.ready) || [];
      
      return { 
        status: 'healthy',
        engine: 'MediaMTX',
        active_streams: activePaths.length,
        streams: activePaths.map((p: any) => p.name)
      };
    } catch (error: any) {
      app.log.error(`[MediaMTX] Engine unreachable: ${error.message}`);
      return reply.code(503).send({ 
        status: 'down', 
        error: 'Video engine is currently unreachable' 
      });
    }
  });

  // 2. Add source stream dynamically
  app.post('/api/v1/streams/add', async (request, reply) => {
    const { streamId, sourceUrl } = request.body as { streamId: string, sourceUrl: string };
    if (!streamId || !sourceUrl) {
      return reply.code(400).send({ error: 'streamId and sourceUrl are required' });
    }

    try {
      // Create a proxy path in MediaMTX mapping streamId -> sourceUrl (RTSP/ONVIF)
      const response = await fetch(`${MEDIAMTX_API}/config/paths/add/${streamId}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            source: sourceUrl,
            sourceOnDemand: true, // Connect to camera only when client watches
            runOnDemandStartTimeout: '10s',
         })
      });

      if (!response.ok) throw new Error(await response.text());

      return { success: true, streamId, mappedUrl: sourceUrl };
    } catch (error: any) {
      app.log.error(`[MediaMTX] Failed to add stream proxy: ${error.message}`);
      return reply.code(500).send({ error: 'Failed to configure stream engine' });
    }
  });

  // 3. Delete source stream dynamically
  app.delete('/api/v1/streams/:streamId', async (request, reply) => {
    const { streamId } = request.params as { streamId: string };
    try {
      const response = await fetch(`${MEDIAMTX_API}/config/paths/delete/${streamId}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(await response.text());
      return { success: true };
    } catch (error: any) {
      return reply.code(500).send({ error: 'Failed to remove stream proxy' });
    }
  });
}
