import type { FastifyInstance } from 'fastify';
import type { EventIngestionService } from '../services/event-ingestion.js';
import type { DeviceManager } from '../services/device-manager.js';

export async function registerEventRoutes(
  app: FastifyInstance,
  deviceManager: DeviceManager,
  eventService: EventIngestionService,
) {
  app.post('/events/subscribe', async (request, reply) => {
    const { deviceId } = request.body as { deviceId: string };
    if (!deviceManager.isConnected(deviceId)) {
      reply.code(404).send({ success: false, error: { code: 'DEVICE_NOT_FOUND', message: 'Device not connected' } });
      return;
    }
    await eventService.subscribe(deviceId);
    return { success: true };
  });

  app.delete('/events/unsubscribe/:deviceId', async (request) => {
    const { deviceId } = request.params as { deviceId: string };
    eventService.unsubscribe(deviceId);
    return { success: true };
  });

  // WebSocket route for real-time event streaming
  app.get('/events/stream', { websocket: true }, (socket, _request) => {
    const removeCallback = eventService.onCallback((event) => {
      try {
        socket.send(JSON.stringify({
          type: 'event.new',
          payload: event,
          timestamp: new Date().toISOString(),
        }));
      } catch {
        // Client disconnected
      }
    });

    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch {
        // Ignore invalid messages
      }
    });

    socket.on('close', () => {
      removeCallback();
    });
  });
}
