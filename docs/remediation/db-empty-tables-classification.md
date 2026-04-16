# Empty Tables Classification — 2026-04-16

50 tables with 0 rows. Classified by status.

## Active Features (table ready, awaiting user data) — 28 tables

These have working backend endpoints + frontend UI. They're empty because no user has used the feature yet.

| Table | Module | Reason empty |
|---|---|---|
| access_events | access-control | No access events recorded yet |
| access_points | access-control | No access points configured |
| camera_links | camera-links | Live View Pro — new feature, no links created |
| camera_snapshots | cameras | No manual snapshots saved |
| clip_exports | clips | No clip exports requested |
| clips | clips | No clips exported |
| domotic_actions | domotics | No IoT actions executed |
| domotic_scene_executions | domotics | No scenes executed |
| face_enrollments | face-recognition | No faces enrolled |
| floor_plan_positions | floor-plans | No camera positions on floor plans |
| floor_plans | floor-plans | No floor plans uploaded |
| incident_notes | incidents | No incident notes added |
| iot_scene_actions | scenes | No scene action definitions |
| iot_scenes | scenes | No IoT scenes created |
| iot_schedules | scenes | No IoT schedules created |
| key_logs | keys | No key handover events |
| live_recordings | live-recordings | Live View Pro — new, no recordings |
| live_view_layouts | live-view | No saved camera layouts |
| lpr_events | lpr | No license plate events |
| monitoring_layouts | live-view | No monitoring layouts saved |
| playback_requests | playback | No playback exports requested |
| push_subscriptions | push | No push notification subscriptions |
| reboot_tasks | reboots | No scheduled reboots |
| user_scenes | user-scenes | Live View Pro — new, no scenes |
| wa_conversations | whatsapp | No WhatsApp conversations |
| wa_messages | whatsapp | No WhatsApp messages |
| paging_broadcasts | paging | No PA broadcasts sent |
| notification_rules | alerts | No custom notification rules (using defaults) |

## Infrastructure/System (expected empty or low-use) — 12 tables

| Table | Reason |
|---|---|
| agent_learning | AI agent learning data — feature not active |
| agent_tool_logs | MCP tool execution logs — starts populating with agent use |
| ai_detection_zones | AI zone config — no zones defined yet |
| ai_vision_detections | AI vision results — populates via detection-worker |
| alarm_verifications | Alarm verification flow — not yet active |
| call_sessions | VoIP call sessions — populates via asterisk-call-logger |
| camera_events | Camera-specific events — separate from general events |
| device_health_log | Device health history — populates via health-check-worker |
| domotics_audit_logs | Domotics audit trail — populates on action |
| event_log | Legacy event log (may be superseded by events table) |
| knowledge_uploads | Knowledge base file uploads |
| motion_events | Motion detection events — separate pipeline |

## Possibly Orphaned (verify before cleanup) — 6 tables

| Table | Suspicion |
|---|---|
| certifications | May not have UI or API |
| invoices | Billing feature — may not be implemented |
| mcp_connectors | MCP connector registry — may be unused |
| network_configs | Network configuration — may not have UI |
| resident_reports | Resident reporting — may not have frontend |
| video_search_index | Video search index — may not be populated |

## System/Config (expected empty or special) — 4 tables

| Table | Reason |
|---|---|
| site_cctv_description | CCTV site descriptions — recently added tenant_id |
| stream_health | Stream health metrics — may populate from go2rtc |
| stream_sessions | Stream session tracking — may populate from WebRTC |
| system_credentials | System-level credentials — admin-only |

## Summary

- **28 active features** — tables ready, awaiting user data
- **12 infrastructure** — populate automatically with system use
- **6 possibly orphaned** — verify if module/UI exists
- **4 system/config** — special purpose

**Recommendation:** No tables should be dropped. The 6 "possibly orphaned" should be verified with `grep tablename backend/` to confirm if they're used in code.
