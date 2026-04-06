-- ============================================================
-- AION — Migration 018: RLS Security Hardening
-- [CRIT-DB-001] knowledge_base + ai_conversations RLS
-- [CRIT-DB-003] WhatsApp tables RLS fix
-- [CRIT-DB-004] profiles_safe view
-- ============================================================

BEGIN;

-- ═══ knowledge_base — Enable RLS ═══

ALTER TABLE knowledge_base ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kb_tenant_isolation" ON knowledge_base;
CREATE POLICY "kb_tenant_isolation" ON knowledge_base
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- ═══ ai_conversations — Enable RLS ═══

ALTER TABLE ai_conversations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations FORCE ROW LEVEL SECURITY;

-- User sees only their own conversations
DROP POLICY IF EXISTS "aic_user_isolation" ON ai_conversations;
CREATE POLICY "aic_user_isolation" ON ai_conversations
  FOR ALL USING (
    user_id = auth.uid()
    AND tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
  );

-- Admin sees all tenant conversations
DROP POLICY IF EXISTS "aic_admin_tenant" ON ai_conversations;
CREATE POLICY "aic_admin_tenant" ON ai_conversations
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    AND (SELECT role FROM user_roles WHERE user_id = auth.uid() LIMIT 1) IN ('super_admin', 'tenant_admin')
  );

-- ═══ WhatsApp tables — Fix RLS to use auth.uid() ═══

-- wa_conversations
DROP POLICY IF EXISTS "wa_conversations_tenant" ON wa_conversations;
DROP POLICY IF EXISTS "wa_conversations_select" ON wa_conversations;
DROP POLICY IF EXISTS "wa_conversations_insert" ON wa_conversations;
DROP POLICY IF EXISTS "wa_conversations_update" ON wa_conversations;

CREATE POLICY "wa_conversations_tenant_all" ON wa_conversations
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- wa_messages (through conversation)
DROP POLICY IF EXISTS "wa_messages_tenant" ON wa_messages;
DROP POLICY IF EXISTS "wa_messages_select" ON wa_messages;
DROP POLICY IF EXISTS "wa_messages_insert" ON wa_messages;
DROP POLICY IF EXISTS "wa_messages_update" ON wa_messages;

CREATE POLICY "wa_messages_tenant_all" ON wa_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM wa_conversations wc
      WHERE wc.id = wa_messages.conversation_id
        AND wc.tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- wa_templates
DROP POLICY IF EXISTS "wa_templates_tenant" ON wa_templates;
DROP POLICY IF EXISTS "wa_templates_select" ON wa_templates;
DROP POLICY IF EXISTS "wa_templates_insert" ON wa_templates;
DROP POLICY IF EXISTS "wa_templates_update" ON wa_templates;

CREATE POLICY "wa_templates_tenant_all" ON wa_templates
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- ═══ profiles_safe — Secure view without sensitive fields ═══

CREATE OR REPLACE VIEW public.profiles_safe
  WITH (security_barrier = true) AS
  SELECT
    id,
    user_id,
    tenant_id,
    email,
    full_name,
    avatar_url,
    status,
    is_active,
    last_login,
    created_at,
    updated_at
    -- EXCLUDED: password_hash, reset_token, reset_token_expires
  FROM profiles;

GRANT SELECT ON public.profiles_safe TO authenticated;
GRANT SELECT ON public.profiles_safe TO anon;

COMMIT;
