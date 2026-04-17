# VPS Scaling Complete — 2026-04-17

## Changes Applied

### Instance
- From: t3.xlarge (4 vCPU, 16GB RAM)
- To: **t3.2xlarge (8 vCPU, 30GB RAM)**
- Downtime: ~5 min (AWS stop/change/start)

### PostgreSQL (re-tuned for 32GB)
- shared_buffers: 4GB → **8GB**
- effective_cache_size: 12GB → **24GB**
- work_mem: 32MB → **64MB**
- maintenance_work_mem: 512MB → **1GB**

### PM2 cluster mode
- aionseg-api: fork_mode → **cluster mode, 4 instances**
- Load balanced across all 4 workers on port 3001
- Max memory per instance: 600MB

## Results

| Metric | Before | After |
|---|---|---|
| CPU cores | 4 | **8** |
| RAM | 16GB | **30GB** |
| PG shared_buffers | 4GB | **8GB** |
| API instances | 1 | **4 (cluster)** |
| PM2 total | 28 | **31** |
| Capacity | 129 streams | 300+ streams supported |

## Verification

- Instance type: t3.2xlarge ✓
- API healthy ✓
- 31 PM2 online, 0 errored ✓
- 4 aionseg-api cluster instances ✓
- Streams: 125 active ✓
- WireGuard: listening port 51820 ✓
