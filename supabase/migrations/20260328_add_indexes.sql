-- Core table indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_tenant ON devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_tenant_site ON devices(tenant_id, site_id);
CREATE INDEX IF NOT EXISTS idx_devices_tenant_status ON devices(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_tenant_type ON devices(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_devices_device_slug ON devices(device_slug);

CREATE INDEX IF NOT EXISTS idx_events_tenant_created ON events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant_severity ON events(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_events_tenant_status ON events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_events_tenant_device ON events(tenant_id, device_id);

CREATE INDEX IF NOT EXISTS idx_sites_tenant ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites(slug);

CREATE INDEX IF NOT EXISTS idx_incidents_tenant ON incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant_status ON incidents(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_access_people_tenant ON access_people(tenant_id);
CREATE INDEX IF NOT EXISTS idx_access_people_name ON access_people(tenant_id, full_name);
CREATE INDEX IF NOT EXISTS idx_access_vehicles_tenant ON access_vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_access_vehicles_plate ON access_vehicles(plate);

CREATE INDEX IF NOT EXISTS idx_streams_device ON streams(device_id);
CREATE INDEX IF NOT EXISTS idx_streams_tenant ON streams(tenant_id);
