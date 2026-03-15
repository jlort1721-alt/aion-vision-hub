-- WhatsApp Security Hardening Migration
-- Adds deduplication constraint to prevent duplicate inbound messages
-- when Meta retries webhook delivery.

-- Partial unique index: only applies when wa_message_id is not null
-- (outbound messages may initially have null wa_message_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_messages_dedup
  ON wa_messages (tenant_id, wa_message_id)
  WHERE wa_message_id IS NOT NULL;
