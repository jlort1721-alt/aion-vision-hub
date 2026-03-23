import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import type { WebSocket } from 'ws';
import { createLogger } from '@aion/common-utils';
import { redisPublisher, redisSubscriber } from '../lib/redis.js';

const logger = createLogger({ name: 'websocket' });

interface WSClient {
  ws: WebSocket;
  tenantId: string;
  userId: string;
  userEmail: string;
  subscribedChannels: Set<string>;
  lastPing: number;
}

// Local client registry (this instance's connections only)
const clients = new Map<string, WSClient>();

// Ping interval handle
let pingInterval: ReturnType<typeof setInterval> | null = null;

// Redis pub/sub channel prefix
const PUBSUB_PREFIX = 'ws:broadcast:';

/**
 * Deliver a message to local clients for a specific tenant/channel.
 */
function deliverLocal(tenantId: string, channel: string, payload: unknown): void {
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
 * Broadcast a message to all connected clients for a specific tenant.
 * When Redis is configured, publishes to Redis pub/sub so all instances receive it.
 * When Redis is not configured, delivers only to local clients.
 */
export function broadcast(tenantId: string, channel: string, payload: unknown): void {
  // Always deliver locally
  deliverLocal(tenantId, channel, payload);

  // Publish to Redis for cross-instance delivery
  if (redisPublisher) {
    const msg = JSON.stringify({ tenantId, channel, payload });
    redisPublisher.publish(`${PUBSUB_PREFIX}${tenantId}`, msg).catch((err: Error) => {
      logger.error({ err }, 'Failed to publish WebSocket broadcast to Redis');
    });
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

/** Track which tenant channels we're subscribed to in Redis. */
const subscribedTenants = new Set<string>();

function ensureRedisSubscription(tenantId: string): void {
  if (!redisSubscriber || subscribedTenants.has(tenantId)) return;
  subscribedTenants.add(tenantId);

  const channel = `${PUBSUB_PREFIX}${tenantId}`;
  redisSubscriber.subscribe(channel).catch((err: Error) => {
    logger.error({ err, channel }, 'Failed to subscribe to Redis channel');
    subscribedTenants.delete(tenantId);
  });
}

async function websocketPlugin(app: FastifyInstance) {
  await app.register(websocket);

  // Raise max listeners on the underlying WebSocket server
  if (app.websocketServer) {
    app.websocketServer.setMaxListeners(20);
  }

  // Set up Redis subscriber to receive cross-instance broadcasts
  if (redisSubscriber) {
    redisSubscriber.on('message', (_channel: string, message: string) => {
      try {
        const { tenantId, channel: wsChannel, payload } = JSON.parse(message);
        // Deliver to local clients only (avoid re-publishing loop)
        deliverLocal(tenantId, wsChannel, payload);
      } catch (err) {
        logger.error({ err }, 'Error handling Redis pub/sub message');
      }
    });
  }

  // WebSocket endpoint — supports two auth methods:
  // 1. First message: { type: 'auth', token: '...' } (preferred, token not in logs)
  // 2. Query param: ?token=... (legacy, kept for backward compatibility)
  app.get('/ws', { websocket: true }, (socket, request) => {
    const queryToken = (request.query as Record<string, string>).token;

    // Helper to register an authenticated client
    function registerClient(jwtPayload: { sub: string; email: string; tenant_id: string; role: string }): void {
      const clientId = crypto.randomUUID();
      const client: WSClient = {
        ws: socket,
        tenantId: jwtPayload.tenant_id,
        userId: jwtPayload.sub,
        userEmail: jwtPayload.email,
        subscribedChannels: new Set(),
        lastPing: Date.now(),
      };

      clients.set(clientId, client);
      ensureRedisSubscription(jwtPayload.tenant_id);

      logger.info({ clientId, tenantId: jwtPayload.tenant_id, userId: jwtPayload.sub }, 'WebSocket client connected');

      socket.send(JSON.stringify({
        channel: 'system',
        payload: { type: 'connected', clientId, connectedClients: getConnectedClients(jwtPayload.tenant_id).total },
        timestamp: new Date().toISOString(),
      }));

      // Handle subsequent messages (subscribe/unsubscribe/pong)
      socket.on('message', (raw: Buffer | string) => {
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

      socket.on('error', (err: Error) => {
        logger.error({ clientId, error: err }, 'WebSocket error');
        clients.delete(clientId);
      });
    }

    // Path 1: Legacy query param auth (backward compatibility)
    if (queryToken) {
      let payload: { sub: string; email: string; tenant_id: string; role: string };
      try {
        payload = app.jwt.verify<typeof payload>(queryToken);
      } catch {
        socket.send(JSON.stringify({ error: 'Invalid token' }));
        socket.close(1008, 'Invalid token');
        return;
      }
      registerClient(payload);
      return;
    }

    // Path 2: First-message auth (preferred — token not in URL/logs)
    // Wait for the first message to be an auth message within 10 seconds
    const authTimeout = setTimeout(() => {
      socket.send(JSON.stringify({ error: 'Auth timeout — send { type: "auth", token: "..." } within 10s' }));
      socket.close(1008, 'Auth timeout');
    }, 10000);

    socket.once('message', (raw: Buffer | string) => {
      clearTimeout(authTimeout);
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type !== 'auth' || typeof msg.token !== 'string') {
          socket.send(JSON.stringify({ error: 'First message must be { type: "auth", token: "..." }' }));
          socket.close(1008, 'Invalid auth message');
          return;
        }

        let payload: { sub: string; email: string; tenant_id: string; role: string };
        try {
          payload = app.jwt.verify<typeof payload>(msg.token);
        } catch {
          socket.send(JSON.stringify({ error: 'Invalid token' }));
          socket.close(1008, 'Invalid token');
          return;
        }

        registerClient(payload);
      } catch {
        socket.send(JSON.stringify({ error: 'Invalid message format' }));
        socket.close(1008, 'Invalid message');
      }
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
