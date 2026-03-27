import type { CreateNotificationTemplateInput } from './schemas.js';

/**
 * Default system templates seeded on first tenant setup.
 *
 * All use {{variable}} placeholder syntax.
 * `isSystem: true` prevents deletion from the UI.
 */
export const DEFAULT_TEMPLATES: CreateNotificationTemplateInput[] = [
  // ── 1. Event Alert ─────────────────────────────────────────
  {
    name: 'event_alert',
    description: 'General event alert sent when a new event matches an alert rule.',
    category: 'alert',
    channel: 'all',
    subject: '[{{severity}}] {{event_title}} at {{site_name}}',
    bodyTemplate: [
      'New {{severity}} event: {{event_title}} at {{site_name}}.',
      '',
      '{{#if description}}Details: {{description}}{{/if}}',
      '',
      'Event type: {{event_type}}',
      '{{#if device_name}}Device: {{device_name}}{{/if}}',
      'Site: {{site_name}}',
      'Time: {{date}}',
    ].join('\n'),
    variables: [
      { name: 'severity', description: 'Event severity level (critical, high, medium, low, info)', sample: 'critical' },
      { name: 'event_title', description: 'Short title of the event', sample: 'Motion detected in restricted area' },
      { name: 'event_type', description: 'Type of event', sample: 'motion_detection' },
      { name: 'description', description: 'Detailed event description', sample: 'Motion sensor triggered in Zone B after hours.' },
      { name: 'device_name', description: 'Name of the device that generated the event', sample: 'CAM-LOBBY-01' },
      { name: 'site_name', description: 'Name of the site', sample: 'Main Office' },
      { name: 'date', description: 'Formatted timestamp of the event', sample: '2026-03-25 14:30:00' },
    ],
    isSystem: true,
  },

  // ── 2. Incident Created ────────────────────────────────────
  {
    name: 'incident_created',
    description: 'Notification sent when a new incident is created (manually or via automation).',
    category: 'incident',
    channel: 'all',
    subject: 'Incident #{{incident_id}}: {{incident_title}} ({{priority}})',
    bodyTemplate: [
      'Incident #{{incident_id}}: {{incident_title}}',
      'Priority: {{priority}}',
      'Status: {{status}}',
      '',
      '{{#if description}}{{description}}{{/if}}',
      '',
      '{{#if assigned_to}}Assigned to: {{assigned_to}}{{/if}}',
      'Site: {{site_name}}',
      'Created at: {{date}}',
    ].join('\n'),
    variables: [
      { name: 'incident_id', description: 'Short incident identifier', sample: 'a1b2c3d4' },
      { name: 'incident_title', description: 'Incident title', sample: 'Unauthorized access attempt' },
      { name: 'priority', description: 'Incident priority', sample: 'high' },
      { name: 'status', description: 'Current incident status', sample: 'open' },
      { name: 'description', description: 'Incident description', sample: 'Badge reader bypass detected at Gate 3.' },
      { name: 'assigned_to', description: 'Name of the assigned operator', sample: 'Carlos M.' },
      { name: 'site_name', description: 'Site name', sample: 'Warehouse North' },
      { name: 'date', description: 'Creation timestamp', sample: '2026-03-25 09:15:00' },
    ],
    isSystem: true,
  },

  // ── 3. Device Offline ──────────────────────────────────────
  {
    name: 'device_offline',
    description: 'Alert when a monitored device goes offline.',
    category: 'system',
    channel: 'all',
    subject: 'Device Offline: {{device_name}} at {{site_name}}',
    bodyTemplate: [
      'Device {{device_name}} ({{device_ip}}) went offline at {{site_name}}.',
      '',
      'Last seen: {{last_seen}}',
      '{{#if device_type}}Type: {{device_type}}{{/if}}',
      '',
      'Please check the device connectivity and restart if needed.',
    ].join('\n'),
    variables: [
      { name: 'device_name', description: 'Device display name', sample: 'NVR-MAIN-01' },
      { name: 'device_ip', description: 'Device IP address', sample: '192.168.1.50' },
      { name: 'site_name', description: 'Site where the device is located', sample: 'Headquarters' },
      { name: 'last_seen', description: 'Last time the device was online', sample: '2026-03-25 13:45:00' },
      { name: 'device_type', description: 'Type of device (camera, NVR, sensor)', sample: 'NVR' },
    ],
    isSystem: true,
  },

  // ── 4. Visitor Arrived ─────────────────────────────────────
  {
    name: 'visitor_arrived',
    description: 'Notification when a pre-registered visitor arrives at a site.',
    category: 'visitor',
    channel: 'all',
    subject: 'Visitor Arrived: {{visitor_name}} at {{site_name}}',
    bodyTemplate: [
      'Visitor {{visitor_name}} from {{visitor_company}} arrived at {{site_name}}.',
      '',
      '{{#if host_name}}Host: {{host_name}}{{/if}}',
      '{{#if purpose}}Purpose: {{purpose}}{{/if}}',
      'Arrival time: {{date}}',
    ].join('\n'),
    variables: [
      { name: 'visitor_name', description: 'Visitor full name', sample: 'Maria Garcia' },
      { name: 'visitor_company', description: 'Visitor company/organization', sample: 'ACME Corp' },
      { name: 'site_name', description: 'Site name', sample: 'Main Lobby' },
      { name: 'host_name', description: 'Name of the person being visited', sample: 'Juan Perez' },
      { name: 'purpose', description: 'Purpose of the visit', sample: 'Maintenance inspection' },
      { name: 'date', description: 'Arrival timestamp', sample: '2026-03-25 10:00:00' },
    ],
    isSystem: true,
  },

  // ── 5. Shift Handover ──────────────────────────────────────
  {
    name: 'shift_handover',
    description: 'Notification for shift handover between operators.',
    category: 'shift',
    channel: 'all',
    subject: 'Shift Handover at {{site_name}}',
    bodyTemplate: [
      'Shift handover: {{from_operator}} \u2192 {{to_operator}} at {{site_name}}.',
      '',
      '{{#if notes}}Handover notes: {{notes}}{{/if}}',
      '{{#if pending_incidents}}Pending incidents: {{pending_incidents}}{{/if}}',
      'Time: {{date}}',
    ].join('\n'),
    variables: [
      { name: 'from_operator', description: 'Outgoing operator name', sample: 'Pedro Lopez' },
      { name: 'to_operator', description: 'Incoming operator name', sample: 'Ana Rodriguez' },
      { name: 'site_name', description: 'Site name', sample: 'Tower A' },
      { name: 'notes', description: 'Handover notes', sample: 'All clear, fire panel tested at 22:00.' },
      { name: 'pending_incidents', description: 'Number of pending incidents', sample: '2' },
      { name: 'date', description: 'Handover timestamp', sample: '2026-03-25 06:00:00' },
    ],
    isSystem: true,
  },

  // ── 6. Gate Opened ─────────────────────────────────────────
  {
    name: 'gate_opened',
    description: 'Notification when a gate or barrier is remotely opened.',
    category: 'access',
    channel: 'all',
    subject: 'Gate Opened at {{site_name}}',
    bodyTemplate: [
      'Gate opened by {{operator_name}} at {{site_name}}.',
      'Reason: {{reason}}',
      '',
      '{{#if gate_name}}Gate: {{gate_name}}{{/if}}',
      'Time: {{date}}',
    ].join('\n'),
    variables: [
      { name: 'operator_name', description: 'Name of the operator who opened the gate', sample: 'Carlos Mendez' },
      { name: 'site_name', description: 'Site name', sample: 'Parking Level B1' },
      { name: 'reason', description: 'Reason for opening the gate', sample: 'Delivery vehicle access' },
      { name: 'gate_name', description: 'Gate or barrier identifier', sample: 'Gate B1-North' },
      { name: 'date', description: 'Timestamp', sample: '2026-03-25 11:30:00' },
    ],
    isSystem: true,
  },

  // ── 7. Daily Report ────────────────────────────────────────
  {
    name: 'daily_report',
    description: 'Daily summary report sent to supervisors.',
    category: 'system',
    channel: 'email',
    subject: 'Daily Report: {{site_name}} - {{report_date}}',
    bodyTemplate: [
      'Daily report for {{site_name}} ({{report_date}}):',
      '',
      'Events: {{events_count}}',
      'Incidents: {{incidents_count}}',
      '{{#if critical_count}}Critical events: {{critical_count}}{{/if}}',
      '{{#if devices_online}}Devices online: {{devices_online}}/{{devices_total}}{{/if}}',
      '',
      '{{#if summary}}Summary: {{summary}}{{/if}}',
    ].join('\n'),
    variables: [
      { name: 'site_name', description: 'Site name', sample: 'Main Campus' },
      { name: 'report_date', description: 'Report date', sample: '2026-03-25' },
      { name: 'events_count', description: 'Total number of events', sample: '142' },
      { name: 'incidents_count', description: 'Total number of incidents', sample: '3' },
      { name: 'critical_count', description: 'Number of critical events', sample: '1' },
      { name: 'devices_online', description: 'Devices currently online', sample: '47' },
      { name: 'devices_total', description: 'Total devices', sample: '50' },
      { name: 'summary', description: 'Optional summary text', sample: 'All systems operational. One camera offline in Zone C.' },
    ],
    isSystem: true,
  },

  // ── 8. Escalation Alert ────────────────────────────────────
  {
    name: 'escalation_alert',
    description: 'Escalation notification when an alert is not acknowledged within the expected time.',
    category: 'alert',
    channel: 'all',
    subject: 'ESCALATION: {{alert_name}} not acknowledged',
    bodyTemplate: [
      'ESCALATION: {{alert_name}} not acknowledged after {{escalation_minutes}} minutes.',
      '',
      'Severity: {{severity}}',
      'Site: {{site_name}}',
      '{{#if original_recipient}}Originally sent to: {{original_recipient}}{{/if}}',
      'Escalation level: {{escalation_level}}',
      '',
      'Immediate attention required.',
    ].join('\n'),
    variables: [
      { name: 'alert_name', description: 'Name of the original alert', sample: 'Perimeter intrusion detected' },
      { name: 'escalation_minutes', description: 'Minutes elapsed without acknowledgment', sample: '15' },
      { name: 'severity', description: 'Alert severity', sample: 'critical' },
      { name: 'site_name', description: 'Site name', sample: 'Distribution Center' },
      { name: 'original_recipient', description: 'Originally notified person', sample: 'Operator Team A' },
      { name: 'escalation_level', description: 'Current escalation level', sample: '2' },
    ],
    isSystem: true,
  },
];
