-- Migration 020: Twilio Communication Logs & Notification Rules
-- Tracks all Twilio-mediated communications (WhatsApp, SMS, Voice)

CREATE TABLE IF NOT EXISTS communication_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel VARCHAR(30) NOT NULL,          -- whatsapp, sms, voice_call, emergency_call, whatsapp_template
  direction VARCHAR(10) NOT NULL DEFAULT 'outbound', -- inbound, outbound
  recipient VARCHAR(30),
  sender VARCHAR(30),
  content TEXT,
  twilio_sid VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  error_message TEXT,
  cost_estimate DECIMAL(10,4),
  duration_seconds INT,
  recording_url TEXT,
  metadata JSONB,
  site_id UUID,
  site_name VARCHAR(100),
  operator VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_comm_logs_tenant_created ON communication_logs(tenant_id, created_at DESC);
CREATE INDEX idx_comm_logs_channel ON communication_logs(tenant_id, channel);
CREATE INDEX idx_comm_logs_status ON communication_logs(tenant_id, status);
CREATE INDEX idx_comm_logs_recipient ON communication_logs(recipient);
CREATE INDEX idx_comm_logs_twilio_sid ON communication_logs(twilio_sid);

-- ── Notification Rules ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS twilio_notification_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  recipient_type VARCHAR(30),
  recipient_override VARCHAR(30),
  message_template TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  cooldown_minutes INT DEFAULT 60 NOT NULL,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_notif_rules_tenant ON twilio_notification_rules(tenant_id);
CREATE INDEX idx_notif_rules_event ON twilio_notification_rules(tenant_id, event_type);

-- ── Default notification rules ──────────────────────────────

-- NOTE: These require a valid tenant_id. Run after tenant creation.
-- INSERT INTO twilio_notification_rules (tenant_id, name, event_type, channel, recipient_type, message_template) VALUES
-- ('<TENANT_UUID>', 'Cámara offline', 'camera_offline', 'whatsapp', 'admin', '⚠️ AION: Cámara {camera_name} de {site_name} fuera de línea.'),
-- ('<TENANT_UUID>', 'Sirena fallida', 'siren_test_failed', 'whatsapp', 'coordinator', '🔴 AION: Sirena {siren_name} de {site_name} falló en prueba.'),
-- ('<TENANT_UUID>', 'Ticket pendiente 24h', 'ticket_pending_24h', 'whatsapp', 'supervisor', '⏰ AION: Ticket #{ticket_id} en {site_name} lleva +24h sin atención.'),
-- ('<TENANT_UUID>', 'Servicio pendiente 7d', 'service_pending_7d', 'whatsapp', 'technician', '⏰ AION: Servicio en {site_name} pendiente hace {days} días.'),
-- ('<TENANT_UUID>', 'Bienvenida residente', 'new_resident', 'whatsapp', 'resident', '¡Bienvenido/a {nombre}! Somos Clave Seguridad, monitoreo 24/7.'),
-- ('<TENANT_UUID>', 'Resumen diario', 'daily_report', 'whatsapp', 'supervisor', 'Resumen AION {date}: {cameras_offline} cámaras offline, {tickets_pending} tickets pendientes.'),
-- ('<TENANT_UUID>', 'Recordatorio sirenas', 'monthly_siren_reminder', 'whatsapp', 'operator', 'Recordatorio: Prueba de sirenas esta semana.');

-- ── Stats function ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_communication_stats(p_tenant_id UUID)
RETURNS JSON AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'total_messages', (SELECT count(*) FROM communication_logs WHERE tenant_id = p_tenant_id),
    'whatsapp_sent', (SELECT count(*) FROM communication_logs WHERE tenant_id = p_tenant_id AND channel = 'whatsapp' AND direction = 'outbound'),
    'whatsapp_received', (SELECT count(*) FROM communication_logs WHERE tenant_id = p_tenant_id AND channel = 'whatsapp' AND direction = 'inbound'),
    'calls_made', (SELECT count(*) FROM communication_logs WHERE tenant_id = p_tenant_id AND channel IN ('voice_call', 'emergency_call')),
    'sms_sent', (SELECT count(*) FROM communication_logs WHERE tenant_id = p_tenant_id AND channel = 'sms'),
    'failed', (SELECT count(*) FROM communication_logs WHERE tenant_id = p_tenant_id AND status = 'failed'),
    'total_cost_usd', (SELECT COALESCE(SUM(cost_estimate), 0) FROM communication_logs WHERE tenant_id = p_tenant_id),
    'today', (SELECT count(*) FROM communication_logs WHERE tenant_id = p_tenant_id AND created_at >= CURRENT_DATE),
    'this_month', (SELECT count(*) FROM communication_logs WHERE tenant_id = p_tenant_id AND created_at >= date_trunc('month', CURRENT_DATE))
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;
