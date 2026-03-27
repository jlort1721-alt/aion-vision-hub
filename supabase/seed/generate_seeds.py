#!/usr/bin/env python3
"""
Parse 03_seed_data_residents.sql and generate batched seed SQL files
for the AION multi-tenant residents table.
"""

import re
import os

TENANT_ID = 'a0000000-0000-0000-0000-000000000001'

# Map source site names (uppercase) to actual DB site IDs
SITE_MAP = {
    'TORRE LUCIA': '9893b009-6d9c-41fd-9dc5-e83c5abe5bb4',
    'SAN NICOLAS': '391757b5-2bcc-421a-af65-fe61b842125e',
    'ALBORADA': '3eb7702c-ac71-4833-b9a5-24fb8cec3124',
    'BRESCIA': 'd696cdc1-d612-4341-94b3-968cdee71fd8',
    'PATIO BONITO': '05f03238-710c-4a4d-9182-37bece42be07',
    'PISQUINES': '8dabd807-834a-48f9-90b7-bb7e5f5e8920',
    'SAN SEBASTIAN': 'cd422171-b11d-44ac-9ad9-fdd6aa7cf598',
    'TERRABAMBA': 'fec83234-67f1-44d9-8513-070dc4a675d6',
    'ALTOS DEL ROSARIO': '14144ed6-d282-4ba8-a6d2-32378ee77b5c',
    'SENDEROS DE CALASANZ': '11ee6145-a1e2-4cfd-995b-be1b415a1809',
    'DANUBIOS': '05535931-729d-4ce3-92da-6dfb6ba50d5d',
    'TERRAZZINO': '91e8e4f9-5a6c-47f0-9862-04d34f909045',
    'PORTAL PLAZA': 'b5f97a8b-b597-46d9-9c51-1d033791aedc',
    'PORTALEGRE': '24ca642f-68ab-4909-bf94-54fdc7319706',
    'ALTAGRACIA': 'f4ecf46c-2deb-4c4e-b4f7-02a867d99d60',
    'LUBECK': '0705f3ea-12fb-4cf7-a69a-b02e5284fea5',
    'QUINTAS SANTA MARIA': '2bcc76a0-dc3c-4fd2-ac4e-c6d1060c2e8c',
    'APARTACASAS': '56dfb89c-bdc5-42d9-a6fa-e47bbb884f1e',
}

def escape_sql(val):
    """Escape single quotes for SQL strings and normalize whitespace."""
    if val is None:
        return 'NULL'
    # Replace newlines with spaces (multiline notes/phones from source)
    escaped = val.replace('\r\n', ' ').replace('\n', ' ').replace('\r', ' ')
    # Collapse multiple spaces
    while '  ' in escaped:
        escaped = escaped.replace('  ', ' ')
    escaped = escaped.strip()
    if not escaped:
        return 'NULL'
    # Replace single quotes with doubled single quotes
    escaped = escaped.replace("'", "''")
    return f"'{escaped}'"

