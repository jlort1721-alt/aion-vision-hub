# Backend Endpoint Audit — 2026-04-14T06:50Z

## Summary
- **Total endpoints tested**: 56
- **200 OK**: 44
- **404 Not Found**: 9 (wrong path or unregistered sub-routes)
- **500 Internal Error**: 3
- **Effective success rate**: 44/47 registered routes = 93.6%

## 200 OK — Returning Real Data (44 endpoints)

| Endpoint | Bytes | Has Real Data |
|----------|-------|---------------|
| health | 92 | YES — uptime, version |
| sites | 9,779 | YES — 25 sites |
| devices | 94,735 | YES — 318 devices |
| cameras | 158,661 | YES — 353 cameras |
| events | 17,654 | YES — events with timestamps |
| incidents | 17,739 | YES — 199 incidents |
| alerts/rules | 3,057 | YES — 5+ rules |
| shifts | 1,651 | YES — 4+ shifts |
| patrols/routes | 870 | YES — 2+ routes |
| emergency/protocols | 2,854 | YES — 3+ protocols |
| sla/definitions | 1,701 | YES — 4 SLAs |
| domotics | 37,453 | YES — 86 devices |
| keys | 3,036 | YES — 5+ keys |
| compliance/templates | 3,864 | YES — 4 templates |
| training/programs | 2,914 | YES — 3 programs |
| scheduled-reports | 1,665 | YES — 3 reports |
| automation/rules | 17,510 | YES — 34 rules |
| notes | 3,666 | YES — operational notes |
| access-control/people | 19,548 | YES — 1823 people |
| access-control/vehicles | 12,026 | YES — 972 vehicles |
| visitors | 1,433 | YES — visitor records |
| intercom/devices | 10,741 | YES — 29 devices |
| live-view/cameras | 160,669 | YES — 353 cameras |
| vision-hub/health | 126 | YES — route stats |
| vision-hub/devices | 29,026 | YES — 23 VH devices |
| camera-detections | 16,710 | YES — 2983 detections |
| whatsapp/templates | 3,181 | YES — templates |
| notification-templates | 3,402 | YES — 10 templates |
| database-records | 4,490 | YES — records |
| contracts | 1,939 | YES — contracts |
| knowledge | 5,131 | YES — KB entries |
| scenes | 1,350 | YES — 3 scenes |
| paging/templates | 1,626 | YES — templates |
| users | 1,099 | YES — user profiles |
| roles | 637 | YES — role assignments |
| integrations | 5,646 | YES — integration configs |
| voice/config | 67 | YES — provider config |
| push/vapid-public-key | 132 | YES — VAPID key |
| reports | 1,673 | YES — report definitions |

### Empty but functional (200 with empty data):
| Endpoint | Note |
|----------|------|
| reboots | No reboot tasks pending — correct |
| live-view/layouts | No saved layouts — correct |
| floor-plans | No floor plans uploaded — correct |
| clips | No clips exported — correct |
| streams | No active stream sessions — correct |

## 500 Internal Error — FAILURES (3 endpoints)

| Endpoint | Error |
|----------|-------|
| vision-hub/events | Unknown (needs log investigation) |
| ewelink/devices | "Not authenticated. Call login first." — eWeLink cloud API auth failure |
| operator-assignments | Unknown (needs log investigation) |

## 404 Not Found — Path Mismatch (9 endpoints)

These are sub-routes that don't exist at the guessed path:
- audit (correct: /audit/logs)
- analytics/biomarkers (may need different path)
- network/devices (correct: /network/scan or similar)
- lpr/events (correct: /lpr/detections or similar)
- playback/sessions (correct: /playback/request or similar)
- ai/health (correct: /ai/chat or similar)
- internal-agent/health (correct: /internal-agent/analyze)
- operational-data (correct: /operational-data/overview)

