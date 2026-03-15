-- ═══════════════════════════════════════════════════════════
-- AION Vision Hub — Create 22 Monitoring Sites
-- Run in: Supabase Dashboard > SQL Editor
-- Tenant: AION Main (a0000000-0000-0000-0000-000000000001)
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  v_tenant_id uuid := 'a0000000-0000-0000-0000-000000000001';
BEGIN
  -- Ensure tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
    INSERT INTO public.tenants (id, name, slug, timezone, settings)
    VALUES (v_tenant_id, 'AION Seguridad', 'aion-main', 'America/Bogota',
            '{"language": "es", "theme": "dark"}'::jsonb);
    RAISE NOTICE 'Tenant AION Seguridad created';
  END IF;

  -- ── 1. TORRE LUCIA ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Torre Lucia', 'Calle 75 Sur #34-280, Sabaneta, Antioquia', 6.1517, -75.6160, 'America/Bogota', 'active');

  -- ── 2. SAN NICOLAS ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'San Nicolás', 'Cl. 35 #58-10, Rionegro, Antioquia', 6.1474, -75.3733, 'America/Bogota', 'active');

  -- ── 3. ALBORADA 9-10 ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Alborada 9-10', 'Dg 93 #39-60, Santa Mónica, Campo Alegre, Medellín', 6.2870, -75.5900, 'America/Bogota', 'active');

  -- ── 4. BRESCIA ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Brescia', 'Calle 47 #19 Sur 40, Envigado, Antioquia', 6.1680, -75.5890, 'America/Bogota', 'active');

  -- ── 5. PATIO BONITO ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Patio Bonito', 'Tv. 5a #45-163, El Poblado, Medellín', 6.2070, -75.5650, 'America/Bogota', 'active');

  -- ── 6. CONJUNTO MULTIFAMILIAR LOS PISQUINES P.H. ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Los Pisquines P.H.', 'CR 43 #23-29, Medellín, Antioquia', 6.2380, -75.5730, 'America/Bogota', 'active');

  -- ── 7. SAN SEBASTIAN ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'San Sebastián', 'Carrera 79 #34-26, Laureles, Medellín', 6.2450, -75.6050, 'America/Bogota', 'active');

  -- ── 8. PROPIEDAD TERRABAMBA ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Propiedad Terrabamba', 'Entrada al Gaitero - Restaurante El Camionero, Vía MDE - Santa Fe de Antioquia', 6.3900, -75.7700, 'America/Bogota', 'active');

  -- ── 9. SENDEROS DE CALASANZ ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Senderos de Calasanz', 'Cra 81A #49-89, Calasanz, La América, Medellín', 6.2570, -75.6120, 'America/Bogota', 'active');

  -- ── 10. ALTOS DEL ROSARIO ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Altos del Rosario', 'Cra. 84 #34b-110, Simón Bolívar, Laureles, Medellín', 6.2490, -75.6130, 'America/Bogota', 'active');

  -- ── 11. DANUBIOS ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Danubios', 'Cl. 47D #72-183, Laureles - Estadio, Medellín', 6.2520, -75.5980, 'America/Bogota', 'active');

  -- ── 12. TERRAZINO ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Terrazino', 'Cl. 22a Sur #46-34, Zona 2, Envigado, Antioquia', 6.1680, -75.5810, 'America/Bogota', 'active');

  -- ── 13. PORTAL PLAZA ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Portal Plaza', 'Cra. 39 #48-11, La Candelaria, Medellín, Antioquia', 6.2510, -75.5660, 'America/Bogota', 'active');

  -- ── 14. PORTALEGRE ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Portalegre', 'Cl 45F #70A-75, Laureles - Estadio, Medellín, Antioquia', 6.2500, -75.5950, 'America/Bogota', 'active');

  -- ── 15. ALTAGRACIA ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Altagracia', 'Carrera 39 #48-19, Medellín, Antioquia', 6.2510, -75.5660, 'America/Bogota', 'active');

  -- ── 16. LUBECK ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Lubeck', 'Calle 36 #64A-29, Laureles - Estadio, Medellín', 6.2460, -75.5960, 'America/Bogota', 'active');

  -- ── 17. APARTA CASAS ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Aparta Casas', 'Carrera 53B #84A-03, Itagüí, Antioquia', 6.1740, -75.6010, 'America/Bogota', 'active');

  -- ── 18. QUINTAS DE SANTA MARIA ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Quintas de Santa María', 'Cra. 10, San Jerónimo, Antioquia', 6.4430, -75.7270, 'America/Bogota', 'active');

  -- ── 19. HOSPITAL SAN JERONIMO ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Hospital San Jerónimo', 'San Jerónimo de Antioquia', 6.4400, -75.7250, 'America/Bogota', 'active');

  -- ── 20. HOTEL EUTOPIQ / FACTORY / SMACH / BBC BODEGA ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Hotel Eutopiq / Factory / Smach / BBC Bodega La 33', 'Carrera 69 #Circular 1-32, Laureles, Medellín (frente a la UPB)', 6.2490, -75.5920, 'America/Bogota', 'active');

  -- ── 21. SANTA ANA DE LOS CABALLEROS ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Santa Ana de los Caballeros', 'Transversal 74 #2-15, Medellín', 6.2350, -75.6040, 'America/Bogota', 'active');

  -- ── 22. EDIFICIO LA PALENCIA P.H. ──
  INSERT INTO public.sites (tenant_id, name, address, latitude, longitude, timezone, status)
  VALUES (v_tenant_id, 'Edificio La Palencia P.H.', 'CR46 #50-28, Medellín, Antioquia', 6.2530, -75.5700, 'America/Bogota', 'active');

  RAISE NOTICE 'DONE — 22 monitoring sites created successfully';
END $$;

-- Verify
SELECT id, name, address, status FROM public.sites ORDER BY name;
