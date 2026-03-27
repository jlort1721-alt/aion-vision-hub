-- ============================================================
-- AION — Seed: network_devices (113 devices across 22 sites)
-- Transformed for multi-tenant schema with tenant_id
-- SECURITY: Credentials stored temporarily in notes field
--   marked NEEDS_ENCRYPTION — must be migrated to
--   username_encrypted / password_encrypted via pgcrypto
-- Generated: 2026-03-27
-- ============================================================

-- tenant_id for Clave Seguridad CTA
\set tenant_id 'a0000000-0000-0000-0000-000000000001'

INSERT INTO public.network_devices
  (site_id, tenant_id, device_name, device_type, lan_ip, port, is_online, notes)
SELECT
  (SELECT id FROM public.sites WHERE name = t.site_name LIMIT 1),
  'a0000000-0000-0000-0000-000000000001'::uuid,
  t.device_name,
  t.device_type,
  t.lan_ip,
  t.port,
  false,
  t.notes
FROM (VALUES
  -- ── TORRE LUCIA ─────────────────────────────────────────────
  ('TORRE LUCIA', 'Red LAN - Linksys', 'lan', '192.168.20.1', 8080,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: false'),
  ('TORRE LUCIA', 'Router Ppal - Linksys', 'router', '192.168.20.1', 8080,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('TORRE LUCIA', 'NVR', 'nvr', '192.168.20.210', 8010,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('TORRE LUCIA', 'DVR', 'dvr', '192.168.20.220', 8020,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('TORRE LUCIA', 'Control Principal', 'access_control', '192.168.20.150', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('TORRE LUCIA', 'Control', 'access_control', '192.168.20.58', 8060,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('TORRE LUCIA', 'Control', 'access_control', '192.168.20.59', 8081,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),

  -- ── SAN NICOLAS ─────────────────────────────────────────────
  ('SAN NICOLAS', 'Red LAN', 'lan', '192.168.20.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: false'),
  ('SAN NICOLAS', 'DVR', 'dvr', '192.168.20.15', 8060,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('SAN NICOLAS', 'NVR', 'nvr', '192.168.20.99', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('SAN NICOLAS', 'Control de acceso', 'access_control', '192.168.20.26', 8050,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('SAN NICOLAS', 'Cámara Placas', 'camera', '192.168.20.222', 8081,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),

  -- ── ALBORADA ────────────────────────────────────────────────
  ('ALBORADA', 'Red LAN', 'lan', '192.168.0.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('ALBORADA', 'Router Ppal', 'router', '192.168.0.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('ALBORADA', 'XVR Clave', 'dvr', '192.168.0.194', NULL,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('ALBORADA', 'Control Ppal', 'access_control', '192.168.0.199', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),

  -- ── BRESCIA ─────────────────────────────────────────────────
  ('BRESCIA', 'Red LAN', 'lan', '192.168.20.1', 80,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('BRESCIA', 'Router Ppal - Linksys', 'router', '192.168.20.1', 8080,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('BRESCIA', 'XVR', 'dvr', '192.168.20.114', 37777,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('BRESCIA', 'Control de acceso', 'access_control', '192.168.20.16', 8050,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('BRESCIA', 'Placas N1', 'device', '192.168.20.22', 8030,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),
  ('BRESCIA', 'Placas Sotano', 'device', '192.168.20.23', 8020,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),
  ('BRESCIA', 'Ascensor', 'elevator', '192.168.20.36', 8040,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),

  -- ── PATIO BONITO ────────────────────────────────────────────
  ('PATIO BONITO', 'Red LAN', 'lan', '192.168.0.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('PATIO BONITO', 'Router Ppal', 'router', '192.168.0.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('PATIO BONITO', 'XVR Clave', 'dvr', '192.168.0.195', NULL,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('PATIO BONITO', 'Control Ppal', 'access_control', '192.168.0.199', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('PATIO BONITO', 'Control Sotano', 'access_control', '192.168.0.101', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('PATIO BONITO', 'Cámara Placas', 'camera', '192.168.0.99', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),

  -- ── PISQUINES ───────────────────────────────────────────────
  ('PISQUINES', 'Red LAN', 'lan', '192.168.1.1', 8080,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('PISQUINES', 'Router Ppal - Linksys', 'router', '192.168.1.1', 8080,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('PISQUINES', 'DVR', 'dvr', '192.168.1.108', 8020,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('PISQUINES', 'NVR', 'nvr', '192.168.1.155', 8010,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('PISQUINES', 'Control de acceso', 'access_control', '192.168.1.177', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('PISQUINES', 'Cam. ZC Bl A', 'camera', '192.168.1.157', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),
  ('PISQUINES', 'Cam. Ext. Bl A.', 'camera', '192.168.1.159', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),

  -- ── SAN SEBASTIAN ───────────────────────────────────────────
  ('SAN SEBASTIAN', 'Red LAN', 'lan', '192.168.20.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('SAN SEBASTIAN', 'Router Ppal - Linksys', 'router', '192.168.20.1', 8080,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('SAN SEBASTIAN', 'DVR', 'dvr', '192.168.20.14', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('SAN SEBASTIAN', 'Control de acceso', 'access_control', '192.168.20.120', 8080,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('SAN SEBASTIAN', 'Cam Escalas Sotano', 'camera', '192.168.20.32', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),
  ('SAN SEBASTIAN', 'Cam Peatonal', 'camera', '192.168.20.33', 8080,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),

  -- ── TERRABAMBA ──────────────────────────────────────────────
  ('TERRABAMBA', 'Red LAN', 'lan', '192.168.0.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('TERRABAMBA', 'Router Ppal', 'router', '192.168.0.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('TERRABAMBA', 'XVR Clave', 'dvr', '192.168.0.195', NULL,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),

  -- ── SENDEROS DE CALASANZ ────────────────────────────────────
  ('SENDEROS DE CALASANZ', 'Red LAN', 'lan', '192.168.1.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('SENDEROS DE CALASANZ', 'Router Ppal', 'router', '192.168.1.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('SENDEROS DE CALASANZ', 'DVR', 'dvr', '192.168.0.223', NULL,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),

  -- ── ALTOS DEL ROSARIO ───────────────────────────────────────
  ('ALTOS DEL ROSARIO', 'Red LAN', 'lan', '192.168.0.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('ALTOS DEL ROSARIO', 'Router Ppal', 'router', '192.168.0.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('ALTOS DEL ROSARIO', 'DVR', 'dvr', '192.168.0.50', NULL,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),

  -- ── DANUBIOS ────────────────────────────────────────────────
  ('DANUBIOS', 'Red LAN', 'lan', '192.168.20.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: false'),
  ('DANUBIOS', 'Router Ppal', 'router', '192.168.20.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('DANUBIOS', 'XVR Puesto', 'dvr', '192.168.20.121', 37777,
   'NEEDS_ENCRYPTION | usr: CLAVE | pwd: Clave.seg2023 | sensitive: true'),
  ('DANUBIOS', 'XVR Clave', 'dvr', '192.168.20.120', 8020,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('DANUBIOS', 'Control Ppal', 'access_control', '192.168.20.6', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('DANUBIOS', 'Control T1', 'access_control', '192.168.20.8', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('DANUBIOS', 'Control T2', 'access_control', '192.168.20.4', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),

  -- ── TERRAZZINO ──────────────────────────────────────────────
  ('TERRAZZINO', 'Red LAN', 'lan', '192.168.0.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: false'),
  ('TERRAZZINO', 'Router Ppal', 'router', '192.168.20.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('TERRAZZINO', 'XVR Clave', 'dvr', '192.168.20.120', 8020,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('TERRAZZINO', 'Control Ppal', 'access_control', '192.168.20.6', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),

  -- ── PORTAL PLAZA ────────────────────────────────────────────
  ('PORTAL PLAZA', 'Red LAN', 'lan', '192.168.2.1', 8090,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('PORTAL PLAZA', 'XVR Puesto', 'dvr', '192.168.2.16', 37777,
   'NEEDS_ENCRYPTION | usr: CLAVE | pwd: Clave.seg2023 | sensitive: true'),
  ('PORTAL PLAZA', 'NVR Clave', 'nvr', '192.168.2.40', 8020,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('PORTAL PLAZA', 'Control de acceso', 'access_control', '192.168.2.13', 8081,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('PORTAL PLAZA', 'Cam. Entr. Parq.', 'camera', '192.168.2.41', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),
  ('PORTAL PLAZA', 'Cam. Entr. Ascensor', 'camera', '192.168.2.42', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),

  -- ── PORTALEGRE ──────────────────────────────────────────────
  ('PORTALEGRE', 'Red LAN', 'lan', '192.168.20.1', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('PORTALEGRE', 'Router Ppal - Linksys', 'router', '192.168.20.1', 8080,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('PORTALEGRE', 'DVR Puesto', 'dvr', '192.168.20.95', 8040,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('PORTALEGRE', 'NVR Clave', 'nvr', '192.168.20.100', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('PORTALEGRE', 'Control Ppal', 'access_control', '192.168.20.244', 8010,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('PORTALEGRE', 'CAM Sotano A', 'camera', '192.168.20.50', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),
  ('PORTALEGRE', 'CAM Sotano B', 'camera', '192.168.20.52', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),
  ('PORTALEGRE', 'CAM Parq. A', 'camera', '192.168.20.56', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),

  -- ── ALTAGRACIA ──────────────────────────────────────────────
  ('ALTAGRACIA', 'Red LAN', 'lan', '192.168.1.1', 8080,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false | NOTE: original IP had " - Linksys" appended'),
  ('ALTAGRACIA', 'Router Ppal - Linksys', 'router', '192.168.1.1', 8080,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('ALTAGRACIA', 'DVR', 'dvr', '192.168.1.238', 8030,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('ALTAGRACIA', 'Control de Acceso', 'access_control', '192.168.1.42', 8050,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('ALTAGRACIA', 'Cam. Calle Sur', 'camera', '192.168.1.22', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),
  ('ALTAGRACIA', 'Cam. Ingreso', 'camera', '192.168.1.23', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),

  -- ── LUBECK ──────────────────────────────────────────────────
  ('LUBECK', 'Red LAN', 'lan', '192.168.1.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('LUBECK', 'Router Ppal', 'router', '192.168.1.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('LUBECK', 'XVR Clave', 'dvr', '192.168.1.125', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),

  -- ── QUINTAS SANTA MARIA ─────────────────────────────────────
  ('QUINTAS SANTA MARIA', 'Red LAN', 'lan', '192.168.100.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('QUINTAS SANTA MARIA', 'Router Ppal', 'router', '192.168.100.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('QUINTAS SANTA MARIA', 'XVR Clave', 'dvr', '192168100.19', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true | NOTE: original IP may be malformed (192168100.19)'),

  -- ── HOSPITAL SAN JERONIMO ──────────────────────────────────
  ('HOSPITAL SAN JERONIMO', 'Red LAN', 'lan', '192.168.20.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: false'),
  ('HOSPITAL SAN JERONIMO', 'Router Ppal', 'router', '192.168.20.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Seg12345 | sensitive: true'),
  ('HOSPITAL SAN JERONIMO', 'XVR Clave', 'dvr', '192.168.20.8', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),

  -- ── MONITOREO CENTRAL (batch 1 - original network) ─────────
  ('MONITOREO CENTRAL', 'Red LAN', 'lan', '192.168.7.1', NULL,
   'No credentials | sensitive: false'),
  ('MONITOREO CENTRAL', 'AP', 'router', NULL, NULL,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true | NOTE: original had IP=admin, port=seg12345 — likely data entry error'),
  ('MONITOREO CENTRAL', 'XVR Puesto', 'dvr', NULL, 37777,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true | NOTE: no IP in source'),

  -- ── MANZANARES ──────────────────────────────────────────────
  ('MANZANARES', 'Red LAN', 'lan', '192.168.0.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: false'),
  ('MANZANARES', 'Router Ppal', 'router', '192.168.0.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('MANZANARES', 'DVR Puesto', 'dvr', '192.168.0.101', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('MANZANARES', 'XVR Clave', 'dvr', '192.168.0.108', 37777,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),

  -- ── HOSPITAL LA PALENCIA ────────────────────────────────────
  ('HOSPITAL LA PALENCIA', 'Red LAN', 'lan', '192.168.1.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: false'),
  ('HOSPITAL LA PALENCIA', 'DVR', 'dvr', '192.168.1.105', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: true'),
  ('HOSPITAL LA PALENCIA', 'Cámara', 'camera', '192.168.1.5', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),
  ('HOSPITAL LA PALENCIA', 'Cámara', 'camera', '192.168.1.8', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),
  ('HOSPITAL LA PALENCIA', 'Cámara', 'camera', '192.168.1.9', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),
  ('HOSPITAL LA PALENCIA', 'Cámara', 'camera', '192.168.1.26', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2023 | sensitive: false'),

  -- ── MONITOREO CENTRAL (batch 2 - MikroTik network) ─────────
  ('MONITOREO CENTRAL', 'Red LAN', 'lan', '192.168.88.1', NULL,
   'No credentials | sensitive: false'),
  ('MONITOREO CENTRAL', 'Router Ppal - MIKROTIK', 'router', '192.168.88.1', 443,
   'NEEDS_ENCRYPTION | usr: admin | pwd: Clave.seg2024 | sensitive: true'),
  ('MONITOREO CENTRAL', 'Equipo Servidor', 'computer', '192.168.88.242', NULL,
   'NEEDS_ENCRYPTION | usr: CLAVE | pwd: 2024 | sensitive: true'),
  ('MONITOREO CENTRAL', 'Equipo Clon', 'computer', '192.168.88.253', NULL,
   'NEEDS_ENCRYPTION | usr: CLAVE | pwd: 2024 | sensitive: true'),
  ('MONITOREO CENTRAL', 'PC', 'computer', '192.168.88.252', NULL,
   'NEEDS_ENCRYPTION | usr: CLAVE | pwd: 2024 | sensitive: true'),
  ('MONITOREO CENTRAL', 'Portatil Apoyo', 'router', '192.168.88.247', NULL,
   'NEEDS_ENCRYPTION | usr: CLAVE | pwd: 2024 | sensitive: true'),
  ('MONITOREO CENTRAL', 'Cisco', 'voip', '192.168.88.12', NULL,
   'No credentials | sensitive: false'),
  ('MONITOREO CENTRAL', 'Control de Acceso', 'access_control', '192.168.88.13', 8000,
   'NEEDS_ENCRYPTION | usr: admin | pwd: seg12345 | sensitive: true'),
  ('MONITOREO CENTRAL', 'Planta IP', 'lan', '181.205.188.98', 8090,
   'NEEDS_ENCRYPTION | usr: clave | pwd: Clave.seg2024 | sensitive: false')

) AS t(site_name, device_name, device_type, lan_ip, port, notes)
WHERE (SELECT id FROM public.sites WHERE name = t.site_name LIMIT 1) IS NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- Post-import: count inserted devices
-- ═══════════════════════════════════════════════════════════
-- SELECT device_type, COUNT(*) FROM public.network_devices
-- WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
-- GROUP BY device_type ORDER BY count DESC;
