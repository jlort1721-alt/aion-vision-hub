// ═══════════════════════════════════════════════════════════
// AION VISION HUB — API Entity Interfaces
// Shapes matching the Record<string, unknown> data returned
// by apiClient hooks (use-api-data, use-module-data).
// ═══════════════════════════════════════════════════════════

/** Device record from /devices endpoint */
export interface ApiDevice {
  id: string;
  name: string;
  type: string;
  brand?: string;
  model?: string;
  ip_address?: string;
  port?: number;
  status: string;
  site_id?: string;
  site_name?: string | null;
  site_wan_ip?: string | null;
  remote_address?: string | null;
  channels?: number;
  firmware_version?: string;
  serial_number?: string;
  mac_address?: string;
  tags?: string[];
  notes?: string;
  last_seen?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

/** Site record from /sites endpoint */
export interface ApiSite {
  id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  status?: string;
  wan_ip?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** Access control person record */
export interface ApiAccessPerson {
  id: string;
  full_name?: string;
  fullName?: string;
  type?: string;
  section_id?: string;
  sectionId?: string;
  unit?: string;
  phone?: string;
  email?: string;
  document_id?: string;
  documentId?: string;
  notes?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** Access control vehicle record */
export interface ApiAccessVehicle {
  id: string;
  plate?: string;
  brand?: string;
  model?: string;
  color?: string;
  type?: string;
  person_id?: string;
  personId?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** Access log record */
export interface ApiAccessLog {
  id: string;
  created_at?: string;
  createdAt?: string;
  person_id?: string;
  device_id?: string;
  direction?: string;
  method?: string;
  [key: string]: unknown;
}

/** Section / database-record */
export interface ApiSection {
  id: string;
  name: string;
  type?: string;
  description?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

/** Domotic / eWeLink device record */
export interface ApiDomoticDevice {
  id: string;
  name: string;
  type: string;
  state?: string;
  section_id?: string;
  brand?: string;
  model?: string;
  [key: string]: unknown;
}

/** Intercom device record */
export interface ApiIntercomDevice {
  id: string;
  name: string;
  type?: string;
  status?: string;
  ip_address?: string;
  [key: string]: unknown;
}

/** LPR detection record */
export interface ApiLprDetection {
  id: string;
  plate?: string;
  confidence?: number;
  timestamp?: string;
  detected_at?: string;
  camera_id?: string;
  snapshot_url?: string;
  matched?: boolean;
  authorized?: boolean;
  vehicle_id?: string;
  person_name?: string;
  person_type?: string;
  status?: string;
  zone?: string;
  [key: string]: unknown;
}

/** Database search record */
export interface ApiDatabaseRecord {
  id: string;
  title?: string;
  name?: string;
  category?: string;
  tags?: string[];
  [key: string]: unknown;
}

/** WhatsApp template */
export interface ApiWhatsAppTemplate {
  id?: string;
  name: string;
  [key: string]: unknown;
}

/** eWeLink status response */
export interface ApiEwelinkStatus {
  status?: string;
  devices?: unknown[];
  data?: {
    status?: string;
    devices?: unknown[];
  };
}

/** AI chat response */
export interface ApiAiChatResponse {
  response?: string;
  message?: string;
  answer?: string;
  data?: {
    response?: string;
    message?: string;
    answer?: string;
  };
}

/** Event record */
export interface ApiEvent {
  id: string;
  title?: string;
  description?: string;
  severity?: string;
  status?: string;
  event_type?: string;
  device_id?: string;
  site_id?: string;
  created_at?: string;
  updated_at?: string;
  snapshot_url?: string;
  [key: string]: unknown;
}

/** Incident record */
export interface ApiIncident {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assigned_to?: string;
  site_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** Floor plan position */
export interface FloorPlanPosition {
  deviceId: string;
  x: number;
  y: number;
}

/** Generic envelope response with nested data */
export interface ApiEnvelope<T = unknown> {
  data?: T;
  items?: T[];
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    hasMore?: boolean;
  };
}
