-- Migration: 007_call_sessions_voip_config
-- Description: Add call_sessions and voip_config tables for intercom orchestration
-- Date: 2026-03-08

-- ── Call Sessions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id UUID REFERENCES intercom_devices(id) ON DELETE SET NULL,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,

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

CREATE INDEX idx_call_sessions_tenant ON call_sessions(tenant_id);
CREATE INDEX idx_call_sessions_device ON call_sessions(device_id);
CREATE INDEX idx_call_sessions_started ON call_sessions(started_at DESC);
CREATE INDEX idx_call_sessions_status ON call_sessions(tenant_id, status);

-- ── VoIP Configuration (per tenant) ──────────────────────
CREATE TABLE IF NOT EXISTS voip_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

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
  fanvil_admin_user TEXT DEFAULT 'admin',
  fanvil_admin_password TEXT DEFAULT 'admin',
  auto_provision_enabled BOOLEAN DEFAULT false,

  -- Site branding
  custom_site_name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_voip_config_tenant ON voip_config(tenant_id);
