-- Migration 015: Documents, Minuta, Call Log
-- Adds tables for document management, shift logbook, and call logging

-- Documents metadata (file storage via Supabase Storage or base64 fallback)
CREATE TABLE IF NOT EXISTS documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  original_name text NOT NULL,
  size integer NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  category text NOT NULL DEFAULT 'general',
  description text,
  storage_path text,
  file_data text, -- base64 fallback if storage bucket not available
  uploaded_by text NOT NULL,
  uploaded_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(tenant_id, category);

-- Minuta / Shift Logbook entries
CREATE TABLE IF NOT EXISTS minuta_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_date date NOT NULL DEFAULT CURRENT_DATE,
  entry_time timestamptz NOT NULL DEFAULT now(),
  entry_type text NOT NULL DEFAULT 'observacion',
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  author_id text NOT NULL,
  author_name text NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minuta_tenant_date ON minuta_entries(tenant_id, shift_date DESC);
CREATE INDEX IF NOT EXISTS idx_minuta_type ON minuta_entries(tenant_id, entry_type);

-- Call log for phone panel
CREATE TABLE IF NOT EXISTS call_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  contact_name text,
  direction text NOT NULL DEFAULT 'outbound',
  status text NOT NULL DEFAULT 'completed',
  duration_seconds integer,
  operator_id text NOT NULL,
  operator_name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_log_tenant ON call_log(tenant_id, created_at DESC);
