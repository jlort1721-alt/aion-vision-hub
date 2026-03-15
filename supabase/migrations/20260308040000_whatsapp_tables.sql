-- ═══════════════════════════════════════════════════════════
-- WhatsApp Business Integration Tables
-- ═══════════════════════════════════════════════════════════

-- ── Conversations ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wa_contact_phone VARCHAR(32) NOT NULL,
  wa_contact_name  VARCHAR(255),
  wa_profile_pic_url VARCHAR(1024),
  status        VARCHAR(32) NOT NULL DEFAULT 'ai_bot',
  assigned_to   UUID,
  section_context VARCHAR(128),
  metadata      JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  closed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_conversations_tenant ON wa_conversations(tenant_id);
CREATE INDEX idx_wa_conversations_phone ON wa_conversations(tenant_id, wa_contact_phone);
CREATE INDEX idx_wa_conversations_status ON wa_conversations(tenant_id, status);
CREATE INDEX idx_wa_conversations_last_msg ON wa_conversations(last_message_at DESC);

-- ── Messages ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
  wa_message_id   VARCHAR(255),
  direction       VARCHAR(16) NOT NULL,
  message_type    VARCHAR(32) NOT NULL DEFAULT 'text',
  sender_type     VARCHAR(32) NOT NULL,
  sender_name     VARCHAR(255),
  body            TEXT,
  media_url       VARCHAR(1024),
  delivery_status VARCHAR(32) DEFAULT 'sent',
  metadata        JSONB DEFAULT '{}',
  error_code      VARCHAR(64),
  error_message   TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_messages_conversation ON wa_messages(conversation_id, created_at DESC);
CREATE INDEX idx_wa_messages_wa_id ON wa_messages(tenant_id, wa_message_id);
CREATE INDEX idx_wa_messages_direction ON wa_messages(conversation_id, direction);

-- ── Templates ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wa_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  language        VARCHAR(16) NOT NULL DEFAULT 'en_US',
  status          VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  category        VARCHAR(64) NOT NULL DEFAULT 'UTILITY',
  components      JSONB DEFAULT '[]',
  parameter_names JSONB DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_templates_tenant ON wa_templates(tenant_id);
CREATE UNIQUE INDEX idx_wa_templates_unique ON wa_templates(tenant_id, name, language);

-- ── RLS Policies ───────────────────────────────────────────
ALTER TABLE wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY wa_conversations_tenant_isolation ON wa_conversations
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE POLICY wa_messages_tenant_isolation ON wa_messages
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

CREATE POLICY wa_templates_tenant_isolation ON wa_templates
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
