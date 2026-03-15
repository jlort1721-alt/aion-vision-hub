import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import type { WebSocket } from 'ws';
import { createLogger } from '@aion/common-utils';

const logger = createLogger({ name: 'websocket' });

interface WSClient {
  ws: WebSocket;
  tenantId: string;
  userId: string;
  userEmail: string;
  subscribedChannels: Set<string>;
  lastPing: number;
}

// Global client registry
const clients = new Map<string, WSClient>();

// Ping interval handle
let pingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Broadcast a message to all connected clients for a specific tenant.
 */
export function broadcast(tenantId: string, channel: string, payload: unknown): void {
  const message = JSON.stringify({ channel, payload, timestamp: new Date().toISOString() });

  for (const [id, client] of clients) {
    if (client.tenantId !== tenantId) continue;
    if (client.subscribedChannels.size > 0 && !client.subscribedChannels.has(channel)) continue;

    try {
      if (client.ws.readyState === client.ws.OPEN) {
        client.ws.send(message);
      }
    } catch (err) {
      logger.error({ clientId: id, error: err }, 'Error broadcasting to client');
    }
  }
}

/**
 * Get count of connected clients per tenant.
 */
export function getConnectedClients(tenantId?: string): { total: number; byTenant: Record<string, number> } {
  const byTenant: Record<string, number> = {};
  for (const client of clients.values()) {
    byTenant[client.tenantId] = (byTenant[client.tenantId] ?? 0) + 1;
  }
  return {
    total: clients.size,
    byTenant: tenantId ? { [tenantId]: byTenant[tenantId] ?? 0 } : byTenant,
  };
}

async function websocketPlugin(app: FastifyInstance) {
  await app.register(websocket);

  // WebSocket endpoint — requires JWT token as query param
  app.get('/ws', { websocket: true }, (socket, request) => {
    const token = (request.query as Record<string, string>).token;

    if (!token) {
      socket.send(JSON.stringify({ error: 'Missing token' }));
      socket.close(1008, 'Missing token');
      return;
    }

    // Verify JWT
    let payload: { sub: string; email: string; tenant_id: string; role: string };
    try {
      payload = app.jwt.verify<typeof payload>(token);
    } catch {
      socket.send(JSON.stringify({ error: 'Invalid token' }));
      socket.close(1008, 'Invalid token');
      return;
    }

    const clientId = crypto.randomUUID();
    const client: WSClient = {
      ws: socket,
      tenantId: payload.tenant_id,
      userId: payload.sub,
      userEmail: payload.email,
      subscribedChannels: new Set(),
      lastPing: Date.now(),
    };

    clients.set(clientId, client);
    logger.info({ clientId, tenantId: payload.tenant_id, userId: payload.sub }, 'WebSocket client connected');

    // Send welcome message
    socket.send(JSON.stringify({
      channel: 'system',
      payload: { type: 'connected', clientId, connectedClients: getConnectedClients(payload.tenant_id).total },
      timestamp: new Date().toISOString(),
    }));

    // Handle incoming messages (subscribe/unsubscribe/pong)
    socket.on('message', (raw: any) => {
      try {
        const msg = JSON.parse(raw.toString());
        client.lastPing = Date.now();

        switch (msg.type) {
          case 'subscribe':
            if (typeof msg.channel === 'string') {
              client.subscribedChannels.add(msg.channel);
              socket.send(JSON.stringify({ channel: 'system', payload: { type: 'subscribed', channel: msg.channel } }));
            }
            break;
          case 'unsubscribe':
            if (typeof msg.channel === 'string') {
              client.subscribedChannels.delete(msg.channel);
            }
            break;
          case 'pong':
            client.lastPing = Date.now();
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on('close', () => {
      clients.delete(clientId);
      logger.info({ clientId }, 'WebSocket client disconnected');
    });

    socket.on('error', (err: any) => {
      logger.error({ clientId, error: err }, 'WebSocket error');
      clients.delete(clientId);
    });
  });

  // Ping/pong keep-alive every 30 seconds
  pingInterval = setInterval(() => {
    const now = Date.now();
    const timeout = 60000; // 60s without pong = dead

    for (const [id, client] of clients) {
      if (now - client.lastPing > timeout) {
        logger.info({ clientId: id }, 'WebSocket client timed out');
        client.ws.close(1001, 'Timeout');
        clients.delete(id);
        continue;
      }

      try {
        if (client.ws.readyState === client.ws.OPEN) {
          client.ws.send(JSON.stringify({ channel: 'system', payload: { type: 'ping' } }));
        }
      } catch {
        clients.delete(id);
      }
    }
  }, 30000);

  // Cleanup on shutdown
  app.addHook('onClose', () => {
    if (pingInterval) clearInterval(pingInterval);
    for (const [id, client] of clients) {
      client.ws.close(1001, 'Server shutting down');
      clients.delete(id);
    }
  });
}

export default fp(websocketPlugin, { name: 'websocket', dependencies: ['auth'] });
