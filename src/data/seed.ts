// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Seed Data for Development
// ═══════════════════════════════════════════════════════════

import { Device, DeviceEvent, Site, Incident, AuditLog, Integration, MCPConnector, SystemHealth } from '@/types';

export const SEED_SITES: Site[] = [
  { id: 'site-001', tenant_id: 'tenant-001', name: 'Sede Principal — Bogotá', address: 'Cra 7 #72-41, Bogotá', latitude: 4.6570, longitude: -74.0563, timezone: 'America/Bogota', status: 'healthy', created_at: '2024-01-15T08:00:00Z' },
  { id: 'site-002', tenant_id: 'tenant-001', name: 'Planta Industrial — Medellín', address: 'Cl 10 #43-12, Medellín', latitude: 6.2442, longitude: -75.5812, timezone: 'America/Bogota', status: 'healthy', created_at: '2024-02-01T08:00:00Z' },
  { id: 'site-003', tenant_id: 'tenant-001', name: 'Centro Logístico — Cali', address: 'Av 3N #25-60, Cali', latitude: 3.4516, longitude: -76.5320, timezone: 'America/Bogota', status: 'degraded', created_at: '2024-03-10T08:00:00Z' },
];

export const SEED_DEVICES: Device[] = [
  { id: 'dev-001', tenant_id: 'tenant-001', site_id: 'site-001', name: 'CAM-LOBBY-01', type: 'camera', brand: 'hikvision', model: 'DS-2CD2386G2-IU', ip_address: '192.168.1.101', port: 80, rtsp_port: 554, onvif_port: 80, status: 'online', channels: 1, firmware_version: 'V5.7.12', serial_number: 'DS-2CD2386G2-IU20210901AACH123456789', capabilities: { ptz: false, audio: true, smart_events: true, anpr: false, face_detection: true, line_crossing: true, intrusion_detection: true, people_counting: true, codecs: ['H.265', 'H.264'], max_resolution: '3840x2160', onvif_profiles: ['S', 'T'] }, tags: ['lobby', 'interior', '4K'], created_at: '2024-01-20T10:00:00Z', updated_at: '2024-12-01T10:00:00Z' },
  { id: 'dev-002', tenant_id: 'tenant-001', site_id: 'site-001', name: 'CAM-PARKING-01', type: 'camera', brand: 'dahua', model: 'IPC-HFW5442E-ZE', ip_address: '192.168.1.102', port: 80, rtsp_port: 554, onvif_port: 80, status: 'online', channels: 1, firmware_version: 'V2.820.0000003.0.R', serial_number: 'YJ04A8PAG000001', capabilities: { ptz: true, audio: true, smart_events: true, anpr: true, face_detection: false, line_crossing: true, intrusion_detection: true, people_counting: false, codecs: ['H.265', 'H.264'], max_resolution: '2688x1520', onvif_profiles: ['S', 'T'] }, tags: ['parking', 'exterior', 'anpr'], created_at: '2024-01-20T10:00:00Z', updated_at: '2024-12-01T10:00:00Z' },
  { id: 'dev-003', tenant_id: 'tenant-001', site_id: 'site-001', name: 'NVR-PRINCIPAL-01', type: 'nvr', brand: 'hikvision', model: 'DS-7732NXI-K4', ip_address: '192.168.1.10', port: 80, rtsp_port: 554, onvif_port: 80, status: 'online', channels: 32, firmware_version: 'V4.62.200', serial_number: 'DS-7732NXI-K420220101', capabilities: { ptz: false, audio: false, smart_events: true, anpr: false, face_detection: false, line_crossing: false, intrusion_detection: false, people_counting: false, codecs: ['H.265', 'H.264', 'H.265+'], max_resolution: '3840x2160', onvif_profiles: ['S'] }, tags: ['nvr', 'principal'], created_at: '2024-01-15T08:00:00Z', updated_at: '2024-12-01T10:00:00Z' },
  { id: 'dev-004', tenant_id: 'tenant-001', site_id: 'site-001', name: 'CAM-ENTRADA-01', type: 'camera', brand: 'hikvision', model: 'DS-2CD2T47G2-L', ip_address: '192.168.1.103', port: 80, rtsp_port: 554, onvif_port: 80, status: 'online', channels: 1, firmware_version: 'V5.7.11', capabilities: { ptz: false, audio: true, smart_events: true, anpr: false, face_detection: true, line_crossing: true, intrusion_detection: true, people_counting: true, codecs: ['H.265', 'H.264'], max_resolution: '2688x1520', onvif_profiles: ['S', 'T'] }, tags: ['entrada', 'colorvu'], created_at: '2024-02-01T08:00:00Z', updated_at: '2024-12-01T10:00:00Z' },
  { id: 'dev-005', tenant_id: 'tenant-001', site_id: 'site-002', name: 'CAM-ALMACEN-01', type: 'camera', brand: 'dahua', model: 'IPC-HDW3849H-AS-PV', ip_address: '192.168.2.101', port: 80, rtsp_port: 554, onvif_port: 80, status: 'online', channels: 1, firmware_version: 'V2.840.0000001.0.R', capabilities: { ptz: false, audio: true, smart_events: true, anpr: false, face_detection: false, line_crossing: true, intrusion_detection: true, people_counting: true, codecs: ['H.265', 'H.264'], max_resolution: '3840x2160', onvif_profiles: ['S', 'T', 'M'] }, tags: ['almacen', 'tioc'], created_at: '2024-03-01T08:00:00Z', updated_at: '2024-12-01T10:00:00Z' },
  { id: 'dev-006', tenant_id: 'tenant-001', site_id: 'site-002', name: 'CAM-PERIMETRO-01', type: 'camera', brand: 'hikvision', model: 'DS-2DE4425IW-DE', ip_address: '192.168.2.102', port: 80, rtsp_port: 554, onvif_port: 80, status: 'degraded', channels: 1, firmware_version: 'V5.5.82', capabilities: { ptz: true, audio: true, smart_events: true, anpr: false, face_detection: true, line_crossing: true, intrusion_detection: true, people_counting: false, codecs: ['H.265', 'H.264'], max_resolution: '2560x1440', onvif_profiles: ['S', 'T'] }, tags: ['perimetro', 'ptz', '25x'], created_at: '2024-03-01T08:00:00Z', updated_at: '2024-12-01T10:00:00Z' },
  { id: 'dev-007', tenant_id: 'tenant-001', site_id: 'site-003', name: 'CAM-DESPACHO-01', type: 'camera', brand: 'dahua', model: 'IPC-HFW2831E-S-S2', ip_address: '192.168.3.101', port: 80, rtsp_port: 554, onvif_port: 80, status: 'offline', channels: 1, firmware_version: 'V2.800.0000016.0.R', capabilities: { ptz: false, audio: false, smart_events: false, anpr: false, face_detection: false, line_crossing: false, intrusion_detection: false, people_counting: false, codecs: ['H.265', 'H.264'], max_resolution: '3840x2160', onvif_profiles: ['S'] }, tags: ['despacho', 'basica'], notes: 'Verificar cable de red — reportada desconexión frecuente', created_at: '2024-04-01T08:00:00Z', updated_at: '2024-12-01T10:00:00Z' },
  { id: 'dev-008', tenant_id: 'tenant-001', site_id: 'site-003', name: 'NVR-CALI-01', type: 'nvr', brand: 'dahua', model: 'DHI-NVR5216-16P-I', ip_address: '192.168.3.10', port: 80, rtsp_port: 554, onvif_port: 80, status: 'online', channels: 16, firmware_version: 'V4.003.0000001.0.R', capabilities: { ptz: false, audio: false, smart_events: true, anpr: false, face_detection: false, line_crossing: false, intrusion_detection: false, people_counting: false, codecs: ['H.265', 'H.264', 'Smart H.265'], max_resolution: '3840x2160', onvif_profiles: ['S'] }, tags: ['nvr', 'cali'], created_at: '2024-04-01T08:00:00Z', updated_at: '2024-12-01T10:00:00Z' },
];

