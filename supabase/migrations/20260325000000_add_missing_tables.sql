-- ═══════════════════════════════════════════════════════════
-- Add Missing Tables: call_sessions, voip_config, refresh_tokens,
-- api_keys, reports, biomarkers
-- Syncs Supabase with Drizzle ORM schema definitions
-- ═══════════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 1. CALL SESSIONS — VoIP call session lifecycle tracking  ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE public.call_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.intercom_devices(id) ON DELETE SET NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,

  -- Call identification
  direction TEXT NOT NULL DEFAULT 'inbound',
  status TEXT NOT NULL DEFAULT 'initiating',
  mode TEXT NOT NULL DEFAULT 'ai',
  sip_call_id TEXT,

  -- Participants
  caller_uri TEXT NOT NULL DEFAULT '',
  callee_uri TEXT NOT NULL DEFAULT '',
  attended_by TEXT,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- AI / Greeting
  greeting_text TEXT,
  handoff_occurred BOOLEAN DEFAULT false,
  handoff_reason TEXT,

  -- Visitor info
  visitor_name TEXT,
  visitor_destination TEXT,
  dtmf_collected TEXT,

  -- Access control
  access_granted BOOLEAN DEFAULT false,

  -- Recording & Notes
  recording_url TEXT,
  notes TEXT,

  -- Full conversation log and metadata
  conversation_log JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read
CREATE POLICY "Tenant sees call sessions"
ON public.call_sessions FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Operators can insert call sessions
CREATE POLICY "Operators create call sessions"
ON public.call_sessions FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
);

-- Operators can update call sessions (e.g., end a call, add notes)
CREATE POLICY "Operators update call sessions"
ON public.call_sessions FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
);

-- Admins can delete call sessions
CREATE POLICY "Admins delete call sessions"
ON public.call_sessions FOR DELETE TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
);

-- Indexes
CREATE INDEX idx_call_sessions_tenant_created
  ON public.call_sessions(tenant_id, started_at DESC);
CREATE INDEX idx_call_sessions_tenant_status
  ON public.call_sessions(tenant_id, status);
CREATE INDEX idx_call_sessions_device
  ON public.call_sessions(device_id);
CREATE INDEX idx_call_sessions_sip_call_id
  ON public.call_sessions(sip_call_id) WHERE sip_call_id IS NOT NULL;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 2. VOIP CONFIG — SIP/PBX configuration per tenant       ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE public.voip_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,

  -- SIP Server
  sip_host TEXT,
  sip_port INTEGER DEFAULT 5060,
  sip_transport TEXT DEFAULT 'udp',
  sip_domain TEXT,

  -- PBX / ARI
  pbx_type TEXT DEFAULT 'none',
  ari_url TEXT,
  ari_username TEXT,
  ari_password TEXT,

  -- Orchestration defaults
  default_mode TEXT DEFAULT 'mixed',
  greeting_context TEXT DEFAULT 'default',
  greeting_language TEXT DEFAULT 'es',
  greeting_voice_id TEXT,
  ai_timeout_seconds INTEGER DEFAULT 15,
  door_open_dtmf TEXT DEFAULT '#',
  auto_open_enabled BOOLEAN DEFAULT false,
  operator_extension TEXT,
  recording_enabled BOOLEAN DEFAULT false,

  -- Fanvil-specific
  fanvil_admin_user TEXT,
  fanvil_admin_password TEXT,
  auto_provision_enabled BOOLEAN DEFAULT false,

  -- ElevenLabs voice for intercom
  custom_site_name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voip_config ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read
CREATE POLICY "Tenant sees voip config"
ON public.voip_config FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Admin-only write
CREATE POLICY "Admins manage voip config"
ON public.voip_config FOR ALL TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
);

CREATE TRIGGER update_voip_config_updated_at
  BEFORE UPDATE ON public.voip_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_voip_config_tenant
  ON public.voip_config(tenant_id);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 3. REFRESH TOKENS — JWT refresh token storage            ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE public.refresh_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  family UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own refresh tokens
