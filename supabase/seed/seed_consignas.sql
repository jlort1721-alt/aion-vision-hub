-- ═══════════════════════════════════════════════════════════
-- AION — Multi-tenant Seed Data
-- Tenant: a0000000-0000-0000-0000-000000000001
-- Auto-generated from 04_seed_vehicles_access.sql
-- ═══════════════════════════════════════════════════════════

-- ── Consignas (6 records from Lubeck) ─────────────────────
INSERT INTO public.consignas (tenant_id, site_id, unit_number, instruction, authorized_by, authorized_date, is_active, notes)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  s.id,
  t.unit,
  t.instr,
  t.auth,
  t.auth_date::DATE,
  true,
  t.obs
FROM (VALUES
  ('LUBECK', '201', 'ADRIANA URIBE VILLA', 'CEL: 3113611820', '2025-11-14', 'ES LA NUEVA DUEÑA'),
  ('LUBECK', '201', 'DIEGO URIBE ENCARGADO DEL APTO', 'TEL:3108407944', NULL, 'LLAMAR EN CASO DE ALGUNA NOVEDAD CON EL APARTAMENTO AL SEÑOR DIEGO'),
  ('LUBECK', '301', 'GUSTAVO CARDONA AUTORIZADO PARA HACER UNA REMODELACIONES', 'GUSTAVO Y ADMI MONICA FERNANDEZ', '2025-08-23', 'EL SEÑOR GUSTAVO CARDONA YA ES EL DUEÑO DEL APT'),
  ('LUBECK', '301', 'CAMILO RODRIGEZ', 'HERMANO DE LA DUEÑA', '2025-10-16', 'ESTA AUTORIZADO PARA INGRESAR Y GUARDAR EL VEHICULO'),
  ('LUBECK', '601', 'ALEJANDRA', 'RESIDENTE /MARCELA PARRA AUT', NULL, 'ES LA MAMA DE MAX EL PERRO'),
  ('LUBECK', '202', 'NATALIA ANDREA HIGUITA', NULL, NULL, 'LIMPIO Y BRILLANTYE')
) AS t(site_name, unit, instr, auth, auth_date, obs)
JOIN public.sites s ON UPPER(s.name) = UPPER(t.site_name)
  AND s.tenant_id = 'a0000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;
