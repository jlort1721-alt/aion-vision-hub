-- 022: Domotic Scenes + Paging tables

-- Domotic Scenes
CREATE TABLE IF NOT EXISTS domotic_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  actions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domotic_scenes_tenant ON domotic_scenes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_domotic_scenes_tenant_site ON domotic_scenes(tenant_id, site_id);

-- Domotic Scene Executions
CREATE TABLE IF NOT EXISTS domotic_scene_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES domotic_scenes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  executed_by UUID NOT NULL,
  result JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'completed',
  execution_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domotic_scene_executions_scene ON domotic_scene_executions(scene_id);
CREATE INDEX IF NOT EXISTS idx_domotic_scene_executions_tenant_created ON domotic_scene_executions(tenant_id, created_at);

-- Paging Broadcasts
CREATE TABLE IF NOT EXISTS paging_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  audio_path TEXT,
  target_sites JSONB NOT NULL DEFAULT '[]',
  target_zones JSONB NOT NULL DEFAULT '[]',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'pending',
  initiated_by UUID NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paging_broadcasts_tenant_created ON paging_broadcasts(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_paging_broadcasts_tenant_status ON paging_broadcasts(tenant_id, status);

-- Paging Templates
CREATE TABLE IF NOT EXISTS paging_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  is_emergency BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paging_templates_tenant ON paging_templates(tenant_id);