CREATE POLICY "Users see own refresh tokens"
ON public.refresh_tokens FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own tokens
CREATE POLICY "Users create own refresh tokens"
ON public.refresh_tokens FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can revoke their own tokens
CREATE POLICY "Users update own refresh tokens"
ON public.refresh_tokens FOR UPDATE TO authenticated
USING (user_id = auth.uid());

-- Users can delete their own tokens
CREATE POLICY "Users delete own refresh tokens"
ON public.refresh_tokens FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_refresh_tokens_token_hash
  ON public.refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user
  ON public.refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_tenant_created
  ON public.refresh_tokens(tenant_id, created_at DESC);
CREATE INDEX idx_refresh_tokens_family
  ON public.refresh_tokens(family);
CREATE INDEX idx_refresh_tokens_expires
  ON public.refresh_tokens(expires_at)
  WHERE revoked_at IS NULL;


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 4. API KEYS — Programmatic access key management         ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{read}'::text[],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Admin-only read
CREATE POLICY "Admins see api keys"
ON public.api_keys FOR SELECT TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
);

-- Admin-only insert
CREATE POLICY "Admins create api keys"
ON public.api_keys FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
);

-- Admin-only update (revoke, update last_used_at)
CREATE POLICY "Admins update api keys"
ON public.api_keys FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
);

-- Admin-only delete
CREATE POLICY "Admins delete api keys"
ON public.api_keys FOR DELETE TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
);

-- Indexes
CREATE INDEX idx_api_keys_key_hash
  ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_tenant_created
  ON public.api_keys(tenant_id, created_at DESC);
CREATE INDEX idx_api_keys_tenant_prefix
  ON public.api_keys(tenant_id, key_prefix);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 5. REPORTS — Generated report records                    ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  parameters JSONB DEFAULT '{}'::jsonb,
  format VARCHAR(20) NOT NULL DEFAULT 'pdf',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  result_url TEXT,
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read
CREATE POLICY "Tenant sees reports"
ON public.reports FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Operators can create reports
CREATE POLICY "Operators create reports"
ON public.reports FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
);

-- Operators can update reports (status changes)
CREATE POLICY "Operators update reports"
ON public.reports FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
);

-- Admins can delete reports
CREATE POLICY "Admins delete reports"
ON public.reports FOR DELETE TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin'))
);

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_reports_tenant_created
  ON public.reports(tenant_id, created_at DESC);
CREATE INDEX idx_reports_tenant_status
  ON public.reports(tenant_id, status);
CREATE INDEX idx_reports_tenant_type
  ON public.reports(tenant_id, type);
CREATE INDEX idx_reports_generated_by
  ON public.reports(generated_by);


-- ╔═══════════════════════════════════════════════════════════╗
-- ║ 6. BIOMARKERS — Facial recognition embeddings            ║
-- ╚═══════════════════════════════════════════════════════════╝

CREATE TABLE public.biomarkers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  subject_id TEXT NOT NULL,
  embedding REAL[] NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.95,
  phenotypic_metadata JSONB DEFAULT '{}'::jsonb,
  feature_tags TEXT[],
  last_seen_location_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.biomarkers ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read
CREATE POLICY "Tenant sees biomarkers"
ON public.biomarkers FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()));

-- Admins and operators can manage biomarkers
CREATE POLICY "Admins manage biomarkers"
ON public.biomarkers FOR ALL TO authenticated
USING (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
)
WITH CHECK (
  tenant_id = get_user_tenant_id(auth.uid())
  AND (has_role(auth.uid(), 'tenant_admin') OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'operator'))
);

CREATE TRIGGER update_biomarkers_updated_at
  BEFORE UPDATE ON public.biomarkers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_biomarkers_tenant_created
  ON public.biomarkers(tenant_id, created_at DESC);
CREATE INDEX idx_biomarkers_tenant_subject
  ON public.biomarkers(tenant_id, subject_id);
CREATE INDEX idx_biomarkers_last_seen
  ON public.biomarkers(tenant_id, last_seen_at DESC);


-- ═══════════════════════════════════════════════════════════
-- Auto-vacuum tuning for high-volume tables
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.call_sessions SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

ALTER TABLE public.refresh_tokens SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);
