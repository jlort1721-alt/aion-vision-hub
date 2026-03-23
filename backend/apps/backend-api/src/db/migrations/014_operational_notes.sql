-- Migration 014: Operational Notes
-- Adds a table for operator notes, shift handoff observations, and operational records

CREATE TABLE IF NOT EXISTS operational_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'media',
  is_pinned boolean NOT NULL DEFAULT false,
  author_id text NOT NULL,
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_notes_tenant ON operational_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_operational_notes_pinned ON operational_notes(tenant_id, is_pinned DESC, created_at DESC);
