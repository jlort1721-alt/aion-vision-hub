-- ═══════════════════════════════════════════════════════════
-- AION — Multi-tenant Seed Data
-- Tenant: a0000000-0000-0000-0000-000000000001
-- Auto-generated from 04_seed_vehicles_access.sql
-- ═══════════════════════════════════════════════════════════

-- ── Intercoms (18 records) ─────────────────────────────────
INSERT INTO public.intercoms (tenant_id, site_id, location, number, code)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  s.id,
  t.loc,
  t.num::INTEGER,
  t.code
FROM (VALUES
  ('TORRE LUCIA', 'PEATONAL', '1007', 'O116'),
  ('TERRABAMBA', 'PEATONAL', '1022', '4583.0'),
  ('BRESCIA', 'PEATONAL', '1023', NULL),
  ('PISQUINES', 'PEATONAL', '1003', 'O120'),
  ('SAN SEBASTIAN', 'PEATONAL', '1021', '4583.0'),
  ('ALTAGRACIA', 'PEATONAL', '1004', '8164.0'),
  ('PORTALEGRE', 'PEATONAL', '1006', NULL),
  ('SAN NICOLAS', 'PEATONAL', '1002', '4583.0'),
  ('LUBECK', 'PEATONAL', '1020', '1019.0'),
  ('PORTAL PLAZA', 'PEATONAL', '1025', '4583.0'),
  ('DANUBIOS', 'VEHICULAR', '1026', NULL),
  ('ALBORADA', 'PEATONAL', '1028', '1985.0'),
  ('PATIO BONITO', 'PEATONAL', '1030', NULL),
  ('TERRAZZINO', 'PEATONAL', '1032', NULL),
  ('APARTACASAS', 'PEATONAL', '1035', NULL),
  ('QUINTAS SANTA MARIA', 'PEATONAL', '1040', NULL),
  ('SENDEROS DE CALASANZ', 'PEATONAL', '1044', '4583.0'),
  ('ALTOS DEL ROSARIO', 'PEATONAL', '1037', NULL)
) AS t(site_name, loc, num, code)
JOIN public.sites s ON UPPER(s.name) = UPPER(t.site_name)
  AND s.tenant_id = 'a0000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;
