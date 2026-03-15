# API Reference

Complete REST API reference for the AION Vision Hub Backend API (`@aion/backend-api`), running on port 3000 by default.

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Error Response Format](#error-response-format)
- [Pagination](#pagination)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Auth](#auth)
  - [Tenants](#tenants)
  - [Users](#users)
  - [Roles](#roles)
  - [Devices](#devices)
  - [Sites](#sites)
  - [Streams](#streams)
  - [Events](#events)
  - [Incidents](#incidents)
  - [Integrations](#integrations)
  - [AI Bridge](#ai-bridge)
  - [MCP Bridge](#mcp-bridge)
  - [Reports](#reports)
  - [Audit](#audit)

---

## Overview

- **Base URL:** `http://localhost:3000`
- **Content-Type:** `application/json`
- **Authentication:** JWT Bearer token (all endpoints except `/health`)
- **Tenant Isolation:** All data queries are scoped by `tenant_id` from the JWT
- **Rate Limiting:** 100 requests per 60 seconds per tenant+IP (configurable)

---

## Authentication

All endpoints except `/health/*` require a JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### JWT Payload Structure

```json
{
  "sub": "user_abc123",
  "email": "user@example.com",
  "tenant_id": "tenant_xyz789",
  "role": "operator",
  "iat": 1741392000,
  "exp": 1741478400
}
```

### Roles

| Role           | Access Level                                       |
|---------------|-----------------------------------------------------|
| `super_admin` | Full system access across all tenants               |
| `tenant_admin`| Full access within their tenant                     |
| `operator`    | Create/update devices, manage events and incidents  |
| `viewer`      | Read-only access to devices, events, streams        |
| `auditor`     | Read-only access to audit logs and reports          |

---

## Error Response Format

All error responses follow a consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Device 'dev_123' not found",
    "details": {}
  }
}
```

### Common Error Codes

| Code                      | HTTP | Description                           |
|--------------------------|------|---------------------------------------|
| `AUTH_TOKEN_INVALID`     | 401  | Invalid or missing JWT token          |
| `AUTH_TOKEN_EXPIRED`     | 401  | JWT token has expired                 |
| `AUTH_INSUFFICIENT_ROLE` | 403  | User lacks required role              |
| `TENANT_NOT_FOUND`      | 403  | Tenant does not exist                 |
| `TENANT_INACTIVE`       | 403  | Tenant account is deactivated        |
| `VALIDATION_ERROR`      | 400  | Request body/params failed validation |
| `NOT_FOUND`             | 404  | Requested resource does not exist     |
| `CONFLICT`              | 409  | Resource conflict (e.g., duplicate)   |
| `RATE_LIMITED`           | 429  | Too many requests                     |
| `INTERNAL_ERROR`        | 500  | Unexpected server error               |

### Validation Error Details

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "issues": [
        { "path": "email", "message": "Invalid email" },
        { "path": "port", "message": "Expected number, received string" }
      ]
    }
  }
}
```

---

## Pagination

List endpoints support pagination via query parameters:

### Request Parameters

| Parameter   | Type   | Default | Description                        |
|------------|--------|---------|-------------------------------------|
| `page`     | number | 1       | Page number (1-based)               |
| `perPage`  | number | 20      | Items per page                      |
| `sortBy`   | string | varies  | Field to sort by                    |
| `sortOrder`| string | `desc`  | Sort direction (`asc` or `desc`)    |

### Response Meta

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 156,
    "totalPages": 8
  }
}
```

---

## Endpoints

### Health

Health check endpoints are public (no authentication required).

| Method | Path              | Description                                  |
|--------|------------------|----------------------------------------------|
| `GET`  | `/health`        | Basic health status                          |
| `GET`  | `/health/ready`  | Readiness probe (checks DB connectivity)     |
| `GET`  | `/health/metrics`| Runtime metrics (memory, CPU, uptime)        |

#### `GET /health`

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "timestamp": "2026-03-08T10:00:00.000Z"
}
```

#### `GET /health/metrics`

```json
{
  "uptime": 86400,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576,
    "arrayBuffers": 524288
  },
  "cpu": { "user": 1250000, "system": 350000 },
  "timestamp": "2026-03-08T10:00:00.000Z"
}
```

---

### Auth

| Method | Path             | Description              | Auth Required |
|--------|-----------------|--------------------------|---------------|
| `POST` | `/auth/verify`  | Verify JWT token         | Yes           |
| `POST` | `/auth/refresh` | Refresh access token     | Yes           |

#### `POST /auth/verify`

Verifies the JWT token from the Authorization header and returns the decoded claims.

**Response:**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "userId": "user_abc123",
    "tenantId": "tenant_xyz789",
    "role": "operator",
    "email": "user@example.com",
    "expiresAt": 1741478400
  }
}
```

#### `POST /auth/refresh`

**Request:**

```json
{
  "refreshToken": "rt_abc123..."
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400
  }
}
```

---

### Tenants

| Method  | Path           | Description               | Min Role        |
|---------|---------------|---------------------------|-----------------|
| `GET`   | `/tenants`    | List tenants              | `super_admin`   |
| `GET`   | `/tenants/:id`| Get tenant by ID          | `tenant_admin`  |
| `POST`  | `/tenants`    | Create tenant             | `super_admin`   |
| `PATCH` | `/tenants/:id`| Update tenant             | `tenant_admin`  |

#### `POST /tenants`

**Request:**

```json
{
  "name": "Acme Security",
  "slug": "acme-security",
  "plan": "professional"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "tenant_abc123",
    "name": "Acme Security",
    "slug": "acme-security",
    "plan": "professional",
    "isActive": true,
    "settings": {
      "maxDevices": 100,
      "maxUsers": 50,
      "maxSites": 10,
      "retentionDays": 30,
      "features": [],
      "aiEnabled": false,
      "aiProviders": []
    },
    "createdAt": "2026-03-08T10:00:00.000Z",
    "updatedAt": "2026-03-08T10:00:00.000Z"
  }
}
```

---

### Users

| Method  | Path            | Description              | Min Role        |
|---------|----------------|--------------------------|-----------------|
| `GET`   | `/users`       | List users in tenant     | `tenant_admin`  |
| `GET`   | `/users/:id`   | Get user by ID           | `viewer`        |
| `POST`  | `/users`       | Create user              | `tenant_admin`  |
| `PATCH` | `/users/:id`   | Update user              | `tenant_admin`  |

#### `POST /users`

**Request:**

```json
{
  "email": "operator@acme.com",
  "fullName": "Jane Smith",
  "role": "operator",
  "password": "securePassword123"
}
```

---

### Roles

| Method | Path       | Description              | Min Role       |
|--------|-----------|--------------------------|----------------|
| `GET`  | `/roles`  | List available roles     | `viewer`       |

---

### Devices

| Method   | Path                  | Description                    | Min Role       |
|---------|----------------------|--------------------------------|----------------|
| `GET`   | `/devices`           | List devices (with filters)    | `viewer`       |
| `GET`   | `/devices/:id`       | Get device by ID               | `viewer`       |
| `POST`  | `/devices`           | Register a new device          | `operator`     |
| `PATCH` | `/devices/:id`       | Update device                  | `operator`     |
| `DELETE`| `/devices/:id`       | Delete device                  | `tenant_admin` |
| `POST`  | `/devices/:id/test`  | Test device connection         | `operator`     |
| `GET`   | `/devices/:id/health`| Get device health status       | `viewer`       |

#### `POST /devices`

**Request:**

```json
{
  "name": "Front Entrance Camera",
  "brand": "hikvision",
  "model": "DS-2CD2346G2-I",
  "type": "camera",
  "ip": "192.168.1.100",
  "port": 80,
  "siteId": "site_abc123",
  "username": "admin",
  "password": "camera_password",
  "channels": 1,
  "tags": ["entrance", "outdoor"]
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "dev_abc123",
    "tenantId": "tenant_xyz789",
    "siteId": "site_abc123",
    "name": "Front Entrance Camera",
    "brand": "hikvision",
    "model": "DS-2CD2346G2-I",
    "type": "camera",
    "ip": "192.168.1.100",
    "port": 80,
    "status": "unknown",
    "channels": 1,
    "credentialRef": "cred:dev_abc123",
    "tags": ["entrance", "outdoor"],
    "createdAt": "2026-03-08T10:00:00.000Z",
    "updatedAt": "2026-03-08T10:00:00.000Z"
  }
}
```

#### `GET /devices` (with filters)

**Query Parameters:**

| Parameter | Type   | Description                         |
|-----------|--------|-------------------------------------|
| `search`  | string | Search by name or IP                |
| `status`  | string | Filter by status (online, offline)  |
| `siteId`  | string | Filter by site                      |
| `page`    | number | Page number                         |
| `perPage` | number | Items per page                      |

---

### Sites

| Method  | Path           | Description              | Min Role       |
|---------|---------------|--------------------------|----------------|
| `GET`   | `/sites`      | List sites               | `viewer`       |
| `GET`   | `/sites/:id`  | Get site by ID           | `viewer`       |
| `POST`  | `/sites`      | Create site              | `tenant_admin` |
| `PATCH` | `/sites/:id`  | Update site              | `tenant_admin` |

#### `POST /sites`

**Request:**

```json
{
  "name": "Main Office",
  "address": "123 Security Blvd, Suite 100",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "timezone": "America/Los_Angeles"
}
```

---

### Streams

| Method | Path                           | Description                    | Min Role   |
|--------|-------------------------------|--------------------------------|------------|
| `GET`  | `/streams`                    | List registered streams        | `viewer`   |
| `GET`  | `/streams/:deviceId`          | Get stream for a device        | `viewer`   |
| `POST` | `/streams`                    | Register a stream              | `operator` |
| `GET`  | `/streams/:deviceId/url`      | Get signed stream URL          | `viewer`   |

#### `GET /streams/:deviceId/url`

**Query Parameters:**

| Parameter  | Type   | Default  | Values                     |
|-----------|--------|----------|----------------------------|
| `type`    | string | `sub`    | `main`, `sub`              |
| `channel` | number | 1        | Channel number             |
| `protocol`| string | `webrtc` | `rtsp`, `webrtc`, `hls`    |

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "http://localhost:8889/hik-192.168.1.100:80-sub/",
    "token": "a1b2c3d4e5f6g7h8i9j0k1l2",
    "expiresAt": 1741478400,
    "protocol": "webrtc"
  }
}
```

---

### Events

| Method  | Path                       | Description                    | Min Role   |
|---------|---------------------------|--------------------------------|------------|
| `GET`   | `/events`                 | List events (with filters)     | `viewer`   |
| `GET`   | `/events/:id`             | Get event by ID                | `viewer`   |
| `POST`  | `/events`                 | Create event                   | `operator` |
| `PATCH` | `/events/:id`             | Update event status            | `operator` |
| `POST`  | `/events/:id/assign`      | Assign event to user           | `operator` |
| `POST`  | `/events/:id/acknowledge` | Acknowledge event              | `operator` |
| `POST`  | `/events/:id/resolve`     | Resolve event                  | `operator` |

#### `POST /events`

**Request:**

```json
{
  "deviceId": "dev_abc123",
  "type": "motion_detected",
  "severity": "warning",
  "title": "Motion detected at front entrance",
  "description": "Motion detected in zone 1 at 10:30 AM",
  "channel": 1,
  "snapshotUrl": "https://storage.example.com/snapshots/snap_001.jpg",
  "metadata": {
    "zone": "entrance",
    "confidence": 0.95
  }
}
```

#### `GET /events` (filter parameters)

| Parameter    | Type   | Description                              |
|-------------|--------|------------------------------------------|
| `search`    | string | Search in title and description          |
| `status`    | string | `new`, `acknowledged`, `resolved`, `dismissed` |
| `severity`  | string | `info`, `warning`, `critical`            |
| `deviceId`  | string | Filter by device                         |
| `siteId`    | string | Filter by site                           |
| `assignedTo`| string | Filter by assigned user                  |
| `from`      | string | Start date (ISO 8601)                    |
| `to`        | string | End date (ISO 8601)                      |

---

### Incidents

| Method  | Path                              | Description               | Min Role   |
|---------|----------------------------------|---------------------------|------------|
| `GET`   | `/incidents`                     | List incidents            | `viewer`   |
| `GET`   | `/incidents/:id`                 | Get incident by ID        | `viewer`   |
| `POST`  | `/incidents`                     | Create incident           | `operator` |
| `PATCH` | `/incidents/:id`                 | Update incident           | `operator` |
| `POST`  | `/incidents/:id/evidence`        | Add evidence              | `operator` |
| `POST`  | `/incidents/:id/comments`        | Add comment               | `viewer`   |

#### `POST /incidents`

**Request:**

```json
{
  "title": "Unauthorized access attempt",
  "description": "Motion and intrusion detected at warehouse gate after hours",
  "priority": "high",
  "siteId": "site_abc123",
  "eventIds": ["evt_001", "evt_002"]
}
```

#### `POST /incidents/:id/evidence`

**Request:**

```json
{
  "type": "snapshot",
  "url": "https://storage.example.com/evidence/snap_001.jpg"
}
```

---

### Integrations

| Method  | Path                           | Description                | Min Role        |
|---------|-------------------------------|----------------------------|-----------------|
| `GET`   | `/integrations`               | List integrations          | `tenant_admin`  |
| `GET`   | `/integrations/:id`           | Get integration by ID      | `tenant_admin`  |
| `POST`  | `/integrations`               | Create integration         | `tenant_admin`  |
| `PATCH` | `/integrations/:id`           | Update integration         | `tenant_admin`  |
| `DELETE`| `/integrations/:id`           | Delete integration         | `tenant_admin`  |
| `POST`  | `/integrations/:id/test`      | Test integration           | `tenant_admin`  |

#### `POST /integrations`

**Request:**

```json
{
  "name": "Slack Alerts",
  "type": "slack",
  "config": {
    "webhookUrl": "https://hooks.slack.com/services/T00/B00/xxx",
    "channel": "#security-alerts",
    "events": ["critical"]
  }
}
```

---

### AI Bridge

| Method | Path                | Description              | Min Role   |
|--------|-------------------|--------------------------|------------|
| `POST` | `/ai/chat`        | Send AI chat request     | `operator` |
| `GET`  | `/ai/models`      | List available AI models | `operator` |
| `GET`  | `/ai/usage`       | Get AI usage statistics  | `tenant_admin` |

#### `POST /ai/chat`

**Request:**

```json
{
  "messages": [
    { "role": "system", "content": "You are a security analyst assistant." },
    { "role": "user", "content": "Analyze the recent motion events at the warehouse." }
  ],
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "temperature": 0.3,
  "maxTokens": 1024
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "content": "Based on the motion events...",
    "model": "claude-sonnet-4-20250514",
    "provider": "anthropic",
    "tokens": { "prompt": 150, "completion": 320 },
    "finishReason": "end_turn"
  }
}
```

---

### MCP Bridge

| Method | Path                        | Description                  | Min Role        |
|--------|----------------------------|------------------------------|-----------------|
| `GET`  | `/mcp/connectors`          | List MCP connectors          | `tenant_admin`  |
| `POST` | `/mcp/connectors`          | Register MCP connector       | `tenant_admin`  |
| `GET`  | `/mcp/tools`               | List available MCP tools     | `operator`      |
| `POST` | `/mcp/tools/:name/execute` | Execute an MCP tool          | `operator`      |

#### `POST /mcp/tools/:name/execute`

**Request:**

```json
{
  "toolName": "search_cameras",
  "params": {
    "query": "front entrance",
    "limit": 10
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "data": { "cameras": [...] },
    "executionMs": 245
  }
}
```

---

### Reports

| Method | Path               | Description                 | Min Role        |
|--------|-------------------|-----------------------------|-----------------|
| `GET`  | `/reports`        | List reports                | `tenant_admin`  |
| `GET`  | `/reports/:id`    | Get report by ID            | `tenant_admin`  |
| `POST` | `/reports`        | Generate a report           | `tenant_admin`  |

#### `POST /reports`

**Request:**

```json
{
  "name": "March 2026 Event Summary",
  "type": "events",
  "format": "pdf",
  "parameters": {
    "from": "2026-03-01T00:00:00Z",
    "to": "2026-03-31T23:59:59Z",
    "severity": ["warning", "critical"],
    "siteId": "site_abc123"
  }
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "rpt_abc123",
    "name": "March 2026 Event Summary",
    "type": "events",
    "format": "pdf",
    "status": "pending",
    "createdBy": "user_abc123",
    "createdAt": "2026-03-08T10:00:00.000Z"
  }
}
```

---

### Audit

| Method | Path         | Description              | Min Role   |
|--------|-------------|--------------------------|------------|
| `GET`  | `/audit`    | Query audit logs         | `auditor`  |

#### `GET /audit` (filter parameters)

| Parameter  | Type   | Description                       |
|-----------|--------|-----------------------------------|
| `userId`  | string | Filter by user who performed action|
| `action`  | string | Filter by action type             |
| `resource`| string | Filter by resource type           |
| `from`    | string | Start date (ISO 8601)             |
| `to`      | string | End date (ISO 8601)               |
| `page`    | number | Page number                       |
| `perPage` | number | Items per page                    |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "aud_abc123",
      "tenantId": "tenant_xyz789",
      "userId": "user_abc123",
      "userEmail": "operator@acme.com",
      "action": "device.create",
      "resource": "devices",
      "resourceId": "dev_abc123",
      "details": { "name": "Front Entrance Camera", "brand": "hikvision" },
      "ipAddress": "192.168.1.50",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-03-08T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 1543,
    "totalPages": 78
  }
}
```
