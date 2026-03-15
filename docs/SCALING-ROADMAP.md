# AION Vision Hub — Scaling Roadmap

## Current Architecture (250 devices)

```
Single VPS (Hetzner CPX31 or similar)
├── Nginx (reverse proxy)
├── Backend API (Node.js/PM2)
├── Edge Gateway (Node.js/PM2)
├── MediaMTX (Docker - RTSP/WebRTC)
└── Supabase Cloud (PostgreSQL)
```

**Recommended specs:** 4 CPU, 8 GB RAM, 80 GB SSD

---

## Tier 1: 250 Devices (Current)

| Component | Config |
|-----------|--------|
| Backend API | 1 instance, ~100 MB RAM |
| Edge Gateway | 1 instance, ~70 MB RAM |
| MediaMTX | 1 container, ~500 MB RAM for 250 streams |
| PostgreSQL | Supabase (cloud), 200 max connections |
| Estimated VPS cost | ~$15-25/month (Hetzner CPX31) |

### Performance Targets
- API latency: < 100ms (p95)
- Stream startup: < 3s
- Concurrent WebRTC viewers: ~50
- Events/day: ~100,000

---

## Tier 2: 500 Devices

### Changes Required

1. **Upgrade VPS**: 6 CPU, 16 GB RAM, 160 GB SSD (~$35/month)
2. **Backend API**: Enable PM2 cluster mode (2 instances)
   ```js
   // ecosystem.config.cjs
   instances: 2,
   exec_mode: 'cluster',
   ```
3. **MediaMTX**: Increase memory limit to 2 GB
4. **Edge Gateway**: Tune connection params:
   ```
   DEVICE_PING_INTERVAL_MS=120000  (every 2 min instead of 1)
   CACHE_MAX_ENTRIES=4000
   ```
5. **Supabase**: Monitor connection pool usage, consider upgrading plan
6. **Nginx**: Increase worker_connections to 4096

### Estimated cost: ~$35-50/month

---

## Tier 3: 1000 Devices

### Architecture Change Required

```
Load Balancer (Nginx/HAProxy)
├── VPS-1: Backend API (cluster x4) + Nginx
├── VPS-2: Edge Gateway (cluster x2) + MediaMTX-1
├── VPS-3: MediaMTX-2 (overflow streams)
└── Supabase Pro (cloud PostgreSQL)
```

### Changes Required

1. **Multiple VPS**: Split services across 2-3 servers
2. **Backend API**: 4 cluster instances across dedicated VPS
3. **Edge Gateway**: 2 instances with device sharding
   - Gateway-1: devices 1-500
   - Gateway-2: devices 501-1000
4. **MediaMTX**: 2 instances with stream routing
5. **Supabase Pro**: Higher connection limits, read replicas
6. **Load Balancer**: Nginx or HAProxy in front of API nodes
7. **Redis** (optional): Session cache, rate limiting coordination

### Estimated cost: ~$100-150/month (3 VPS + Supabase Pro)

---

## Scaling Checklist

### Before 250 → 500
- [ ] Upgrade VPS RAM to 16 GB
- [ ] Enable PM2 cluster mode for backend-api
- [ ] Increase MediaMTX memory limit
- [ ] Monitor PostgreSQL connection pool
- [ ] Add database connection pooling (PgBouncer) if needed
- [ ] Review and optimize slow queries (check pg_stat_statements)

### Before 500 → 1000
- [ ] Split to multi-VPS architecture
- [ ] Implement device sharding in Edge Gateway
- [ ] Set up load balancer
- [ ] Upgrade Supabase plan for more connections
- [ ] Consider read replicas for heavy read operations
- [ ] Implement Redis for shared state
- [ ] Set up monitoring (Grafana + Prometheus)

---

## Database Scaling Notes

### Indexes Already Optimized For
- Events: (tenant_id, created_at DESC) — high-volume queries
- Devices: (tenant_id, status), (tenant_id, site_id) — dashboard queries
- Audit logs: (tenant_id, created_at DESC) — compliance queries
- Access logs: (tenant_id, section_id, created_at DESC)

### Auto-vacuum Tuning (Already Applied)
- events: scale_factor=0.05, analyze=0.02
- audit_logs: scale_factor=0.05, analyze=0.02
- access_logs: scale_factor=0.1, analyze=0.05

### Data Retention Strategy
| Table | Retention | Action |
|-------|-----------|--------|
| events | 90 days | Archive to cold storage, delete |
| audit_logs | 180 days | Archive, delete |
| access_logs | 90 days | Archive, delete |
| wa_messages | 30 days | Delete |
