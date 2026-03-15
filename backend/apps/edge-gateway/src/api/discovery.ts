import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { networkRangeSchema } from '@aion/common-utils';
import type { DiscoveryService } from '../services/discovery.js';
import { config } from '../config/env.js';

const scanSchema = z.object({
  networkRange: networkRangeSchema.optional(),
  timeout: z.coerce.number().int().min(1000).max(60000).optional(),
  brands: z.array(z.string()).optional(),
});

const identifySchema = z.object({
  ip: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
});

export async function registerDiscoveryRoutes(app: FastifyInstance, discoveryService: DiscoveryService) {
  app.post('/discovery/scan', async (request) => {
    const body = scanSchema.parse(request.body ?? {});
    const result = await discoveryService.scan(
      body.networkRange ?? config.DISCOVERY_NETWORK_RANGE,
      body.timeout ?? config.DISCOVERY_TIMEOUT_MS,
      body.brands,
    );
    return { success: true, data: result };
  });

  app.post('/discovery/identify', async (request) => {
    const body = identifySchema.parse(request.body);
    const result = await discoveryService.identify(body.ip, body.port);
    return { success: true, data: result };
  });

  app.get('/discovery/results', async () => {
    const result = discoveryService.getLastResult();
    return { success: true, data: result };
  });
}