def parse_source_file(filepath):
    """Parse the source SQL file and extract all resident rows."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract the VALUES block - everything between the first ( after VALUES and the final ) AS t(
    # Find the start of VALUES content
    values_start = content.find("FROM (VALUES\n")
    if values_start == -1:
        values_start = content.find("FROM (VALUES")

    values_end = content.find(") AS t(site_name,")
    if values_end == -1:
        values_end = content.find(") AS t(")

    values_block = content[values_start:values_end]

    # We need to parse row by row. Each row starts with ('SITE_NAME',
    # But rows can span multiple lines (multiline strings).
    # Strategy: find each tuple pattern

    rows = []
    current_site = None

    # Use a state machine to parse tuples
    # Find all tuples: they start with  (' and end with ),  or the last one ends with )

    # Simpler approach: read the raw file line by line and reconstruct
    # We'll work with the original file lines
    lines = content.split('\n')

    in_values = False
    tuple_buffer = ''

    for line in lines:
        stripped = line.strip()

        if "FROM (VALUES" in stripped:
            in_values = True
            continue

        if not in_values:
            continue

        if stripped.startswith(") AS t("):
            # End of values
            if tuple_buffer:
                rows.append(parse_tuple(tuple_buffer))
            break

        # Accumulate lines into tuple buffer
        if stripped.startswith("('") or stripped.startswith("  ('"):
            # New tuple starts
            if tuple_buffer:
                rows.append(parse_tuple(tuple_buffer))
            tuple_buffer = stripped
        else:
            # Continuation of previous tuple (multiline string)
            tuple_buffer += '\n' + stripped

    return rows

def parse_tuple(raw):
    """Parse a single tuple like ('SITE', 'UNIT', 'NAME', 'PHONE', 'NOTES') or with NULLs."""
    # Remove leading/trailing whitespace, commas, parentheses
    raw = raw.strip()
    if raw.startswith('('):
        raw = raw[1:]
    if raw.endswith('),'):
        raw = raw[:-2]
    elif raw.endswith(')'):
        raw = raw[:-1]

    # Now parse 5 comma-separated values, where values can be 'string' or NULL
    # Strings can contain commas and single quotes (escaped as '')
    values = []
    i = 0
    while i < len(raw) and len(values) < 5:
        # Skip whitespace
        while i < len(raw) and raw[i] in (' ', '\t'):
            i += 1

        if i >= len(raw):
            break

        if raw[i] == "'":
            # String value - find the closing quote
            i += 1  # skip opening quote
            val = ''
            while i < len(raw):
                if raw[i] == "'" and i + 1 < len(raw) and raw[i+1] == "'":
                    # Escaped quote
                    val += "'"
                    i += 2
                elif raw[i] == "'":
                    # End of string
                    i += 1
                    break
                else:
                    val += raw[i]
                    i += 1
            values.append(val)
        elif raw[i:i+4] == 'NULL':
            values.append(None)
            i += 4
        else:
            # Unexpected - try to read until comma
            end = raw.find(',', i)
            if end == -1:
                values.append(raw[i:].strip())
                i = len(raw)
            else:
                values.append(raw[i:end].strip())
                i = end

        # Skip comma separator
        while i < len(raw) and raw[i] in (' ', '\t', ','):
            if raw[i] == ',':
                i += 1
                break
            i += 1

    # Pad to 5 values
    while len(values) < 5:
        values.append(None)

    return tuple(values[:5])

def generate_insert(site_id, unit, name, phone, notes):
    """Generate a single VALUES tuple for the INSERT statement."""
    return f"  ('{TENANT_ID}', '{site_id}', {escape_sql(unit)}, {escape_sql(name)}, {escape_sql(phone)}, {escape_sql(notes)}, 'resident')"

def main():
    source = '/Users/ADMIN/Downloads/03_seed_data_residents.sql'
    output_dir = '/Users/ADMIN/Documents/open-view-hub-main/supabase/seed'

    print("Parsing source file...")
    rows = parse_source_file(source)
    print(f"Parsed {len(rows)} rows total")

    # Header values to filter out (spreadsheet column headers that leaked into data)
    HEADER_NAMES = {
        'NOMBRE APELLIDO', 'NOMBRE  APELLIDO', 'NOMBRE/APELLIDOS',
        'NOMBRES Y APELLIDOS', 'CELULAR', 'CONTACTO',
    }
    HEADER_UNITS = {
        'NRO APTO', 'LOTE/CASA', 'UBICACIÓN', 'NOMBRES Y APELLIDOS',
    }

    # Build insert tuples
    inserts = []
    skipped = []

    for row in rows:
        site_name, unit, name, phone, notes = row

        if site_name is None:
            skipped.append(('NO_SITE', row))
            continue

        site_key = site_name.upper().strip()
        site_id = SITE_MAP.get(site_key)

        if site_id is None:
            skipped.append((site_key, row))
            continue

        if name is None or name.strip() == '':
            skipped.append(('NO_NAME', row))
            continue

        # Filter out spreadsheet header rows
        if name.strip() in HEADER_NAMES or (unit and unit.strip() in HEADER_UNITS):
            skipped.append(('HEADER', row))
            continue

        # Filter out URL rows
        if name.startswith('http://') or name.startswith('https://'):
            skipped.append(('URL', row))
            continue

        inserts.append(generate_insert(site_id, unit, name, phone, notes))

    print(f"Valid inserts: {len(inserts)}")
    print(f"Skipped: {len(skipped)}")

    if skipped:
        print("\nSkipped rows (first 10):")
        for reason, row in skipped[:10]:
            print(f"  {reason}: {row}")

    # Split into batches of 200
    BATCH_SIZE = 200
    batches = [inserts[i:i+BATCH_SIZE] for i in range(0, len(inserts), BATCH_SIZE)]

    print(f"\nGenerating {len(batches)} batch files...")

    # Write batch 0 = migration (create table if not exists)
    migration_content = f"""-- ================================================================
