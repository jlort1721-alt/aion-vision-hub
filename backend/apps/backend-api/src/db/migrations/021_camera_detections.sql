-- 021: Camera Detections table for AI/analytics events
CREATE TABLE IF NOT EXISTS camera_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  camera_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL DEFAULT 'unknown',
  confidence REAL NOT NULL DEFAULT 0,
  bbox_json JSONB NOT NULL DEFAULT '{}',
  snapshot_path TEXT,
  video_clip_path TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_camera_detections_tenant_ts ON camera_detections(tenant_id, ts);
CREATE INDEX IF NOT EXISTS idx_camera_detections_site_ts ON camera_detections(site_id, ts);
CREATE INDEX IF NOT EXISTS idx_camera_detections_camera_ts ON camera_detections(camera_id, ts);
CREATE INDEX IF NOT EXISTS idx_camera_detections_type ON camera_detections(type);
