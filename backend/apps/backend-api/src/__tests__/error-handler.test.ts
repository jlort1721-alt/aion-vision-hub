import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError, z } from 'zod';
import { registerErrorHandler } from '../middleware/error-handler.js';
import { AppError } from '@aion/shared-contracts';

function createMockReply() {
  const reply: any = {
    statusCode: 200,
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply;
}

function createMockRequest() {
  return {
    log: {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  } as any;
}

function createMockApp() {
  let errorHandler: any;
  return {
    setErrorHandler: vi.fn((handler: any) => {
      errorHandler = handler;
    }),
    log: {
      warn: vi.fn(),
      error: vi.fn(),
    },
    getErrorHandler() {
      return errorHandler;
    },
  } as any;
}

describe('registerErrorHandler', () => {
  let app: ReturnType<typeof createMockApp>;
  let reply: ReturnType<typeof createMockReply>;
  let request: ReturnType<typeof createMockRequest>;
  let handler: (error: any, request: any, reply: any) => void;

  beforeEach(() => {
    app = createMockApp();
    reply = createMockReply();
    request = createMockRequest();
    registerErrorHandler(app);
    handler = app.getErrorHandler();
  });

  it('handles AppError with correct status and JSON', () => {
    const error = new AppError('DEVICE_NOT_FOUND', 'Device not found', 404);
    handler(error, request, reply);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found', details: undefined },
    });
    expect(request.log.warn).toHaveBeenCalled();
  });

  it('handles AppError with details', () => {
    const error = new AppError('VALIDATION_ERROR', 'Bad input', 400, { field: 'name' });
    handler(error, request, reply);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Bad input',
        details: { field: 'name' },
      },
    });
  });

  it('handles ZodError with 400 and issue details', () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    let zodError: ZodError;
    try {
      schema.parse({ name: 123, age: 'not-a-number' });
    } catch (e) {
      zodError = e as ZodError;
    }

    handler(zodError!, request, reply);

    expect(reply.code).toHaveBeenCalledWith(400);
    const sent = reply.send.mock.calls[0][0];
    expect(sent.success).toBe(false);
    expect(sent.error.code).toBe('VALIDATION_ERROR');
    expect(sent.error.message).toBe('Invalid request data');
    expect(sent.error.details.issues).toBeInstanceOf(Array);
    expect(sent.error.details.issues.length).toBeGreaterThan(0);
    expect(sent.error.details.issues[0]).toHaveProperty('path');
    expect(sent.error.details.issues[0]).toHaveProperty('message');
  });

  it('handles Fastify validation error', () => {
    const error = {
      message: 'body must have required property "name"',
      validation: [{ keyword: 'required', params: { missingProperty: 'name' } }],
    } as any;

    handler(error, request, reply);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
      },
    });
  });

  it('handles generic Error in development with actual message', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Something unexpected happened');
    handler(error, request, reply);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something unexpected happened',
      },
    });
    expect(request.log.error).toHaveBeenCalled();

    process.env.NODE_ENV = originalEnv;
  });

  it('handles generic Error in production with sanitized message', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('DB connection string leaked');
    handler(error, request, reply);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });

    process.env.NODE_ENV = originalEnv;
  });
});
