# Expansion Report — CI/CD + VPS Optimization + WireGuard

**Date:** 2026-04-16T20:05Z

## Completed

### PASO A — CI/CD SSH Key
- Public key extracted from clave-demo-aion.pem
- Instructions documented for GitHub Secrets setup (3 repos)
- **BLOQUEADOR:** Isabella must add VPS_SSH_KEY secret in GitHub Settings

### PASO B.3 — PostgreSQL Optimization
- shared_buffers: 128MB → **4GB** (32x improvement)
- effective_cache_size: 4GB → **12GB** (3x)
- work_mem: 4MB → **32MB** (8x)
- maintenance_work_mem: → **512MB**
- checkpoint_completion_target: → **0.9**
- wal_buffers: → **64MB**
- random_page_cost: → **1.1** (SSD optimized)
- PostgreSQL restarted and API healthy post-restart

### PASO C.2 — WireGuard VPN on VPS
- WireGuard installed on VPS
- Server keypair generated
- **VPS Public Key: `GILIU/uO5rS6s1GEZo2ogpp+csa9rGLK2glQbrL6Aww=`**
- wg0.conf configured (10.100.0.1/24, port 51820)
- UFW rule 51820/udp added
- IP forwarding enabled
- wg-quick@wg0 enabled and running
- **WAITING:** Peer config (Ruijie router or local server public key)

## Pending (require physical access)

### PASO C.3 — WireGuard on Ruijie/Server Gateway
- Need: Ruijie router model + WireGuard support check
- Alternative: Install WireGuard on one of the 2 local servers
- VPS public key to configure as peer: `GILIU/uO5rS6s1GEZo2ogpp+csa9rGLK2glQbrL6Aww=`
- VPS endpoint: `18.230.40.6:51820`

### PASO D — Local Servers
- Need: Physical access to install Ubuntu 24.04 on both servers
- Server 1: go2rtc + detection-worker + native-device-bridge
- Server 2: face-recognition + ISAPI bridges + PG replica
