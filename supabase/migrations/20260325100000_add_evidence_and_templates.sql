-- ═══════════════════════════════════════════════════════════
-- Add Evidence & Notification Templates tables
-- Syncs Supabase with Drizzle ORM schema definitions added by agents
-- ═══════════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. EVIDENCE — Incident evidence attachments               ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,

  -- Classification
  type TEXT NOT NULL DEFAULT 'snapshot',  -- snapshot, clip, document, note

  -- File metadata
  file_url TEXT,
  thumbnail_url TEXT,
  file_name TEXT,
  mime_type TEXT,

  -- Details
  description TEXT,
  captured_at TIMESTAMPTZ,

  -- Audit
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read
CREATE POLICY "Tenant sees evidence"
ON public.evidence FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Operators+ can insert evidence
CREATE POLICY "Operators create evidence"
ON public.evidence FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
);

-- Admins can delete evidence
CREATE POLICY "Admins delete evidence"
ON public.evidence FOR DELETE TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
);

-- Indexes (match Drizzle index definitions)
CREATE INDEX IF NOT EXISTS idx_evidence_tenant
  ON public.evidence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_evidence_incident
  ON public.evidence(incident_id);
CREATE INDEX IF NOT EXISTS idx_evidence_device
  ON public.evidence(device_id);
CREATE INDEX IF NOT EXISTS idx_evidence_created
  ON public.evidence(tenant_id, created_at DESC);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. NOTIFICATION TEMPLATES — Multi-channel message templates║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Template identity
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(32) NOT NULL,   -- alert, incident, shift, visitor, access, system, automation
  channel VARCHAR(16) NOT NULL,    -- email, whatsapp, push, all

  -- Content
  subject VARCHAR(255),            -- for email channel
  body_template TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Flags
  is_system BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read
CREATE POLICY "Tenant sees notification templates"
ON public.notification_templates FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Operators+ can create templates
CREATE POLICY "Operators create notification templates"
ON public.notification_templates FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
);

-- Operators+ can update templates
CREATE POLICY "Operators update notification templates"
ON public.notification_templates FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
);

-- Admins can delete templates (system template guard enforced in app layer)
CREATE POLICY "Admins delete notification templates"
ON public.notification_templates FOR DELETE TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
);

-- Auto-update updated_at on modification
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes (match Drizzle index definitions)
CREATE INDEX IF NOT EXISTS idx_notification_templates_tenant
  ON public.notification_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_templates_category
  ON public.notification_templates(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_notification_templates_channel
  ON public.notification_templates(tenant_id, channel);


-- ═══════════════════════════════════════════════════════════
-- Realtime publication
-- ═══════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.evidence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_templates;
