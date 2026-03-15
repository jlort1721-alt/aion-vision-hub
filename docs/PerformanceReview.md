# AION Vision Hub — Performance Review

## Last Updated: 2026-03-08

---

## Build Performance

| Metric | Value | Status |
|--------|-------|--------|
| Build tool | Vite 5.x | Current |
| Build time | ~5.2s (3463 modules) | Good |
| Total bundle (JS) | ~1.9 MB (gzipped ~500KB est.) | Needs splitting |
| CSS bundle | Tailwind (purged) | Good |
| Build errors | 0 | Pass |
| Build warnings | 1 (CSS @import order) | Cosmetic |

### Bundle Analysis

The 1.9MB JavaScript chunk exceeds the recommended 500KB per-chunk threshold. This is common for single-page applications with 19+ modules loaded upfront.

**Recommended**: Implement route-level code splitting using `React.lazy()`:

```typescript
// Before
import DashboardPage from './pages/DashboardPage';

// After
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
```

Expected impact: Initial load reduced to ~400-600KB, with route chunks loaded on demand (~50-150KB each).

---

## Runtime Performance

### React Query Configuration
- Stale time: Default (0 — always refetch on mount)
- Cache time: 5 minutes
- Retry: 3 attempts with exponential backoff
- Refetch on window focus: enabled

**Impact**: Good data freshness for real-time monitoring. Could increase stale time for static data (sites, devices) to reduce unnecessary network requests.

### Rendering Performance

| Pattern | Usage | Impact |
|---------|-------|--------|
| `useMemo` | Selective (computed values) | Good |
| `useCallback` | Selective (event handlers) | Good |
| `React.memo` | Not widely used | Opportunity |
| Virtual lists | Not implemented | Needed for >100 rows |
| Image lazy loading | Not implemented | Minor impact |

### Real-time Updates (Supabase Realtime)
- `postgres_changes` subscriptions per module
- Efficient: subscribes only to visible module's table
- Automatic unsubscribe on unmount
- No polling — WebSocket-based

---

## Database Performance

### RLS Policy Overhead
- `get_user_tenant_id()` is `STABLE` — PostgreSQL can cache within a transaction
- `has_role()` is `STABLE` — same caching benefit
- Both are `SECURITY DEFINER` to avoid recursive RLS checks
- Indexed: `user_roles(user_id)`, `user_roles(tenant_id)`

### Query Patterns
- All list queries have `.limit()` caps (200–1000 rows)
- Pagination implemented in frontend (TanStack Table)
- Server-side pagination available via `.range()` but not yet used
- Filtering uses indexed columns (tenant_id, status, created_at)

### Recommendations
1. Add composite indexes on frequently filtered columns:
   ```sql
   CREATE INDEX idx_events_tenant_status ON events(tenant_id, status);
   CREATE INDEX idx_devices_tenant_brand ON devices(tenant_id, brand);
   CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
   ```
2. Implement server-side pagination for audit_logs and events tables (can grow unbounded)
3. Add connection pooling configuration (Supabase PgBouncer)

---

## Edge Function Performance

| Function | Cold Start | Warm Response | Notes |
|----------|-----------|---------------|-------|
| ai-chat | ~500ms | ~100ms + AI latency | SSE streaming |
| devices-api | ~300ms | ~50ms | Simple CRUD |
| events-api | ~300ms | ~50ms | Simple CRUD |
| incidents-api | ~300ms | ~50ms | CRUD + comments |
| reports-api | ~300ms | ~80ms | JSON aggregation |
| reports-pdf | ~400ms | ~100ms | HTML generation |
| admin-users | ~400ms | ~80ms | Uses service role |
| mcp-api | ~300ms | ~50ms | Simple CRUD |
| integrations-api | ~300ms | ~50ms | Simple CRUD |
| health-api | ~400ms | ~100ms | Multi-service check |
| event-alerts | ~300ms | ~50ms | Alert routing |

Cold start times are Supabase Edge Function (Deno Deploy) defaults. Production instances stay warm with regular traffic.

---

## Network Performance

### API Call Pattern
- All API calls authenticated (JWT in Authorization header)
- API key in `apikey` header (Supabase requirement)
- CORS configured on all edge functions
- No request batching — each operation is a separate call
- React Query deduplication prevents duplicate in-flight requests

### Payload Sizes (Typical)
| Endpoint | Response Size | Notes |
|----------|--------------|-------|
| GET devices | ~5-20KB | 50-200 devices |
| GET events (200 limit) | ~30-50KB | 200 events with metadata |
| GET audit_logs | ~20-40KB | 200 log entries |
| POST ai-chat (stream) | Variable | SSE chunks ~100 bytes each |
| GET reports-pdf | ~15-30KB | HTML document |

---

## Scalability Considerations

### Current Capacity Estimates

| Dimension | Estimated Limit | Bottleneck |
|-----------|----------------|-----------|
| Concurrent users | ~100 | Supabase connection pool |
| Total devices | ~500 per tenant | Frontend grid rendering |
| Events/day | ~50,000 | Database storage |
| Active streams | ~20 | Gateway/MediaMTX (future) |
| AI requests/min | ~60 | AI provider rate limits |

### Scaling Path
1. **Frontend**: Code splitting + virtual lists → support 1000+ devices
2. **Database**: Server-side pagination + indexes → support 1M+ events
3. **Edge Functions**: Supabase auto-scales horizontally
4. **Gateway**: Horizontal scaling with shared state in Redis
5. **Streams**: MediaMTX scales per instance; add instances behind load balancer

---

## Performance Recommendations (Priority Order)

1. **Code splitting** — Route-level lazy loading to reduce initial bundle from 1.9MB to <500KB
2. **Virtual scrolling** — For events, audit logs, and device lists exceeding 100 rows
3. **Database indexes** — Composite indexes on high-frequency query patterns
4. **Server-side pagination** — For audit_logs and events (unbounded growth)
5. **React Query stale times** — Increase for slow-changing data (sites: 5min, devices: 1min)
6. **Image optimization** — Lazy load device thumbnails and map tiles
7. **Service worker** — Cache static assets for faster navigation between modules

---

## Overall Performance Grade: B+

**Strengths**: Fast build, efficient real-time updates, query limits, caching via React Query.

**Gaps**: Large single bundle, no virtual scrolling, no server-side pagination on large tables.

**Verdict**: Adequate for current scale (100 users, 500 devices). Needs code splitting and virtual scrolling before scaling to 500+ concurrent users.
