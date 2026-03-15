# AION Vision Hub — Live View Module

## Overview
Live View is the central operational hub of AION Vision Hub. It provides a unified interface for monitoring up to 500 camera feeds across 50 configurable sections.

## Features
- **Grid Layouts**: 1×1, 2×2, 3×3, 4×4 (extensible to 5×5, 6×6)
- **Drag & Drop**: Assign cameras to grid slots via drag and drop from sidebar
- **Layout Persistence**: Save/load/favorite layouts to database (`live_view_layouts` table)
- **Shared Layouts**: Share layouts with team operators
- **Site Filtering**: Filter cameras by site
- **Stream States**: Online/offline indicators, REC badge, reconnection placeholders
- **Quick Actions per Cell**: Fullscreen, audio, snapshot, reconnect, remove

## Operational Panels (Planned)
- **Events Panel**: Real-time event feed anchored to Live View
- **Domotic Quick Actions**: Toggle doors, sirens, lights per section
- **Access Control**: Quick resident/vehicle lookup, open gate
- **Reboot Panel**: Restart failing devices directly from Live View
- **Intercom Panel**: Quick call, welcome message, AI/operator selection
- **AION Agent**: Floating AI assistant panel for contextual help

## Tours
- **Section Tours**: Auto-cycle through cameras of a specific section
- **Motion Tours**: Prioritize cameras with recent motion events
- **Scheduled Tours**: Time-based automatic cycling
- **Manual Tours**: Operator-driven camera cycling

## Architecture
- Frontend: React component with CSS Grid
- State: React Query + local state for slot assignments
- Persistence: Supabase `live_view_layouts` table with RLS
- Video: Placeholder cells ready for WebRTC/HLS.js integration via Edge Gateway

## Next Steps
1. Integrate WebRTC/HLS.js player component
2. Add 5×5 and 6×6 grid options
3. Implement tour engine with auto-cycling
4. Add events sidebar panel
5. Add quick action panels for domotics, access, reboots, intercom
6. Implement AION Agent floating panel