export const SEED_EVENTS: DeviceEvent[] = [
  { id: 'evt-001', tenant_id: 'tenant-001', site_id: 'site-001', device_id: 'dev-001', channel: 1, event_type: 'intrusion_detection', severity: 'high', status: 'new', title: 'Intrusión detectada en zona restringida', description: 'Persona no autorizada detectada en área de servidores a las 03:42 AM', metadata: { zone: 'server_room', confidence: 0.94 }, created_at: '2024-12-01T08:42:00Z', updated_at: '2024-12-01T08:42:00Z' },
  { id: 'evt-002', tenant_id: 'tenant-001', site_id: 'site-001', device_id: 'dev-002', channel: 1, event_type: 'anpr', severity: 'info', status: 'resolved', title: 'Vehículo identificado — ABC-123', description: 'Placa reconocida en entrada del parqueadero', metadata: { plate: 'ABC-123', direction: 'entry', confidence: 0.98 }, created_at: '2024-12-01T07:15:00Z', updated_at: '2024-12-01T07:15:00Z' },
  { id: 'evt-003', tenant_id: 'tenant-001', site_id: 'site-003', device_id: 'dev-007', event_type: 'video_loss', severity: 'critical', status: 'new', title: 'Pérdida de video — CAM-DESPACHO-01', description: 'Sin señal de video desde las 06:00 AM', metadata: {}, created_at: '2024-12-01T06:00:00Z', updated_at: '2024-12-01T06:00:00Z' },
  { id: 'evt-004', tenant_id: 'tenant-001', site_id: 'site-001', device_id: 'dev-004', channel: 1, event_type: 'line_crossing', severity: 'medium', status: 'acknowledged', title: 'Cruce de línea — Entrada principal', description: 'Movimiento detectado fuera del horario laboral', metadata: { direction: 'in', time: '22:35' }, assigned_to: 'user-001', created_at: '2024-12-01T03:35:00Z', updated_at: '2024-12-01T04:00:00Z' },
  { id: 'evt-005', tenant_id: 'tenant-001', site_id: 'site-002', device_id: 'dev-006', event_type: 'tamper', severity: 'high', status: 'investigating', title: 'Tamper detectado — CAM-PERIMETRO-01', description: 'Posible obstrucción o movimiento físico de la cámara', metadata: { type: 'defocus' }, assigned_to: 'user-001', created_at: '2024-12-01T05:20:00Z', updated_at: '2024-12-01T06:00:00Z' },
  { id: 'evt-006', tenant_id: 'tenant-001', site_id: 'site-002', device_id: 'dev-005', channel: 1, event_type: 'people_counting', severity: 'low', status: 'resolved', title: 'Conteo de personas — Almacén', description: 'Máximo de ocupación alcanzado temporalmente', metadata: { count: 45, max: 50 }, created_at: '2024-12-01T14:30:00Z', updated_at: '2024-12-01T15:00:00Z' },
];

