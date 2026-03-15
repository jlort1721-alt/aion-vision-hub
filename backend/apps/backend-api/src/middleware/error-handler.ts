import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '@aion/shared-contracts';
import { ZodError } from 'zod';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
    const logger = request.log ?? app.log;

    // AppError — our typed errors
    if (error instanceof AppError) {
      logger.warn({ code: error.code, message: error.message }, 'Application error');
      reply.code(error.statusCode).send({
        success: false,
        error: error.toJSON(),
      });
      return;
    }

    // Zod validation errors
    if (error instanceof ZodError) {
      const details = error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      reply.code(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: { issues: details },
        },
      });
      return;
    }

    // Fastify validation errors
    if ('validation' in error && error.validation) {
      reply.code(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
        },
      });
      return;
    }

    // Unexpected errors
    logger.error({ err: error }, 'Unhandled error');
    reply.code(500).send({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      },
    });
  });
}
