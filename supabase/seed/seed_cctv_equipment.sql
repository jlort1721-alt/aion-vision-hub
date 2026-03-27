-- ============================================================
-- AION — Seed: cctv_equipment (44 records across 17+ sites)
-- Transformed for multi-tenant schema with tenant_id
-- Generated: 2026-03-27
-- ============================================================

INSERT INTO public.cctv_equipment
  (site_id, tenant_id, equipment_type, quantity, description, camera_names)
SELECT
  (SELECT id FROM public.sites WHERE name = t.site_name LIMIT 1),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  t.equipment_type,
  t.quantity,
  t.description,
  t.camera_names
FROM (VALUES

  -- ── TORRE LUCIA ─────────────────────────────────────────────
  ('TORRE LUCIA', 'nvr', 1, 'NVR 17 cámaras - 7 en visual',
   ARRAY['Salida Vehicular 2','Gimnasio','Vehicular 1','Entrada Jacuzzi','Sal. Terraza Norte','Sal. Terraza Sur','Sal. Parq 1']),
  ('TORRE LUCIA', 'dvr', 1, 'DVR 8 cámaras - 6 en uso',
   ARRAY['Peatonal','Acc. Veh 2','Sal. Veh 2','Ascensor Torre Lucia','Parqueadero Visitantes','Sal. Parq 1']),
  ('TORRE LUCIA', 'intercom', 3, '3 citófonos: Peatonal, Veh 1, Veh 2', ARRAY[]::TEXT[]),
  ('TORRE LUCIA', 'access_control', 5, '5 lectores biométricos/dactilares',
   ARRAY['Ingreso principal','Terraza Sur','Terraza Norte','Jacuzzi','Gimnasio']),
  ('TORRE LUCIA', 'vehicle_reader', 2, 'Lector sticker vehículos - Vehicular 1 y 2', ARRAY[]::TEXT[]),
  ('TORRE LUCIA', 'siren', 2, '2 sirenas activadas desde CCTV', ARRAY['Sirena 1','Sirena 2']),

  -- ── SAN NICOLAS ─────────────────────────────────────────────
  ('SAN NICOLAS', 'dvr', 1, 'DVR 16 cámaras - todas en uso',
   ARRAY['Lote 20','Lote 19','Lote 12','Lote 08-29','Lote 05','Lote 15',
         'Cámara 01 Sal.Vehicular','Parqueadero','Lote 06','Glorieta','Rural','Portería']),
  ('SAN NICOLAS', 'nvr', 1, 'NVR cámaras adicionales', ARRAY[]::TEXT[]),
  ('SAN NICOLAS', 'access_control', 1, 'Control de acceso lector de placas', ARRAY[]::TEXT[]),

  -- ── ALBORADA ────────────────────────────────────────────────
  ('ALBORADA', 'xvr', 1, 'XVR Clave', ARRAY[]::TEXT[]),
  ('ALBORADA', 'access_control', 1, 'Control acceso principal', ARRAY[]::TEXT[]),

  -- ── BRESCIA ─────────────────────────────────────────────────
  ('BRESCIA', 'xvr', 1, 'XVR Brescia con cámaras internas', ARRAY[]::TEXT[]),
  ('BRESCIA', 'access_control', 1, 'Control acceso peatonal e IVMS', ARRAY['AC BRESCIA']),
  ('BRESCIA', 'camera', 2, 'Cámaras de placas N1 y Sótano', ARRAY['Placas N1','Placas Sótano']),
  ('BRESCIA', 'elevator', 1, 'Control ascensor', ARRAY[]::TEXT[]),
  ('BRESCIA', 'intercom', 1, 'Citófono peatonal', ARRAY[]::TEXT[]),

  -- ── PATIO BONITO ────────────────────────────────────────────
  ('PATIO BONITO', 'xvr', 1, 'XVR cámeras principales', ARRAY[]::TEXT[]),
  ('PATIO BONITO', 'access_control', 2, 'Control principal y sótano',
   ARRAY['Control Principal','Control Sótano']),
  ('PATIO BONITO', 'camera', 1, 'Cámara de placas', ARRAY['Cámara Placas']),
  ('PATIO BONITO', 'intercom', 1, 'Citófono extensión 1031', ARRAY[]::TEXT[]),

  -- ── PISQUINES ───────────────────────────────────────────────
  ('PISQUINES', 'dvr', 1, 'DVR cámaras', ARRAY[]::TEXT[]),
  ('PISQUINES', 'nvr', 1, 'NVR cámaras adicionales', ARRAY[]::TEXT[]),
  ('PISQUINES', 'access_control', 1, 'Control de acceso', ARRAY[]::TEXT[]),
  ('PISQUINES', 'camera', 2, 'Cámaras ZC Bloque A ext/int',
   ARRAY['Cam ZC Bl A','Cam Ext Bl A']),

  -- ── SAN SEBASTIAN ───────────────────────────────────────────
  ('SAN SEBASTIAN', 'dvr', 1, 'DVR cámaras', ARRAY[]::TEXT[]),
  ('SAN SEBASTIAN', 'access_control', 1, 'Control acceso', ARRAY['AC SAN SEBASTIAN']),
  ('SAN SEBASTIAN', 'camera', 2, 'Cámaras escaleras sótano y peatonal',
   ARRAY['Cam Escalas Sótano','Cam Peatonal']),

  -- ── DANUBIOS ────────────────────────────────────────────────
  ('DANUBIOS', 'xvr', 2, 'XVR Puesto + XVR Clave', ARRAY[]::TEXT[]),
  ('DANUBIOS', 'access_control', 3, 'Control Principal, Torre 1, Torre 2',
   ARRAY['Control Principal','Control T1','Control T2']),

  -- ── TERRAZZINO ──────────────────────────────────────────────
  ('TERRAZZINO', 'xvr', 1, 'XVR Clave Terrazzino', ARRAY[]::TEXT[]),
  ('TERRAZZINO', 'access_control', 1, 'Control acceso principal', ARRAY[]::TEXT[]),

  -- ── PORTAL PLAZA ────────────────────────────────────────────
  ('PORTAL PLAZA', 'xvr', 1, 'XVR Puesto Portal Plaza', ARRAY[]::TEXT[]),
  ('PORTAL PLAZA', 'nvr', 1, 'NVR Clave Portal Plaza', ARRAY[]::TEXT[]),
  ('PORTAL PLAZA', 'access_control', 1, 'Control de acceso', ARRAY[]::TEXT[]),
  ('PORTAL PLAZA', 'camera', 2, 'Cámaras entrada parqueadero y ascensor',
   ARRAY['Cam Entr Parq','Cam Entr Ascensor']),

  -- ── PORTALEGRE ──────────────────────────────────────────────
  ('PORTALEGRE', 'dvr', 1, 'DVR Puesto Portalegre', ARRAY[]::TEXT[]),
  ('PORTALEGRE', 'nvr', 1, 'NVR Clave Portalegre', ARRAY[]::TEXT[]),
  ('PORTALEGRE', 'access_control', 1, 'Control acceso principal', ARRAY[]::TEXT[]),
  ('PORTALEGRE', 'camera', 3, 'Cámaras sótano y parqueadero',
   ARRAY['CAM Sótano A','CAM Sótano B','CAM Parq A']),

  -- ── ALTAGRACIA ──────────────────────────────────────────────
  ('ALTAGRACIA', 'dvr', 1, 'DVR Altagracia', ARRAY[]::TEXT[]),
  ('ALTAGRACIA', 'access_control', 1, 'Control de acceso', ARRAY[]::TEXT[]),
  ('ALTAGRACIA', 'camera', 2, 'Cámaras calle sur e ingreso',
   ARRAY['Cam Calle Sur','Cam Ingreso']),

  -- ── LUBECK ──────────────────────────────────────────────────
  ('LUBECK', 'xvr', 1, 'XVR Clave Lubeck', ARRAY[]::TEXT[]),

  -- ── QUINTAS SANTA MARIA ─────────────────────────────────────
  ('QUINTAS SANTA MARIA', 'xvr', 1, 'XVR Clave Quintas', ARRAY[]::TEXT[]),

  -- ── HOSPITAL LA PALENCIA ────────────────────────────────────
  ('HOSPITAL LA PALENCIA', 'dvr', 1, 'DVR La Palencia', ARRAY[]::TEXT[]),
  ('HOSPITAL LA PALENCIA', 'camera', 4, '4 Cámaras IP',
   ARRAY['Cámara 1','Cámara 2','Cámara 3','Cámara 4']),

  -- ── MONITOREO CENTRAL ───────────────────────────────────────
  ('MONITOREO CENTRAL', 'computer', 3, 'Servidor, Clon, PC monitoreo',
   ARRAY['Equipo Servidor','Equipo Clon','PC']),
  ('MONITOREO CENTRAL', 'router', 1, 'MikroTik router principal', ARRAY[]::TEXT[]),
  ('MONITOREO CENTRAL', 'access_control', 1, 'Control acceso sala monitoreo', ARRAY[]::TEXT[]),
  ('MONITOREO CENTRAL', 'voip', 1, 'Planta IP Cisco', ARRAY[]::TEXT[])

) AS t(site_name, equipment_type, quantity, description, camera_names)
WHERE (SELECT id FROM public.sites WHERE name = t.site_name LIMIT 1) IS NOT NULL
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- Post-import: count inserted records
-- ═══════════════════════════════════════════════════════════
-- SELECT equipment_type, SUM(quantity) FROM public.cctv_equipment
-- WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
-- GROUP BY equipment_type ORDER BY sum DESC;
