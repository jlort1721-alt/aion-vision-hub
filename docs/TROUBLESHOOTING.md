# AION Vision Hub — Troubleshooting Guide

## Common Issues

### 1. Login Page Shows But Can't Login

**Symptom**: App loads, login form works, but authentication fails.

**Cause**: Supabase connection issue or CORS mismatch.

**Fix**:
```bash
# Check if Supabase is reachable from browser console:
# Network tab → look for requests to *.supabase.co

# Check CORS origins in backend
grep CORS /opt/aion/app/backend/.env
# Ensure your domain/IP is listed

# Restart backend after .env changes
pm2 restart backend-api
```

### 2. API Returns 401 Unauthorized

**Symptom**: Frontend gets 401 on all API calls.

**Cause**: JWT token mismatch between Supabase and backend.

**Fix**:
```bash
# Ensure JWT_SECRET in backend/.env matches Supabase JWT secret
# Check: Supabase Dashboard → Settings → API → JWT Secret
grep JWT_SECRET /opt/aion/app/backend/.env
```

### 3. Video Stream Not Loading

**Symptom**: Live View page shows but no video.

**Cause**: MediaMTX not receiving streams, or WebRTC port blocked.

**Fix**:
```bash
# Check MediaMTX is running
docker ps | grep mediamtx

# Check active streams
curl http://localhost:9997/v3/paths/list

# Check if RTSP port is open
ufw status | grep 8554
ufw status | grep 8889

# Test RTSP from VPS to camera
apt install ffmpeg  # if not installed
ffprobe rtsp://CAMERA_IP:554/stream1
```

### 4. Blank White Page

**Symptom**: Browser shows white page, no content.

**Cause**: JavaScript build error or missing assets.

**Fix**:
```bash
# Check if dist/ files exist
ls -la /opt/aion/app/dist/
ls -la /opt/aion/app/dist/assets/

# Check browser console (F12) for errors
# Common: CSP blocking scripts, missing chunks

# Rebuild and redeploy if needed
```

### 5. PM2 Process Keeps Restarting

**Symptom**: PM2 shows high restart count (↺ > 10).

**Fix**:
```bash
# Check error logs
pm2 logs backend-api --err --lines 50 --nostream

# Common causes:
# - Missing environment variable (Zod error)
# - Database connection timeout
# - Port already in use

# Reset restart counter after fixing
pm2 restart backend-api
```

### 6. Database Connection Timeout

**Symptom**: Backend logs show "connection timeout" or "ECONNREFUSED".

**Cause**: Supabase pooler unreachable or wrong credentials.

**Fix**:
```bash
# Test connection from VPS
apt install postgresql-client  # if not installed
psql "postgresql://postgres.oeplpbfikcrcvccimjki:PASSWORD@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require" -c "SELECT 1"

# Check if DNS resolves
nslookup aws-0-us-west-2.pooler.supabase.com

# Check firewall doesn't block outgoing
ufw status
```

### 7. Nginx 502/504 Error

**Symptom**: Browser shows "502 Bad Gateway" or "504 Gateway Timeout".

**Fix**:
```bash
# 502 = backend not running
pm2 status
pm2 restart all

# 504 = backend too slow
# Increase timeouts in nginx config
# proxy_read_timeout 120s;

# Check backend health
curl http://localhost:3000/health
```

### 8. PWA Not Installing

**Symptom**: No "Install" prompt in Chrome.

**Cause**: Missing HTTPS, invalid manifest, or service worker issue.

**Fix**:
- PWA install requires HTTPS (set up SSL with domain)
- Check manifest: `curl http://DOMAIN/manifest.webmanifest`
- Check service worker: Browser DevTools → Application → Service Workers
- Check Lighthouse: DevTools → Lighthouse → PWA audit

### 9. Push Notifications Not Working

**Cause**: Requires HTTPS and notification permission.

**Fix**:
1. Ensure site is served over HTTPS
2. User must grant notification permission
3. Service worker must be registered
4. Check browser console for errors

### 10. Rate Limited (429 Too Many Requests)

**Symptom**: API returns 429 status code.

**Cause**: Nginx or Fastify rate limiter triggered.

**Fix**:
```bash
# Check current limits in nginx
grep limit_req /etc/nginx/sites-available/aion

# Temporarily increase for testing
# Edit nginx config: burst=200
nginx -t && systemctl reload nginx

# Check Fastify rate limit
grep RATE_LIMIT /opt/aion/app/backend/.env
```

## Emergency Contacts

| Issue | Solution |
|-------|----------|
| VPS down | Hetzner Console → Restart server |
| Database down | Supabase Dashboard → check status |
| SSL expired | `certbot renew && systemctl reload nginx` |
| Disk full | `du -sh /opt/aion/logs/* && rm old logs` |
| Hacked/compromised | Take VPS offline, restore from backup |
