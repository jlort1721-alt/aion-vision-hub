# Security

This document describes the security architecture of the AION Vision Hub backend, including authentication, authorization, tenant isolation, credential encryption, audit logging, rate limiting, and CORS configuration.

---

## Table of Contents

- [JWT Authentication Flow](#jwt-authentication-flow)
- [Tenant Isolation](#tenant-isolation)
- [Role-Based Access Control](#role-based-access-control)
- [Credential Vault](#credential-vault)
- [Audit Logging](#audit-logging)
- [Rate Limiting](#rate-limiting)
- [CORS Configuration](#cors-configuration)
- [Environment-Based Secrets](#environment-based-secrets)
- [Error Response Sanitization](#error-response-sanitization)
- [Security Headers and Best Practices](#security-headers-and-best-practices)

---

## JWT Authentication Flow

The Backend API and Edge Gateway both use JWT (JSON Web Tokens) for authentication. The same `JWT_SECRET` must be configured on both services.

### Token Structure

```json
{
  "sub": "user_abc123",        // User ID
  "email": "user@example.com", // User email
  "tenant_id": "tenant_xyz",   // Tenant scope
  "role": "operator",          // User role
  "iat": 1741392000,           // Issued at
  "exp": 1741478400            // Expires at (default: 24h)
}
```

### Authentication Pipeline

```
Request arrives
    |
    v
Is route in PUBLIC_ROUTES?  (/health, /health/ready, /health/metrics)
    |
   YES --> Skip authentication, proceed to handler
    |
   NO
    |
    v
Is request method OPTIONS?  (CORS preflight)
    |
   YES --> Skip authentication, proceed
    |
   NO
    |
    v
Extract Authorization: Bearer <token>
    |
    v
Verify JWT signature (HMAC-SHA256)
    |
   FAIL --> 401 { code: "AUTH_TOKEN_INVALID", message: "Unauthorized" }
    |
   PASS
    |
    v
Extract claims: sub, email, tenant_id, role
Decorate request: userId, userEmail, tenantId, userRole
    |
    v
Tenant Plugin: verify tenant exists and is active
    |
   FAIL --> 403 { code: "TENANT_NOT_FOUND" | "TENANT_INACTIVE" }
    |
   PASS --> Proceed to route handler
```

### Token Configuration

| Parameter        | Default        | Environment Variable |
|-----------------|----------------|---------------------|
| Secret          | (required)     | `JWT_SECRET`        |
| Issuer          | `aion-vision-hub` | `JWT_ISSUER`     |
| Expiration      | `24h`          | `JWT_EXPIRATION`    |
| Algorithm       | HS256          | (hardcoded)         |
| Min secret length | 32 chars     | (Zod validation)    |

### Public Routes (No Auth Required)

- `GET /health`
- `GET /health/ready`
- `GET /health/metrics`
- `OPTIONS *` (CORS preflight)

---

## Tenant Isolation

Every data query in the Backend API is scoped by the `tenant_id` extracted from the JWT. This is enforced at two levels:

### 1. Request-Level Enforcement (Plugin)

The `tenantPlugin` runs on every authenticated request:

```typescript
app.addHook('onRequest', async (request, reply) => {
  if (!request.tenantId) return;

  const [tenant] = await db
    .select({ isActive: tenants.isActive })
    .from(tenants)
    .where(eq(tenants.id, request.tenantId))
    .limit(1);

  if (!tenant) {
    reply.code(403).send({ code: 'TENANT_NOT_FOUND' });
    return;
  }

  if (!tenant.isActive) {
    reply.code(403).send({ code: 'TENANT_INACTIVE' });
    return;
  }
});
```

### 2. Query-Level Enforcement (Service Layer)

Every database query includes a `tenant_id` filter:

```typescript
// Example from device service
async list(tenantId: string, filters: DeviceFilters) {
  return db
    .select()
    .from(devices)
    .where(eq(devices.tenantId, tenantId))  // Always scoped
    .limit(filters.perPage);
}
```

### Isolation Guarantees

- A user from Tenant A can never access data belonging to Tenant B
- The `tenant_id` comes from the signed JWT, not from user input
- Database queries always include `WHERE tenant_id = ?`
- `super_admin` role can access cross-tenant data (controlled at service layer)

---

## Role-Based Access Control

### Role Hierarchy

| Role           | Level | Capabilities                                           |
|---------------|-------|--------------------------------------------------------|
| `super_admin` | 5     | Full system access, cross-tenant operations, tenant CRUD|
| `tenant_admin`| 4     | Full tenant access, user management, integrations       |
| `operator`    | 3     | Device management, event handling, incident response    |
| `viewer`      | 2     | Read-only access to devices, events, streams            |
| `auditor`     | 1     | Read-only access to audit logs and reports              |

### Enforcement

Role checks are implemented as Fastify preHandler hooks:

```typescript
import { requireRole } from '../../plugins/auth.js';

// Only operators and above can create devices
app.post(
  '/',
  { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
  async (request, reply) => { /* ... */ }
);

// Only admins can delete devices
app.delete(
  '/:id',
  { preHandler: [requireRole('tenant_admin', 'super_admin')] },
  async (request, reply) => { /* ... */ }
);
```

### Permission Matrix

| Endpoint          | super_admin | tenant_admin | operator | viewer | auditor |
|------------------|-------------|-------------|----------|--------|---------|
| `GET /devices`   | Yes         | Yes         | Yes      | Yes    | No      |
| `POST /devices`  | Yes         | Yes         | Yes      | No     | No      |
| `DELETE /devices` | Yes        | Yes         | No       | No     | No      |
| `GET /events`    | Yes         | Yes         | Yes      | Yes    | No      |
| `POST /events`   | Yes         | Yes         | Yes      | No     | No      |
| `GET /audit`     | Yes         | Yes         | No       | No     | Yes     |
| `POST /tenants`  | Yes         | No          | No       | No     | No      |
| `POST /users`    | Yes         | Yes         | No       | No     | No      |
| `POST /integrations` | Yes    | Yes         | No       | No     | No      |
| `POST /reports`  | Yes         | Yes         | No       | No     | No      |
| `POST /ai/chat`  | Yes         | Yes         | Yes      | No     | No      |

---

## Credential Vault

Camera credentials are encrypted at rest using AES-256-GCM. They are never stored in plaintext, logged, or exposed in API responses.

### Encryption Implementation

**File:** `packages/common-utils/src/crypto.ts`

```
Algorithm:  AES-256-GCM (Authenticated Encryption)
Key:        SHA-256 hash of CREDENTIAL_ENCRYPTION_KEY (or JWT_SECRET fallback)
IV:         16 bytes random (per encryption)
Auth Tag:   16 bytes (GCM authentication tag)
Format:     {iv_hex}:{tag_hex}:{ciphertext_hex}
```

### Encryption Flow

```
Store credential
    |
    v
JSON.stringify({ username, password })
    |
    v
SHA-256(CREDENTIAL_ENCRYPTION_KEY) --> 32-byte key
    |
    v
randomBytes(16) --> IV
    |
    v
AES-256-GCM encrypt(plaintext, key, IV)
    |
    v
Output: "{iv_hex}:{auth_tag_hex}:{ciphertext_hex}"
    |
    v
Store in memory with ref "cred:{deviceId}"
```

### Decryption Flow

```
Retrieve credential by ref
    |
    v
Parse "iv:tag:ciphertext" from stored value
    |
    v
SHA-256(CREDENTIAL_ENCRYPTION_KEY) --> 32-byte key
    |
    v
AES-256-GCM decrypt(ciphertext, key, IV, tag)
    |
    v
JSON.parse --> { username, password }
```

### Vault API

| Method                        | Description                         |
|------------------------------|--------------------------------------|
| `store(deviceId, user, pass)` | Encrypt and store, returns ref ID   |
| `retrieve(ref)`              | Decrypt and return credentials       |
| `revoke(ref)`                | Delete credentials permanently       |
| `has(ref)`                   | Check if reference exists            |

### Security Properties

- **Authenticated encryption:** GCM mode provides both confidentiality and integrity
- **Unique IV per encryption:** Prevents identical plaintext from producing identical ciphertext
- **No plaintext logging:** Credentials are never written to logs (Pino serializers redact)
- **In-memory only:** Credentials are not persisted to disk (current implementation)
- **Reference-based access:** API responses contain `credentialRef` strings, never actual credentials

---

## Audit Logging

All mutation operations (POST, PUT, PATCH, DELETE) are automatically logged to the `audit_logs` table.

### Automatic Audit Logging

The `auditPlugin` hooks into every response:

```typescript
app.addHook('onResponse', async (request) => {
  if (!MUTATION_METHODS.has(request.method)) return;
  if (!request.userId) return;

  const action = `${request.method.toLowerCase()}:${request.url.split('?')[0]}`;
  await request.audit(action, request.url.split('/')[2] ?? 'unknown');
});
```

### Manual Audit Logging

Route handlers can call `request.audit()` directly for more detailed logging:

```typescript
await request.audit('device.create', 'devices', data.id, {
  name: data.name,
  brand: data.brand,
  siteId: data.siteId,
});
```

### Audit Log Schema

```typescript
interface AuditLog {
  id: string;
  tenantId: string;           // Tenant scope
  userId: string;             // User who performed the action
  userEmail: string;          // Email for human-readable logs
  action: string;             // e.g., "device.create", "post:/devices"
  resource: string;           // e.g., "devices", "events"
  resourceId?: string;        // ID of affected resource
  details?: Record<string, unknown>;  // Additional context
  ipAddress?: string;         // Client IP address
  userAgent?: string;         // Client user agent
  createdAt: Date;            // Timestamp
}
```

### Audit Properties

- **Non-blocking:** Audit log failures do not affect the primary operation (caught silently)
- **Tenant-scoped:** All audit logs include `tenantId` for isolation
- **Queryable:** Audit logs can be filtered by user, action, resource, and date range
- **Immutable:** Audit records cannot be updated or deleted via the API

---

## Rate Limiting

The Backend API uses `@fastify/rate-limit` to prevent abuse and ensure fair resource distribution.

### Configuration

| Parameter       | Default    | Environment Variable     |
|----------------|-----------|--------------------------|
| Max requests   | 100       | `RATE_LIMIT_MAX`         |
| Time window    | 60,000 ms | `RATE_LIMIT_WINDOW_MS`   |

### Key Generation

Rate limits are applied per **tenant + IP** combination:

```typescript
keyGenerator: (request) => {
  return request.tenantId
    ? `${request.tenantId}:${request.ip}`
    : request.ip;
}
```

This ensures that:
- Authenticated users are rate-limited per tenant+IP (preventing one tenant from starving others)
- Unauthenticated requests (e.g., login attempts) are rate-limited per IP only

### Rate Limit Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later."
  }
}
```

HTTP headers are included in responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Time until rate limit resets

---

## CORS Configuration

Cross-Origin Resource Sharing is configured via the `CORS_ORIGINS` environment variable.

### Configuration

```typescript
await app.register(cors, {
  origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
  credentials: true,
});
```

| Parameter    | Default                      | Environment Variable |
|-------------|------------------------------|---------------------|
| Origins     | `http://localhost:5173`       | `CORS_ORIGINS`      |
| Credentials | `true`                       | (hardcoded)         |

### Multiple Origins

Set comma-separated origins:

```env
CORS_ORIGINS=http://localhost:5173,https://app.aion-vision.com,https://admin.aion-vision.com
```

---

## Environment-Based Secrets

All secrets are loaded from environment variables, never hardcoded. Zod validation at startup ensures required secrets are present.

### Required Secrets

| Variable                    | Requirement | Used By                       |
|----------------------------|-------------|-------------------------------|
| `JWT_SECRET`               | Required    | Backend API + Edge Gateway    |
| `DATABASE_URL`             | Required    | Backend API                   |
| `CREDENTIAL_ENCRYPTION_KEY`| Optional    | Edge Gateway (falls back to JWT_SECRET) |

### Secret Validation

```typescript
const envSchema = z.object({
  JWT_SECRET: z.string().min(32),               // Minimum 32 characters
  DATABASE_URL: z.string().url(),               // Must be valid URL
  CREDENTIAL_ENCRYPTION_KEY: z.string().min(32).optional(),
});
```

If required variables are missing, the application fails to start with a clear error message:

```
ZodError: [
  { path: ["JWT_SECRET"], message: "String must contain at least 32 character(s)" }
]
```

### Docker Compose Enforcement

Required secrets are enforced in `docker-compose.yml`:

```yaml
environment:
  JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required}
```

---

## Error Response Sanitization

Error details are sanitized in production to prevent information leakage:

```typescript
// In production: generic message
reply.code(500).send({
  success: false,
  error: {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  },
});

// In development: full error details
reply.code(500).send({
  success: false,
  error: {
    code: 'INTERNAL_ERROR',
    message: error.message,  // Full stack trace available in logs
  },
});
```

---

## Security Headers and Best Practices

### Request Correlation

Every request is assigned a unique `x-request-id` (UUID v4) for traceability across services:

```typescript
const app = Fastify({
  requestIdHeader: 'x-request-id',
  genReqId: () => crypto.randomUUID(),
});
```

### Logging Security

- Credentials are never logged (redacted at adapter level)
- JWT tokens are not logged in full
- Pino structured logging enables secure log aggregation
- Log levels are configurable (`LOG_LEVEL` environment variable)

### Dependency Security

- All dependencies use semver ranges with lockfile (`pnpm-lock.yaml`)
- TypeScript strict mode enabled (`strict: true`)
- `noUnusedLocals` and `noUnusedParameters` prevent code rot
- `isolatedModules` ensures consistent module compilation

### Network Security

- Services communicate over Docker bridge network (`aion-net`)
- PostgreSQL is only accessible within the Docker network (or localhost for development)
- MediaMTX API is only accessible within the Docker network
- RTSP credentials are embedded in stream URLs (internal only, never exposed to frontend)
