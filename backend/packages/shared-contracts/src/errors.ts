// ═══════════════════════════════════════════════════════════
// AION Vision Hub — Error Codes & Typed Errors
// ═══════════════════════════════════════════════════════════

export const ErrorCodes = {
  // Auth
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_INSUFFICIENT_ROLE: 'AUTH_INSUFFICIENT_ROLE',
  AUTH_TENANT_MISMATCH: 'AUTH_TENANT_MISMATCH',

  // Tenant
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_INACTIVE: 'TENANT_INACTIVE',
  TENANT_LIMIT_REACHED: 'TENANT_LIMIT_REACHED',

  // Device
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  DEVICE_CONNECTION_FAILED: 'DEVICE_CONNECTION_FAILED',
  DEVICE_TIMEOUT: 'DEVICE_TIMEOUT',
  DEVICE_AUTH_FAILED: 'DEVICE_AUTH_FAILED',
  DEVICE_OFFLINE: 'DEVICE_OFFLINE',
  DEVICE_LIMIT_REACHED: 'DEVICE_LIMIT_REACHED',

  // Stream
  STREAM_NOT_FOUND: 'STREAM_NOT_FOUND',
  STREAM_UNAVAILABLE: 'STREAM_UNAVAILABLE',
  STREAM_LIMIT_REACHED: 'STREAM_LIMIT_REACHED',
  STREAM_POLICY_VIOLATION: 'STREAM_POLICY_VIOLATION',

  // Gateway
  GATEWAY_UNREACHABLE: 'GATEWAY_UNREACHABLE',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
  GATEWAY_ERROR: 'GATEWAY_ERROR',

  // Discovery
  DISCOVERY_TIMEOUT: 'DISCOVERY_TIMEOUT',
  DISCOVERY_NETWORK_ERROR: 'DISCOVERY_NETWORK_ERROR',

  // Playback
  PLAYBACK_NOT_FOUND: 'PLAYBACK_NOT_FOUND',
  PLAYBACK_RANGE_INVALID: 'PLAYBACK_RANGE_INVALID',
  PLAYBACK_EXPORT_FAILED: 'PLAYBACK_EXPORT_FAILED',

  // Integration
  INTEGRATION_NOT_FOUND: 'INTEGRATION_NOT_FOUND',
  INTEGRATION_CONFIG_INVALID: 'INTEGRATION_CONFIG_INVALID',
  INTEGRATION_CONNECTION_FAILED: 'INTEGRATION_CONNECTION_FAILED',

  // AI
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_MODEL_UNAVAILABLE: 'AI_MODEL_UNAVAILABLE',

  // MCP
  MCP_TOOL_NOT_FOUND: 'MCP_TOOL_NOT_FOUND',
  MCP_EXECUTION_FAILED: 'MCP_EXECUTION_FAILED',
  MCP_CONNECTOR_OFFLINE: 'MCP_CONNECTOR_OFFLINE',

  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFLICT: 'CONFLICT',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      ErrorCodes.NOT_FOUND,
      id ? `${resource} '${id}' not found` : `${resource} not found`,
      404,
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCodes.VALIDATION_ERROR, message, 400, details);
  }
}

export class AuthError extends AppError {
  constructor(code: ErrorCode = ErrorCodes.AUTH_TOKEN_INVALID, message = 'Unauthorized') {
    super(code, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(ErrorCodes.AUTH_INSUFFICIENT_ROLE, message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(ErrorCodes.CONFLICT, message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(ErrorCodes.RATE_LIMITED, message, 429);
  }
}
