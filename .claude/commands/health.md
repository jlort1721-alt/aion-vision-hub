---
description: Check system health — verify services, analyze errors, review metrics, and monitor video streams across the platform.
---

# Health Command

This command invokes the **monitor-observe** agent to check system health and observability.

## Usage

`/health [subcommand]`

## Subcommands

### `check`
Quick health check (< 30 seconds):
- Backend API health endpoint
- PM2 service status
- Docker container status
- Redis ping
- PostgreSQL connectivity
- Go2rtc API health

### `report`
Full observability report:
- All service health statuses
- Error rate analysis
- API response time averages
- Database connection pool
- Redis memory and hit rate
- Worker queue lengths
- Stream availability
- Disk space and memory

### `errors`
Recent error analysis:
- Sentry errors (last 24h)
- Group by module, severity, frequency
- New vs recurring errors
- Correlation with recent deployments

### `metrics`
Key metrics summary:
- Request rate, error rate
- P50/P95/P99 response times
- Active WebSocket connections
- Database query times
- Redis operations/sec

### `streams`
Video stream health:
- Go2rtc active streams
- Stream reconnection rate
- HLS/WebRTC health
- MediaMTX path availability

## Related Agent

This command invokes the `monitor-observe` agent located at:
`.claude/agents/monitor-observe.md`

## Arguments

$ARGUMENTS can be: `check`, `report`, `errors`, `metrics`, `streams`