export const SEED_INCIDENTS: Incident[] = [
  { id: 'inc-001', tenant_id: 'tenant-001', site_id: 'site-001', title: 'Acceso no autorizado a zona de servidores', description: 'Se detectó persona sin credenciales en el área de servidores durante madrugada', status: 'investigating', priority: 'critical', assigned_to: 'user-001', created_by: 'user-001', event_ids: ['evt-001'], evidence_urls: [], comments: [{ id: 'c-001', user_id: 'user-001', user_name: 'Carlos Mendoza', content: 'Revisando grabaciones de las cámaras adyacentes', created_at: '2024-12-01T09:00:00Z' }], created_at: '2024-12-01T09:00:00Z', updated_at: '2024-12-01T09:30:00Z' },
];

export const SEED_AUDIT_LOGS: AuditLog[] = [
  { id: 'aud-001', tenant_id: 'tenant-001', user_id: 'user-001', user_email: 'admin@aionvision.io', action: 'login', entity_type: 'session', created_at: '2024-12-01T08:00:00Z' },
  { id: 'aud-002', tenant_id: 'tenant-001', user_id: 'user-001', user_email: 'admin@aionvision.io', action: 'device.update', entity_type: 'device', entity_id: 'dev-006', before_state: { status: 'online' }, after_state: { status: 'degraded' }, created_at: '2024-12-01T08:30:00Z' },
  { id: 'aud-003', tenant_id: 'tenant-001', user_id: 'user-001', user_email: 'admin@aionvision.io', action: 'event.acknowledge', entity_type: 'event', entity_id: 'evt-004', created_at: '2024-12-01T04:00:00Z' },
  { id: 'aud-004', tenant_id: 'tenant-001', user_id: 'user-001', user_email: 'admin@aionvision.io', action: 'incident.create', entity_type: 'incident', entity_id: 'inc-001', created_at: '2024-12-01T09:00:00Z' },
];

