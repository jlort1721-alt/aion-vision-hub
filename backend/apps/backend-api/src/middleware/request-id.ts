import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

export function registerRequestId(app: FastifyInstance): void {
  app.addHook('onRequest', async (request) => {
    const requestId = (request.headers['x-request-id'] as string) ?? randomUUID();
    request.headers['x-request-id'] = requestId;
  });

  app.addHook('onSend', async (_request, reply) => {
    reply.header('x-request-id', _request.headers['x-request-id']);
  });
}
