# Baseline — 2026-04-14T09:40 UTC

## Infrastructure
- PM2: **25/25 online** (0 errored)
- systemd: **7/7 active** (nginx, postgresql, redis, mosquitto, asterisk, go2rtc, aion-owl)
- Docker: **1/1** (aion-zlm, up 2h)
- Disk: 31G/193G (16%), RAM: 4.2G/15G
- 0 errors in last 1 hour

## Backend Endpoints
- **47/47 PASS, 0 FAIL**

## Database
- 166 tables, 113 with data, 510 indexes
- sites=25, cameras=353, devices=318, residents=1823, vehicles=971
- domotic_devices=86, incidents=199, events=652, audit_logs=949+

## go2rtc Streams
- **493 total** (ag:33, aion:34, ar:16, br:2, da:115, lp:16, pe:20, pp:16, pq:32, se:12, sn:17, ss:16, tl:24, vh:141)
- Frame test: alborada 70KB OK, brescia 0B FAIL, terrazzino 74KB OK (2/3)

## Routes
| Kind | Healthy | Failed |
|------|---------|--------|
| imou_cloud | 8 | 4 |
| isup_native | 6 | 5 |
| gb28181 | 0 | 23 |
| p2p_dahua | 0 | 12 |
| **Total healthy** | **14** | |

## Blockers Externos
- BX1 eWeLink: degradation elegante activa (200 con status unavailable)
- BX2 Asterisk: 0 SIP peers
- BX3 OWL GB28181: 0 devices registrados
- BX4 dh-p2p: no desplegado (reemplazado por IMOU HLS)

## Hallazgos Abiertos
| ID | Severidad | Hallazgo |
|----|-----------|----------|
| H-01 | MEDIA | brescia stream frame 0B (stream source may be stale) |
| H-02 | BAJA | 4 imou_cloud routes failed (4 devices sin registrar en IMOU) |
| H-03 | BAJA | 5 isup_native routes failed (devices sin heartbeat) |
| H-04 | INFO | 53 tables still empty (mostly runtime/transactional) |
