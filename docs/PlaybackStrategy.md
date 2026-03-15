# AION Vision Hub — Playback Strategy

## Playback Sources

1. **NVR Storage** — Primary source for recorded video
2. **Device Edge Storage** — SD card recordings on cameras
3. **Cloud Storage** — Exported clips stored in object storage

## Playback Modes

### By Time Range
- User selects device + date + start/end time
- Gateway queries NVR for available recordings
- Returns timeline with gaps and event markers

### By Event
- User clicks event → system resolves device + timestamp
- Adds ±30 second buffer around event time
- Highlights event moment on timeline

### By Device
- Browse 24h timeline for selected device
- Color-coded segments: recorded, motion, alarm, AI event

## Export Flow

```
1. User selects clip range
2. Frontend creates playback_request (status: pending)
3. Gateway processes export:
   a. Retrieves video from NVR/device
   b. Transcodes if needed (H.265→H.264)
   c. Packages as MP4
   d. Uploads to storage bucket
   e. Updates playback_request (status: ready, output_url)
4. User downloads from signed URL
```

## Snapshot Capture

- Gateway sends ISAPI/HTTP command to device
- Returns JPEG blob
- Can be attached to incidents as evidence

## Timeline Data Structure

```typescript
interface TimelineSegment {
  start: string;       // ISO timestamp
  end: string;
  type: 'continuous' | 'motion' | 'alarm' | 'smart_event';
  has_audio: boolean;
}
```

## Implementation Status

| Feature | Status |
|---------|--------|
| Playback UI with timeline | ✅ Complete |
| Device selector (Supabase) | ✅ Connected |
| playback_requests table | ✅ Schema ready |
| Export job processing | 📋 Gateway required |
| NVR SDK integration | 📋 Contract ready |
