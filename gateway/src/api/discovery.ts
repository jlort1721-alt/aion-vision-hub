import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

const discoverSchema = z.object({
  networkRange: z.string().default('192.168.1.0/24'),
  timeout: z.number().int().min(1000).max(30000).default(10000),
});

const identifySchema = z.object({
  ip: z.string().ip(),
  port: z.number().int().min(1).max(65535).default(80),
});

export function registerDiscoveryRoutes(app: FastifyInstance) {
  const discoveryService = (app as any).discoveryService;

  // Discover devices on the network
  app.post('/api/discovery/scan', async (request, reply) => {
    const parsed = discoverSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }
    const devices = await discoveryService.discoverAll(parsed.data.networkRange, parsed.data.timeout);
    return { devices, count: devices.length };
  });

  // Identify a specific device by IP
  app.post('/api/discovery/identify', async (request, reply) => {
    const parsed = identifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.issues });
    }
    const identity = await discoveryService.identifyDevice(parsed.data.ip, parsed.data.port);
    if (!identity) {
      return reply.code(404).send({ error: 'Device not identified' });
    }
    return identity;
  });
}
