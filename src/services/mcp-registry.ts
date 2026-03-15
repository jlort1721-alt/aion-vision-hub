// ═══════════════════════════════════════════════════════════
// AION VISION HUB — MCP Connector Registry
// ═══════════════════════════════════════════════════════════

export interface MCPToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface MCPConnectorDefinition {
  type: string;
  name: string;
  description: string;
  category: MCPCategory;
  icon: string;
  requiredScopes: string[];
  availableTools: MCPToolSchema[];
  configSchema: Record<string, unknown>;
}

export type MCPCategory =
  | 'device'
  | 'notification'
  | 'storage'
  | 'ticketing'
  | 'crm'
  | 'erp'
  | 'messaging'
  | 'voip'
  | 'automation'
  | 'analytics'
  | 'documentation'
  | 'security'
  | 'access_control'
  | 'webhook';

/** Pre-defined MCP connector catalog */
export const MCP_CONNECTOR_CATALOG: MCPConnectorDefinition[] = [
  {
    type: 'onvif_orchestration',
    name: 'ONVIF Orchestration',
    description: 'Discover and manage ONVIF-compatible devices',
    category: 'device',
    icon: 'Video',
    requiredScopes: ['device.read', 'device.write', 'device.discover'],
    availableTools: [
      { name: 'discover_devices', description: 'Scan network for ONVIF devices', inputSchema: { type: 'object', properties: { network_range: { type: 'string' } } } },
      { name: 'get_device_info', description: 'Get device information', inputSchema: { type: 'object', properties: { device_id: { type: 'string' } } } },
    ],
    configSchema: { type: 'object', properties: { network_range: { type: 'string' }, scan_interval: { type: 'number' } } },
  },
  {
    type: 'email_notification',
    name: 'Email Notifications',
    description: 'Send email alerts and reports',
    category: 'notification',
    icon: 'Mail',
    requiredScopes: ['notification.send'],
    availableTools: [
      { name: 'send_alert', description: 'Send alert email', inputSchema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } } } },
    ],
    configSchema: { type: 'object', properties: { smtp_host: { type: 'string' }, smtp_port: { type: 'number' } } },
  },
  {
    type: 'webhook',
    name: 'Webhooks',
    description: 'Send and receive webhook events',
    category: 'webhook',
    icon: 'Webhook',
    requiredScopes: ['webhook.send', 'webhook.receive'],
    availableTools: [
      { name: 'send_webhook', description: 'Send webhook event', inputSchema: { type: 'object', properties: { url: { type: 'string' }, payload: { type: 'object' } } } },
    ],
    configSchema: { type: 'object', properties: { endpoints: { type: 'array' } } },
  },
  {
    type: 'ticketing',
    name: 'Ticketing System',
    description: 'Create and manage support tickets',
    category: 'ticketing',
    icon: 'Ticket',
    requiredScopes: ['ticket.read', 'ticket.write'],
    availableTools: [
      { name: 'create_ticket', description: 'Create support ticket', inputSchema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' } } } },
    ],
    configSchema: { type: 'object', properties: { api_url: { type: 'string' } } },
  },
  {
    type: 'cloud_storage',
    name: 'Cloud Storage',
    description: 'Store clips, snapshots and evidence',
    category: 'storage',
    icon: 'Cloud',
    requiredScopes: ['storage.read', 'storage.write'],
    availableTools: [
      { name: 'upload_file', description: 'Upload file to storage', inputSchema: { type: 'object', properties: { path: { type: 'string' }, file: { type: 'string' } } } },
    ],
    configSchema: { type: 'object', properties: { bucket: { type: 'string' }, region: { type: 'string' } } },
  },
  {
    type: 'access_control',
    name: 'Access Control',
    description: 'Integrate with access control systems',
    category: 'access_control',
    icon: 'DoorOpen',
    requiredScopes: ['access.read', 'access.control'],
    availableTools: [
      { name: 'grant_access', description: 'Grant door access', inputSchema: { type: 'object', properties: { door_id: { type: 'string' } } } },
    ],
    configSchema: { type: 'object', properties: { controller_ip: { type: 'string' } } },
  },
  {
    type: 'siem',
    name: 'SIEM Integration',
    description: 'Forward events to SIEM platform',
    category: 'security',
    icon: 'Shield',
    requiredScopes: ['event.forward'],
    availableTools: [
      { name: 'forward_event', description: 'Forward event to SIEM', inputSchema: { type: 'object', properties: { event: { type: 'object' } } } },
    ],
    configSchema: { type: 'object', properties: { siem_url: { type: 'string' }, api_key_ref: { type: 'string' } } },
  },
  {
    type: 'whatsapp_messaging',
    name: 'WhatsApp Business',
    description: 'Send alerts via WhatsApp',
    category: 'messaging',
    icon: 'MessageCircle',
    requiredScopes: ['message.send'],
    availableTools: [
      { name: 'send_message', description: 'Send WhatsApp message', inputSchema: { type: 'object', properties: { phone: { type: 'string' }, message: { type: 'string' } } } },
    ],
    configSchema: { type: 'object', properties: { phone_number_id: { type: 'string' } } },
  },
  {
    type: 'voip_gateway',
    name: 'VoIP Gateway',
    description: 'SIP/VoIP intercom and emergency calls',
    category: 'voip',
    icon: 'Phone',
    requiredScopes: ['voip.call', 'voip.intercom'],
    availableTools: [
      { name: 'initiate_call', description: 'Start SIP call to device or operator', inputSchema: { type: 'object', properties: { target_sip: { type: 'string' }, priority: { type: 'string' } } } },
      { name: 'broadcast', description: 'Broadcast audio message to zone', inputSchema: { type: 'object', properties: { zone_id: { type: 'string' }, audio_url: { type: 'string' } } } },
    ],
    configSchema: { type: 'object', properties: { sip_server: { type: 'string' }, sip_port: { type: 'number' }, transport: { type: 'string' } } },
  },
  {
    type: 'automation_engine',
    name: 'Automation Engine',
    description: 'Rule-based automation and scheduled tasks',
    category: 'automation',
    icon: 'Zap',
    requiredScopes: ['automation.read', 'automation.write', 'automation.execute'],
    availableTools: [
      { name: 'create_rule', description: 'Create automation rule', inputSchema: { type: 'object', properties: { trigger: { type: 'object' }, conditions: { type: 'array' }, actions: { type: 'array' } } } },
      { name: 'execute_action', description: 'Execute automation action', inputSchema: { type: 'object', properties: { action_id: { type: 'string' }, params: { type: 'object' } } } },
      { name: 'list_rules', description: 'List active automation rules', inputSchema: { type: 'object', properties: { status: { type: 'string' } } } },
    ],
    configSchema: { type: 'object', properties: { max_concurrent: { type: 'number' }, retry_policy: { type: 'string' } } },
  },
  {
    type: 'knowledge_base',
    name: 'Knowledge Base',
    description: 'SOPs, manuals and operational documentation',
    category: 'documentation',
    icon: 'BookOpen',
    requiredScopes: ['docs.read', 'docs.write'],
    availableTools: [
      { name: 'search_docs', description: 'Search knowledge base', inputSchema: { type: 'object', properties: { query: { type: 'string' }, category: { type: 'string' } } } },
      { name: 'get_sop', description: 'Get standard operating procedure', inputSchema: { type: 'object', properties: { sop_id: { type: 'string' } } } },
    ],
    configSchema: { type: 'object', properties: { storage_backend: { type: 'string' } } },
  },
  {
    type: 'inventory_management',
    name: 'Inventory Management',
    description: 'Track device inventory, spare parts and maintenance',
    category: 'erp',
    icon: 'Package',
    requiredScopes: ['inventory.read', 'inventory.write'],
    availableTools: [
      { name: 'check_stock', description: 'Check spare parts inventory', inputSchema: { type: 'object', properties: { part_number: { type: 'string' } } } },
      { name: 'create_maintenance_order', description: 'Create maintenance work order', inputSchema: { type: 'object', properties: { device_id: { type: 'string' }, issue: { type: 'string' }, priority: { type: 'string' } } } },
    ],
    configSchema: { type: 'object', properties: { erp_api_url: { type: 'string' } } },
  },
  {
    type: 'analytics_dashboard',
    name: 'Analytics & BI',
    description: 'Advanced analytics, heatmaps and occupancy tracking',
    category: 'analytics',
    icon: 'BarChart3',
    requiredScopes: ['analytics.read', 'analytics.export'],
    availableTools: [
      { name: 'get_occupancy', description: 'Get zone occupancy data', inputSchema: { type: 'object', properties: { zone_id: { type: 'string' }, timeframe: { type: 'string' } } } },
      { name: 'generate_heatmap', description: 'Generate activity heatmap', inputSchema: { type: 'object', properties: { camera_id: { type: 'string' }, date_range: { type: 'object' } } } },
      { name: 'export_report', description: 'Export analytics report', inputSchema: { type: 'object', properties: { report_type: { type: 'string' }, format: { type: 'string' } } } },
    ],
    configSchema: { type: 'object', properties: { retention_days: { type: 'number' }, export_formats: { type: 'array' } } },
  },
  {
    type: 'sms_gateway',
    name: 'SMS Gateway',
    description: 'Send SMS alerts for critical events',
    category: 'messaging',
    icon: 'Smartphone',
    requiredScopes: ['sms.send'],
    availableTools: [
      { name: 'send_sms', description: 'Send SMS message', inputSchema: { type: 'object', properties: { phone_number: { type: 'string' }, message: { type: 'string' } } } },
      { name: 'send_bulk_sms', description: 'Send SMS to multiple recipients', inputSchema: { type: 'object', properties: { recipients: { type: 'array' }, message: { type: 'string' } } } },
    ],
    configSchema: { type: 'object', properties: { provider: { type: 'string' }, api_key_ref: { type: 'string' } } },
  },
];

/** Get connectors by category */
export function getConnectorsByCategory(category: MCPCategory): MCPConnectorDefinition[] {
  return MCP_CONNECTOR_CATALOG.filter(c => c.category === category);
}

/** Get all categories */
export function getMCPCategories(): MCPCategory[] {
  return [...new Set(MCP_CONNECTOR_CATALOG.map(c => c.category))];
}