export const SEED_INTEGRATIONS: Integration[] = [
  { id: 'int-001', tenant_id: 'tenant-001', name: 'Lovable AI', type: 'ai_provider', provider: 'lovable', status: 'active', config: { model: 'google/gemini-3-flash-preview' }, last_sync: '2024-12-01T10:00:00Z', created_at: '2024-01-15T08:00:00Z' },
  { id: 'int-002', tenant_id: 'tenant-001', name: 'Email SMTP', type: 'notification', provider: 'smtp', status: 'active', config: {}, created_at: '2024-01-15T08:00:00Z' },
  { id: 'int-003', tenant_id: 'tenant-001', name: 'Webhook — Central de Alarmas', type: 'webhook', provider: 'custom', status: 'active', config: { url: 'https://alarm-central.example.com/api/events' }, created_at: '2024-02-01T08:00:00Z' },
];

export const SEED_MCP_CONNECTORS: MCPConnector[] = [
  { id: 'mcp-001', tenant_id: 'tenant-001', name: 'ONVIF Discovery', type: 'onvif_orchestration', status: 'connected', scopes: ['device.read', 'device.discover'], health: 'healthy', error_count: 0, config: {}, created_at: '2024-01-15T08:00:00Z' },
  { id: 'mcp-002', tenant_id: 'tenant-001', name: 'Email Notifications', type: 'email_notification', status: 'connected', scopes: ['notification.send'], health: 'healthy', error_count: 0, config: {}, created_at: '2024-01-15T08:00:00Z' },
  { id: 'mcp-003', tenant_id: 'tenant-001', name: 'Webhook Bridge', type: 'webhook', status: 'disconnected', scopes: ['webhook.send'], health: 'unknown', error_count: 2, config: {}, created_at: '2024-02-01T08:00:00Z' },
];

export const SEED_SYSTEM_HEALTH: SystemHealth[] = [
  { component: 'API Server', status: 'healthy', latency_ms: 12, last_check: '2024-12-01T10:00:00Z' },
  { component: 'Database', status: 'healthy', latency_ms: 3, last_check: '2024-12-01T10:00:00Z' },
  { component: 'AI Gateway', status: 'healthy', latency_ms: 145, last_check: '2024-12-01T10:00:00Z' },
  { component: 'MCP Registry', status: 'healthy', latency_ms: 8, last_check: '2024-12-01T10:00:00Z' },
  { component: 'Edge Gateway — Bogotá', status: 'healthy', latency_ms: 5, last_check: '2024-12-01T10:00:00Z' },
  { component: 'Edge Gateway — Medellín', status: 'degraded', latency_ms: 230, last_check: '2024-12-01T10:00:00Z', details: { reason: 'High latency detected' } },
  { component: 'Edge Gateway — Cali', status: 'down', last_check: '2024-12-01T06:00:00Z', details: { reason: 'Connection lost' } },
  { component: 'Storage Service', status: 'healthy', latency_ms: 18, last_check: '2024-12-01T10:00:00Z' },
];