-- AION Residents Table — Multi-tenant extension
-- Creates the residents table if it doesn't exist
-- Run this BEFORE the seed batches
-- ================================================================

CREATE TABLE IF NOT EXISTS public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  unit_number TEXT,
  full_name TEXT NOT NULL,
  phone_primary TEXT,
  notes TEXT,
  resident_type TEXT NOT NULL DEFAULT 'resident',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_residents_tenant ON public.residents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_residents_site ON public.residents(site_id);
CREATE INDEX IF NOT EXISTS idx_residents_unit ON public.residents(unit_number);
CREATE INDEX IF NOT EXISTS idx_residents_name ON public.residents(full_name);
CREATE INDEX IF NOT EXISTS idx_residents_tenant_site ON public.residents(tenant_id, site_id);

-- Trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_residents_updated_at'
  ) THEN
    CREATE TRIGGER update_residents_updated_at
      BEFORE UPDATE ON public.residents
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- RLS
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'residents' AND policyname = 'Tenant sees residents'
  ) THEN
    CREATE POLICY "Tenant sees residents"
      ON public.residents FOR SELECT TO authenticated
      USING (tenant_id = public.get_user_tenant_id(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'residents' AND policyname = 'Admins manage residents'
  ) THEN
    CREATE POLICY "Admins manage residents"
      ON public.residents FOR ALL TO authenticated
      USING (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'operator'))
      )
      WITH CHECK (
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (public.has_role(auth.uid(), 'tenant_admin') OR public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'operator'))
      );
  END IF;
END $$;

COMMENT ON TABLE public.residents IS 'Residents directory per site. Multi-tenant with RLS.';
"""

    migration_path = os.path.join(output_dir, 'seed_residents_00_migration.sql')
    with open(migration_path, 'w', encoding='utf-8') as f:
        f.write(migration_content)
    print(f"  Written: {migration_path}")

    for batch_num, batch in enumerate(batches, start=1):
        header = f"""-- ================================================================
-- AION Residents Seed — Batch {batch_num} of {len(batches)}
-- {len(batch)} rows | tenant: {TENANT_ID}
-- Generated from 03_seed_data_residents.sql
-- ================================================================

INSERT INTO public.residents (tenant_id, site_id, unit_number, full_name, phone_primary, notes, resident_type)
VALUES
"""
        footer = "\nON CONFLICT DO NOTHING;\n"

        body = ',\n'.join(batch)

        filename = f'seed_residents_batch{batch_num:02d}.sql'
        filepath = os.path.join(output_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(header + body + footer)

        print(f"  Written: {filepath} ({len(batch)} rows)")

    print(f"\nDone! {len(batches)} batch files + 1 migration file written to {output_dir}")

if __name__ == '__main__':
    main()
