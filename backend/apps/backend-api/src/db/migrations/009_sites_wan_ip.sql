-- Migration 009: Add wan_ip to sites for remote device access
-- Each site is accessed remotely via its public (WAN) IP address.
-- Devices behind the router are reached via WAN_IP:mapped_port.

-- 1. Add wan_ip column to sites
ALTER TABLE sites ADD COLUMN IF NOT EXISTS wan_ip TEXT;

-- 2. Populate wan_ip from existing network_wan device entries
UPDATE sites s
SET wan_ip = d.ip_address
FROM devices d
WHERE d.site_id = s.id
  AND d.type = 'network_wan'
  AND d.ip_address IS NOT NULL
  AND d.ip_address != ''
  AND s.wan_ip IS NULL;
