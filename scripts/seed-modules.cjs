/**
 * AION Vision Hub — Seed Empty Modules (Both Databases)
 *
 * Seeds realistic data for all empty module tables in:
 *   1. aionseg_prod  (tenant: a0000000-0000-0000-0000-000000000001)
 *   2. aion_prod     (tenant: 7d85efb0-3220-476c-8662-1e7d644c5493)
 *
 * Idempotent: skips tables that already have rows for the tenant.
 *
 * Usage: node scripts/seed-modules.cjs
 */

'use strict';

const { Pool } = require('pg');

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const DATABASES = [
  {
    label: 'aionseg_prod',
    connectionString: 'postgresql://aionseg:A10n$3g_Pr0d_2026!@localhost:5432/aionseg_prod',
    tenantId: 'a0000000-0000-0000-0000-000000000001',
  },
  {
    label: 'aion_prod',
    connectionString: 'postgresql://aion_user:A10n_Sys_Pr0d_2026!@localhost:5432/aion_prod',
    tenantId: '7d85efb0-3220-476c-8662-1e7d644c5493',
  },
];

// System user UUID used as created_by for seeded records
const SYSTEM_USER = '00000000-0000-0000-0000-000000000000';

// ═══════════════════════════════════════════════════════════════════════════
// Seed definitions — one function per table
// ═══════════════════════════════════════════════════════════════════════════

async function seedShifts(client, tenantId) {
  const table = 'shifts';
  if (await hasData(client, table, tenantId)) return skip(table);

  // We need a valid site_id. Pick the first active site for this tenant.
  const siteRow = await client.query(
    `SELECT id FROM sites WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at LIMIT 1`,
    [tenantId]
  );
  const siteId = siteRow.rows.length > 0 ? siteRow.rows[0].id : null;

  const shifts = [
    { name: 'Turno Mañana', start: '06:00', end: '14:00', days: [1,2,3,4,5,6,0], max: 3, desc: 'Turno diurno — cobertura de horario laboral y escolar' },
    { name: 'Turno Tarde',  start: '14:00', end: '22:00', days: [1,2,3,4,5,6,0], max: 2, desc: 'Turno vespertino — mayor flujo vehicular y peatonal' },
    { name: 'Turno Noche',  start: '22:00', end: '06:00', days: [1,2,3,4,5,6,0], max: 2, desc: 'Turno nocturno — vigilancia perimetral reforzada' },
  ];

  for (const s of shifts) {
    await client.query(
      `INSERT INTO shifts (tenant_id, site_id, name, start_time, end_time, days_of_week, max_guards, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, true)`,
      [tenantId, siteId, s.name, s.start, s.end, JSON.stringify(s.days), s.max, s.desc]
    );
  }
  return done(table, shifts.length);
}

async function seedShiftAssignments(client, tenantId) {
  const table = 'shift_assignments';
  if (await hasData(client, table, tenantId)) return skip(table);

  const shiftRows = await client.query(
    `SELECT id FROM shifts WHERE tenant_id = $1 ORDER BY start_time`, [tenantId]
  );
  if (shiftRows.rows.length === 0) return skip(table + ' (no shifts found)');

  // Use system user as placeholder user_id
  const guardIds = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
  ];

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const assignments = [
    { shiftIdx: 0, guardIdx: 0, date: today,    status: 'completed', notes: 'Sin novedad' },
    { shiftIdx: 0, guardIdx: 1, date: today,    status: 'completed', notes: null },
    { shiftIdx: 1, guardIdx: 2, date: today,    status: 'in_progress', notes: 'Reemplazo de Carlos Ruiz' },
    { shiftIdx: 2, guardIdx: 3, date: tomorrow, status: 'scheduled', notes: null },
    { shiftIdx: 0, guardIdx: 4, date: tomorrow, status: 'scheduled', notes: 'Primer turno del nuevo guardia' },
  ];

  for (const a of assignments) {
    const shiftId = shiftRows.rows[Math.min(a.shiftIdx, shiftRows.rows.length - 1)].id;
    await client.query(
      `INSERT INTO shift_assignments (tenant_id, shift_id, user_id, date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, shiftId, guardIds[a.guardIdx], a.date.toISOString(), a.status, a.notes]
    );
  }
  return done(table, assignments.length);
}

async function seedAlertRules(client, tenantId) {
  const table = 'alert_rules';
  if (await hasData(client, table, tenantId)) return skip(table);

  const rules = [
    {
      name: 'Dispositivo offline > 10 min',
      desc: 'Alerta cuando un dispositivo pierde conexion por mas de 10 minutos',
      conditions: { eventType: 'device_offline', durationMinutes: 10 },
      actions: { type: 'notify', channels: ['email', 'push'], template: 'device_offline' },
      severity: 'high', cooldown: 30,
    },
    {
      name: 'Evento critico sin resolver > 30 min',
      desc: 'Escala evento critico no atendido en 30 minutos',
      conditions: { eventType: 'critical_event_unresolved', durationMinutes: 30 },
      actions: { type: 'escalate', level: 2, channels: ['whatsapp', 'email'] },
      severity: 'critical', cooldown: 60,
    },
    {
      name: 'Puerta forzada',
      desc: 'Detecta apertura forzada de puerta de acceso',
      conditions: { eventType: 'door_forced', immediate: true },
      actions: { type: 'notify', channels: ['whatsapp', 'push'], createIncident: true },
      severity: 'critical', cooldown: 5,
    },
    {
      name: 'Manipulacion de camara',
      desc: 'Detecta intento de tamper o bloqueo de lente en camara',
      conditions: { eventType: 'camera_tamper', immediate: true },
      actions: { type: 'notify', channels: ['push', 'email'], createIncident: true },
      severity: 'high', cooldown: 15,
    },
    {
      name: 'Movimiento en zona restringida',
      desc: 'Movimiento detectado en zona restringida fuera de horario (22:00-06:00)',
      conditions: { eventType: 'motion_detected', zone: 'restricted', timeRange: { start: '22:00', end: '06:00' } },
      actions: { type: 'notify', channels: ['whatsapp', 'push'], createIncident: true, activateProtocol: 'intrusion' },
      severity: 'critical', cooldown: 10,
    },
  ];

  for (const r of rules) {
    await client.query(
      `INSERT INTO alert_rules (tenant_id, name, description, conditions, actions, severity, cooldown_minutes, is_active, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, true, $8)`,
      [tenantId, r.name, r.desc, JSON.stringify(r.conditions), JSON.stringify(r.actions), r.severity, r.cooldown, SYSTEM_USER]
    );
  }
  return done(table, rules.length);
}

async function seedEmergencyProtocols(client, tenantId) {
  const table = 'emergency_protocols';
  if (await hasData(client, table, tenantId)) return skip(table);

  const protocols = [
    {
      name: 'Protocolo de Incendio',
      type: 'fire',
      desc: 'Procedimiento de evacuacion y respuesta ante incendio',
      priority: 1,
      steps: [
        { order: 1, action: 'Activar alarma contra incendios del edificio' },
        { order: 2, action: 'Llamar a Bomberos (119)' },
        { order: 3, action: 'Notificar al administrador del edificio' },
        { order: 4, action: 'Iniciar evacuacion por escaleras de emergencia' },
        { order: 5, action: 'Verificar areas comunes y garantizar que no quede nadie' },
        { order: 6, action: 'Reunir personas en punto de encuentro designado' },
        { order: 7, action: 'Reportar conteo de personas al coordinador de emergencias' },
      ],
      autoActions: [
        { type: 'unlock_emergency_exits' },
        { type: 'notify_all_channels', message: 'EMERGENCIA: Protocolo de incendio activado' },
      ],
    },
    {
      name: 'Protocolo de Emergencia Medica',
      type: 'medical',
      desc: 'Respuesta ante emergencia medica de residente, visitante o personal',
      priority: 2,
      steps: [
        { order: 1, action: 'Evaluar estado de la persona afectada' },
        { order: 2, action: 'Llamar linea de emergencias 123 / ambulancia 125' },
        { order: 3, action: 'Aplicar primeros auxilios basicos si esta capacitado' },
        { order: 4, action: 'Despejar area y facilitar acceso a paramedicos' },
        { order: 5, action: 'Registrar incidente en bitacora y sistema AION' },
      ],
      autoActions: [
        { type: 'notify_channels', channels: ['push', 'whatsapp'], message: 'Emergencia medica — atencion requerida' },
      ],
    },
    {
      name: 'Protocolo de Brecha de Seguridad',
      type: 'security_breach',
      desc: 'Respuesta ante intrusion, acceso no autorizado o brecha perimetral',
      priority: 1,
      steps: [
        { order: 1, action: 'Activar alarma perimetral y cerrar accesos' },
        { order: 2, action: 'Verificar camaras del area comprometida' },
        { order: 3, action: 'Llamar a la Policia Nacional (123)' },
        { order: 4, action: 'Notificar al supervisor de seguridad y administracion' },
        { order: 5, action: 'Aislar la zona afectada y restringir acceso' },
        { order: 6, action: 'Documentar evidencia fotografica y de video' },
        { order: 7, action: 'Elaborar informe de incidente para autoridades' },
      ],
      autoActions: [
        { type: 'lock_all_doors' },
        { type: 'start_recording', cameras: 'all' },
        { type: 'notify_all_channels', message: 'ALERTA ROJA: Brecha de seguridad detectada' },
      ],
    },
  ];

  for (const p of protocols) {
    await client.query(
      `INSERT INTO emergency_protocols (tenant_id, name, type, description, steps, auto_actions, priority, is_active)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, true)`,
      [tenantId, p.name, p.type, p.desc, JSON.stringify(p.steps), JSON.stringify(p.autoActions), p.priority]
    );
  }
  return done(table, protocols.length);
}

async function seedEmergencyContacts(client, tenantId) {
  const table = 'emergency_contacts';
  if (await hasData(client, table, tenantId)) return skip(table);

  const contacts = [
    { name: 'Policia Nacional',         role: 'Autoridad',           phone: '123',          email: null,                          priority: 1 },
    { name: 'Bomberos de Medellin',     role: 'Bomberos',            phone: '119',          email: 'bomberos@medellin.gov.co',    priority: 1 },
    { name: 'Ambulancia / Cruz Roja',   role: 'Emergencias medicas', phone: '125',          email: null,                          priority: 1 },
    { name: 'Carlos Andres Mejia',      role: 'Supervisor de turno', phone: '+573001234567', email: 'carlos.mejia@claveseg.co',   priority: 2 },
    { name: 'Maria Fernanda Lopez',     role: 'Administradora',      phone: '+573019876543', email: 'maria.lopez@claveseg.co',    priority: 3 },
  ];

  for (const c of contacts) {
    await client.query(
      `INSERT INTO emergency_contacts (tenant_id, name, role, phone, email, priority, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [tenantId, c.name, c.role, c.phone, c.email, c.priority]
    );
  }
  return done(table, contacts.length);
}

async function seedPatrolRoutes(client, tenantId) {
  const table = 'patrol_routes';
  if (await hasData(client, table, tenantId)) return skip(table);

  // Pick two sites
  const siteRows = await client.query(
    `SELECT id, name FROM sites WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at LIMIT 2`,
    [tenantId]
  );
  const site1 = siteRows.rows[0]?.id || null;
  const site2 = siteRows.rows[1]?.id || site1;

  const routes = [
    { siteId: site1, name: 'Ronda Perimetral Diurna', desc: 'Recorrido completo del perimetro exterior durante el dia', estMin: 25, freqMin: 60 },
    { siteId: site2, name: 'Ronda Nocturna Interior', desc: 'Verificacion de puertas, sotanos y areas comunes en horario nocturno', estMin: 35, freqMin: 120 },
  ];

  const insertedIds = [];
  for (const r of routes) {
    if (!r.siteId) continue;
    const res = await client.query(
      `INSERT INTO patrol_routes (tenant_id, site_id, name, description, estimated_minutes, frequency_minutes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
      [tenantId, r.siteId, r.name, r.desc, r.estMin, r.freqMin]
    );
    insertedIds.push(res.rows[0].id);
  }
  // Store route IDs for checkpoints
  client._seedRouteIds = insertedIds;
  return done(table, routes.length);
}

async function seedPatrolCheckpoints(client, tenantId) {
  const table = 'patrol_checkpoints';
  if (await hasData(client, table, tenantId)) return skip(table);

  const routeIds = client._seedRouteIds;
  if (!routeIds || routeIds.length === 0) {
    // Try to fetch existing routes
    const rows = await client.query(
      `SELECT id FROM patrol_routes WHERE tenant_id = $1 ORDER BY created_at LIMIT 2`, [tenantId]
    );
    if (rows.rows.length === 0) return skip(table + ' (no routes)');
    routeIds[0] = rows.rows[0].id;
    routeIds[1] = rows.rows[1]?.id || rows.rows[0].id;
  }

  // Medellin-area coordinates for checkpoints
  const checkpoints = [
    // Route 1 — Perimetral Diurna
    { routeIdx: 0, name: 'Porteria Principal',       order: 1, lat: 6.2518, lon: -75.5636, qr: 'CP-PER-001', photo: true,  desc: 'Verificar registro de ingreso y estado de la barrera' },
    { routeIdx: 0, name: 'Esquina Noroccidental',    order: 2, lat: 6.2525, lon: -75.5645, qr: 'CP-PER-002', photo: false, desc: 'Revisar cerca electrica y sensor perimetral' },
    { routeIdx: 0, name: 'Zona de Parqueadero',      order: 3, lat: 6.2510, lon: -75.5640, qr: 'CP-PER-003', photo: true,  desc: 'Verificar vehiculos y camara del sotano' },
    // Route 2 — Nocturna Interior
    { routeIdx: 1, name: 'Hall de Ascensores Piso 1', order: 1, lat: 6.2480, lon: -75.5710, qr: 'CP-NOC-001', photo: false, desc: 'Verificar funcionamiento de ascensores y cerradura de escaleras' },
    { routeIdx: 1, name: 'Cuarto de Maquinas',        order: 2, lat: 6.2478, lon: -75.5715, qr: 'CP-NOC-002', photo: true,  desc: 'Revisar tablero electrico y planta de emergencia' },
    { routeIdx: 1, name: 'Terraza / Azotea',          order: 3, lat: 6.2482, lon: -75.5708, qr: 'CP-NOC-003', photo: true,  desc: 'Verificar acceso cerrado y antenas de comunicaciones' },
  ];

  for (const cp of checkpoints) {
    const routeId = routeIds[Math.min(cp.routeIdx, routeIds.length - 1)];
    await client.query(
      `INSERT INTO patrol_checkpoints (tenant_id, route_id, name, description, location, "order", qr_code, required_photo)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [tenantId, routeId, cp.name, cp.desc, JSON.stringify({ lat: cp.lat, lon: cp.lon }), cp.order, cp.qr, cp.photo]
    );
  }
  return done(table, checkpoints.length);
}

async function seedSlaDefinitions(client, tenantId) {
  const table = 'sla_definitions';
  if (await hasData(client, table, tenantId)) return skip(table);

  const slas = [
    {
      name: 'Respuesta a eventos criticos',
      desc: 'Tiempo maximo de primera respuesta para eventos de severidad critica',
      severity: 'critical',
      responseMin: 5,
      resolutionMin: 60,
      businessOnly: false,
    },
    {
      name: 'Resolucion de incidentes',
      desc: 'Tiempo maximo de resolucion completa de incidentes de seguridad',
      severity: 'high',
      responseMin: 15,
      resolutionMin: 120,
      businessOnly: false,
    },
    {
      name: 'Disponibilidad de dispositivos',
      desc: 'Uptime minimo del 99% para camaras y dispositivos de acceso',
      severity: 'medium',
      responseMin: 30,
      resolutionMin: 240,
      businessOnly: true,
    },
  ];

  for (const s of slas) {
    await client.query(
      `INSERT INTO sla_definitions (tenant_id, name, description, severity, response_time_minutes, resolution_time_minutes, business_hours_only, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [tenantId, s.name, s.desc, s.severity, s.responseMin, s.resolutionMin, s.businessOnly]
    );
  }
  return done(table, slas.length);
}

async function seedAutomationRules(client, tenantId) {
  const table = 'automation_rules';
  if (await hasData(client, table, tenantId)) return skip(table);

  const rules = [
    {
      name: 'Auto-reconocer eventos informativos',
      desc: 'Reconoce automaticamente eventos de severidad info despues de 1 minuto',
      trigger: { eventType: 'event_created', severity: 'info' },
      conditions: [{ field: 'severity', operator: 'eq', value: 'info' }],
      actions: [{ type: 'acknowledge_event', delay_seconds: 60 }],
      priority: 3, cooldown: 1,
    },
    {
      name: 'Escalar criticos sin atencion > 15 min',
      desc: 'Escala automaticamente eventos criticos no atendidos despues de 15 minutos',
      trigger: { eventType: 'event_unresolved', severity: 'critical', durationMinutes: 15 },
      conditions: [{ field: 'severity', operator: 'eq', value: 'critical' }, { field: 'status', operator: 'eq', value: 'open' }],
      actions: [{ type: 'escalate', level: 2 }, { type: 'notify', channels: ['whatsapp', 'email'] }],
      priority: 1, cooldown: 15,
    },
    {
      name: 'Reiniciar dispositivo offline > 30 min',
      desc: 'Envia comando de reinicio a dispositivos offline por mas de 30 minutos',
      trigger: { eventType: 'device_offline', durationMinutes: 30 },
      conditions: [{ field: 'device_type', operator: 'in', value: ['camera', 'nvr', 'access_panel'] }],
      actions: [{ type: 'reboot_device' }, { type: 'notify', channels: ['push'], message: 'Reinicio automatico ejecutado' }],
      priority: 2, cooldown: 60,
    },
  ];

  for (const r of rules) {
    await client.query(
      `INSERT INTO automation_rules (tenant_id, name, description, trigger, conditions, actions, priority, cooldown_minutes, is_active, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, true, $9)`,
      [tenantId, r.name, r.desc, JSON.stringify(r.trigger), JSON.stringify(r.conditions), JSON.stringify(r.actions), r.priority, r.cooldown, SYSTEM_USER]
    );
  }
  return done(table, rules.length);
}

async function seedNotificationTemplates(client, tenantId) {
  const table = 'notification_templates';
  if (await hasData(client, table, tenantId)) return skip(table);

  const templates = [
    {
      name: 'Nueva alerta generada',
      desc: 'Notificacion cuando se crea una nueva alerta en el sistema',
      category: 'alert',
      channel: 'all',
      subject: 'AION Alerta: {{alert_name}} — {{severity}}',
      body: 'Se ha generado una nueva alerta:\n\nTipo: {{alert_name}}\nSeveridad: {{severity}}\nSitio: {{site_name}}\nDispositivo: {{device_name}}\nFecha: {{created_at}}\n\nAcceda al sistema para mas detalles.',
      variables: ['alert_name', 'severity', 'site_name', 'device_name', 'created_at'],
    },
    {
      name: 'Incidente creado',
      desc: 'Notificacion al crear un nuevo incidente de seguridad',
      category: 'incident',
      channel: 'all',
      subject: 'AION Incidente #{{incident_id}}: {{title}}',
      body: 'Se ha registrado un nuevo incidente:\n\nID: {{incident_id}}\nTitulo: {{title}}\nPrioridad: {{priority}}\nSitio: {{site_name}}\nReportado por: {{reported_by}}\n\nResponda dentro del SLA establecido.',
      variables: ['incident_id', 'title', 'priority', 'site_name', 'reported_by'],
    },
    {
      name: 'Cambio de turno',
      desc: 'Recordatorio de inicio y fin de turno para guardias',
      category: 'shift',
      channel: 'push',
      subject: 'Cambio de turno: {{shift_name}}',
      body: 'Recordatorio de turno:\n\nTurno: {{shift_name}}\nHorario: {{start_time}} - {{end_time}}\nSitio: {{site_name}}\nGuardia entrante: {{guard_name}}\n\nRecuerde realizar el check-in al llegar.',
      variables: ['shift_name', 'start_time', 'end_time', 'site_name', 'guard_name'],
    },
    {
      name: 'Dispositivo offline',
      desc: 'Notificacion cuando un dispositivo pierde conexion',
      category: 'system',
      channel: 'email',
      subject: 'AION: Dispositivo {{device_name}} offline',
      body: 'El dispositivo {{device_name}} ({{device_type}}) en {{site_name}} ha perdido conexion.\n\nUltima conexion: {{last_seen}}\nDuracion offline: {{offline_duration}}\n\nSe recomienda verificar conectividad de red.',
      variables: ['device_name', 'device_type', 'site_name', 'last_seen', 'offline_duration'],
    },
  ];

  for (const t of templates) {
    await client.query(
      `INSERT INTO notification_templates (tenant_id, name, description, category, channel, subject, body_template, variables, is_system)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, true)`,
      [tenantId, t.name, t.desc, t.category, t.channel, t.subject, t.body, JSON.stringify(t.variables)]
    );
  }
  return done(table, templates.length);
}

async function seedNotificationChannels(client, tenantId) {
  const table = 'notification_channels';
  if (await hasData(client, table, tenantId)) return skip(table);

  const channels = [
    {
      name: 'Email — Equipo de Operaciones',
      type: 'email',
      config: { recipients: ['operaciones@claveseg.co', 'supervisor@claveseg.co'], smtpHost: 'smtp.claveseg.co', description: 'Canal de correo electronico para alertas operativas' },
    },
    {
      name: 'Push — Notificaciones del Navegador',
      type: 'push',
      config: { description: 'Notificaciones push del navegador para operadores en turno' },
    },
    {
      name: 'WhatsApp — Alertas Criticas',
      type: 'whatsapp',
      config: { phones: ['+573001234567', '+573019876543'], templateName: 'alerta_critica', description: 'Mensajes WhatsApp Business para emergencias y alertas criticas' },
    },
  ];

  for (const ch of channels) {
    await client.query(
      `INSERT INTO notification_channels (tenant_id, name, type, config, is_active)
       VALUES ($1, $2, $3, $4::jsonb, true)`,
      [tenantId, ch.name, ch.type, JSON.stringify(ch.config)]
    );
  }
  return done(table, channels.length);
}

async function seedComplianceTemplates(client, tenantId) {
  const table = 'compliance_templates';
  if (await hasData(client, table, tenantId)) return skip(table);

  const templates = [
    {
      name: 'Autorizacion Habeas Data (Ley 1581 de 2012)',
      type: 'habeas_data',
      content: `AUTORIZACION PARA EL TRATAMIENTO DE DATOS PERSONALES

De conformidad con la Ley 1581 de 2012 y el Decreto 1377 de 2013, autorizo a CLAVE SEGURIDAD CTA, identificada con NIT XXXXXXXXX, para recolectar, almacenar, usar, circular, suprimir y en general tratar mis datos personales, incluyendo datos biometricos y de video vigilancia, con las siguientes finalidades:

1. Gestion de seguridad y vigilancia del inmueble
2. Control de acceso de personas y vehiculos
3. Registro de visitantes y contratistas
4. Atencion de emergencias e incidentes de seguridad
5. Cumplimiento de obligaciones contractuales

El titular de los datos podra ejercer sus derechos de conocer, actualizar, rectificar y suprimir sus datos personales mediante solicitud escrita al correo: protecciondatos@claveseg.co

Fecha: _______________    Firma: _______________
Nombre: _______________   Documento: _______________`,
      version: 1,
    },
    {
      name: 'Auditoria Mensual de Seguridad',
      type: 'monthly_audit',
      content: `INFORME DE AUDITORIA MENSUAL DE SEGURIDAD

Periodo: {{month}} {{year}}
Sitio: {{site_name}}
Auditor: {{auditor_name}}

1. RESUMEN EJECUTIVO
   - Total de eventos: ___
   - Incidentes criticos: ___
   - Tiempo promedio de respuesta: ___
   - Cumplimiento SLA: ___%

2. ESTADO DE DISPOSITIVOS
   - Camaras operativas: ___ / ___
   - Dispositivos de acceso: ___ / ___
   - Uptime promedio: ___%

3. TURNOS Y PERSONAL
   - Turnos completados: ___
   - Rondas realizadas vs programadas: ___ / ___
   - Novedades reportadas: ___

4. OBSERVACIONES Y RECOMENDACIONES
   _______________

5. PLAN DE ACCION
   _______________

Firma auditor: _______________
Fecha: _______________`,
      version: 1,
    },
    {
      name: 'Revision de Incidentes de Seguridad',
      type: 'incident_review',
      content: `FORMATO DE REVISION DE INCIDENTE DE SEGURIDAD

Numero de incidente: {{incident_id}}
Fecha del incidente: {{incident_date}}
Sitio: {{site_name}}
Reportado por: {{reported_by}}

1. DESCRIPCION DEL INCIDENTE
   _______________

2. CRONOLOGIA DE HECHOS
   Hora de deteccion: ___
   Hora de respuesta: ___
   Hora de resolucion: ___

3. EVIDENCIA RECOPILADA
   [ ] Video de camaras
   [ ] Fotografias
   [ ] Declaraciones de testigos
   [ ] Registros del sistema

4. ANALISIS DE CAUSA RAIZ
   _______________

5. ACCIONES CORRECTIVAS
   _______________

6. LECCIONES APRENDIDAS
   _______________

Revisado por: _______________
Cargo: _______________
Fecha de revision: _______________`,
      version: 1,
    },
  ];

  for (const t of templates) {
    await client.query(
      `INSERT INTO compliance_templates (tenant_id, name, type, content, version, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, true, $6)`,
      [tenantId, t.name, t.type, t.content, t.version, SYSTEM_USER]
    );
  }
  return done(table, templates.length);
}

async function seedTrainingPrograms(client, tenantId) {
  const table = 'training_programs';
  if (await hasData(client, table, tenantId)) return skip(table);

  const programs = [
    {
      name: 'Vigilancia Basica y Protocolos de Seguridad',
      desc: 'Formacion fundamental para todo el personal de seguridad, cubriendo procedimientos de control de acceso, rondas de vigilancia y manejo de bitacora',
      category: 'security',
      durationHours: 16,
      isRequired: true,
      validityMonths: 12,
      passingScore: 80,
      content: [
        { module: 1, title: 'Marco legal de la vigilancia privada en Colombia', hours: 2 },
        { module: 2, title: 'Control de acceso y verificacion de identidad', hours: 3 },
        { module: 3, title: 'Rondas de vigilancia y tecnicas de observacion', hours: 3 },
        { module: 4, title: 'Manejo de bitacora y reportes', hours: 2 },
        { module: 5, title: 'Uso del sistema AION Vision Hub', hours: 4 },
        { module: 6, title: 'Evaluacion final teorico-practica', hours: 2 },
      ],
    },
    {
      name: 'Respuesta a Emergencias y Primeros Auxilios',
      desc: 'Capacitacion en protocolos de emergencia, evacuacion, primeros auxilios basicos y manejo de extintores',
      category: 'emergency',
      durationHours: 8,
      isRequired: true,
      validityMonths: 6,
      passingScore: 85,
      content: [
        { module: 1, title: 'Protocolos de emergencia: incendio, sismo, intrusion', hours: 2 },
        { module: 2, title: 'Primeros auxilios basicos y RCP', hours: 3 },
        { module: 3, title: 'Manejo de extintores y sistemas contra incendio', hours: 1.5 },
        { module: 4, title: 'Simulacro practico de evacuacion', hours: 1.5 },
      ],
    },
    {
      name: 'Operacion de Video Monitoreo y CCTV',
      desc: 'Entrenamiento en operacion de sistemas de video vigilancia, deteccion de anomalias y gestion de grabaciones',
      category: 'monitoring',
      durationHours: 12,
      isRequired: false,
      validityMonths: 12,
      passingScore: 75,
      content: [
        { module: 1, title: 'Fundamentos de CCTV: camaras IP, NVR, protocolos', hours: 2 },
        { module: 2, title: 'Uso de la plataforma AION: vista en vivo y playback', hours: 3 },
        { module: 3, title: 'Deteccion de anomalias y patrones sospechosos', hours: 2 },
        { module: 4, title: 'Gestion de grabaciones y extraccion de evidencia', hours: 2 },
        { module: 5, title: 'Mantenimiento basico de camaras y conectividad', hours: 1.5 },
        { module: 6, title: 'Ejercicio practico con escenarios reales', hours: 1.5 },
      ],
    },
  ];

  for (const p of programs) {
    await client.query(
      `INSERT INTO training_programs (tenant_id, name, description, category, duration_hours, is_required, validity_months, passing_score, content, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, true, $10)`,
      [tenantId, p.name, p.desc, p.category, p.durationHours, p.isRequired, p.validityMonths, p.passingScore, JSON.stringify(p.content), SYSTEM_USER]
    );
  }
  return done(table, programs.length);
}

async function seedContracts(client, tenantId) {
  const table = 'contracts';
  if (await hasData(client, table, tenantId)) return skip(table);

  // Pick two sites
  const siteRows = await client.query(
    `SELECT id, name FROM sites WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at LIMIT 2`,
    [tenantId]
  );
  const site1 = siteRows.rows[0]?.id || null;
  const site2 = siteRows.rows[1]?.id || site1;

  const contracts = [
    {
      siteId: site1,
      number: 'CLAVE-2026-001',
      clientName: 'Conjunto Residencial Torre Lucia P.H.',
      clientDoc: '901234567-1',
      clientEmail: 'admin@torrelucia.co',
      clientPhone: '+573004567890',
      type: 'annual',
      status: 'active',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      monthlyAmount: 8500000,
      services: [
        { name: 'Vigilancia 24/7 (3 turnos)', monthly: 6000000 },
        { name: 'Monitoreo CCTV remoto', monthly: 1500000 },
        { name: 'Control de acceso vehicular', monthly: 500000 },
        { name: 'Mantenimiento preventivo camaras', monthly: 500000 },
      ],
      paymentTerms: 'net_30',
      autoRenew: true,
      notes: 'Contrato anual con renovacion automatica. Incluye 15 camaras IP y 2 puntos de acceso vehicular.',
    },
    {
      siteId: site2,
      number: 'CLAVE-2026-002',
      clientName: 'Edificio San Nicolas Oficinas',
      clientDoc: '900987654-3',
      clientEmail: 'gerencia@sannicolas.co',
      clientPhone: '+573017654321',
      type: 'monthly',
      status: 'active',
      startDate: '2026-03-01',
      endDate: '2027-02-28',
      monthlyAmount: 5200000,
      services: [
        { name: 'Vigilancia diurna (2 turnos)', monthly: 3500000 },
        { name: 'Monitoreo CCTV remoto', monthly: 1200000 },
        { name: 'Rondas nocturnas', monthly: 500000 },
      ],
      paymentTerms: 'net_15',
      autoRenew: false,
      notes: 'Contrato mensual para edificio de oficinas. 8 camaras IP y control de acceso biometrico.',
    },
  ];

  for (const c of contracts) {
    await client.query(
      `INSERT INTO contracts (tenant_id, site_id, contract_number, client_name, client_document, client_email, client_phone,
                              type, status, start_date, end_date, monthly_amount, currency, services, payment_terms, auto_renew, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'COP', $13::jsonb, $14, $15, $16, $17)`,
      [tenantId, c.siteId, c.number, c.clientName, c.clientDoc, c.clientEmail, c.clientPhone,
       c.type, c.status, c.startDate, c.endDate, c.monthlyAmount,
       JSON.stringify(c.services), c.paymentTerms, c.autoRenew, c.notes, SYSTEM_USER]
    );
  }
  return done(table, contracts.length);
}

async function seedKeyInventory(client, tenantId) {
  const table = 'key_inventory';
  if (await hasData(client, table, tenantId)) return skip(table);

  const siteRow = await client.query(
    `SELECT id FROM sites WHERE tenant_id = $1 AND status = 'active' ORDER BY created_at LIMIT 1`,
    [tenantId]
  );
  const siteId = siteRow.rows[0]?.id || null;

  const keys = [
    { code: 'LLV-MAESTRA-001', label: 'Llave Maestra General',       type: 'master',    status: 'in_use',    holder: 'Carlos Andres Mejia', location: 'Porteria principal', copies: 2, desc: 'Abre todas las puertas del edificio. Acceso restringido a supervisor.' },
    { code: 'LLV-EMERG-001',   label: 'Llave Salida de Emergencia', type: 'emergency', status: 'available', holder: null,                  location: 'Caja de seguridad porteria', copies: 3, desc: 'Para puertas de emergencia pisos 1-5. Sellada con precinto numerado.' },
    { code: 'LLV-SERVER-001',  label: 'Llave Cuarto de Servidores', type: 'access',    status: 'in_use',    holder: 'Jorge Luis Hernandez', location: 'Piso 3 — cuarto tecnico', copies: 1, desc: 'Acceso al cuarto de telecomunicaciones y rack de red.' },
    { code: 'LLV-BODEGA-001',  label: 'Llave Bodega de Almacen',   type: 'access',    status: 'available', holder: null,                  location: 'Porteria principal', copies: 2, desc: 'Bodega de suministros y equipos de mantenimiento.' },
    { code: 'LLV-PARQ-001',    label: 'Llave Puerta Parqueadero',  type: 'access',    status: 'in_use',    holder: 'Guardia de turno',    location: 'Caseta parqueadero', copies: 2, desc: 'Puerta manual del parqueadero para uso en caso de falla electrica.' },
  ];

  for (const k of keys) {
    await client.query(
      `INSERT INTO key_inventory (tenant_id, site_id, key_code, label, description, key_type, status, current_holder, location, copies)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [tenantId, siteId, k.code, k.label, k.desc, k.type, k.status, k.holder, k.location, k.copies]
    );
  }
  return done(table, keys.length);
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

async function hasData(client, table, tenantId) {
  try {
    const res = await client.query(
      `SELECT 1 FROM ${table} WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    return res.rows.length > 0;
  } catch (err) {
    // Table may not exist
    console.log(`  [WARN] Table "${table}" query failed: ${err.message}`);
    return true; // skip if table doesn't exist
  }
}

function skip(table) {
  console.log(`  SKIP  ${table} (already has data)`);
  return { table, action: 'skipped' };
}

function done(table, count) {
  console.log(`  INSERT ${table}: ${count} rows`);
  return { table, action: 'inserted', count };
}

// ═══════════════════════════════════════════════════════════════════════════
// Ordered seed pipeline
// ═══════════════════════════════════════════════════════════════════════════

const SEED_STEPS = [
  seedShifts,
  seedShiftAssignments,
  seedAlertRules,
  seedEmergencyProtocols,
  seedEmergencyContacts,
  seedPatrolRoutes,
  seedPatrolCheckpoints,
  seedSlaDefinitions,
  seedAutomationRules,
  seedNotificationTemplates,
  seedNotificationChannels,
  seedComplianceTemplates,
  seedTrainingPrograms,
  seedContracts,
  seedKeyInventory,
];

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

async function seedDatabase(dbConfig) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Database: ${dbConfig.label}`);
  console.log(`  Tenant:   ${dbConfig.tenantId}`);
  console.log(`${'='.repeat(60)}\n`);

  const pool = new Pool({ connectionString: dbConfig.connectionString, max: 3 });
  const client = await pool.connect();

  try {
    // Verify connection
    const res = await client.query('SELECT current_database() AS db, now() AS ts');
    console.log(`  Connected to ${res.rows[0].db} at ${res.rows[0].ts}\n`);

    for (const step of SEED_STEPS) {
      try {
        await step(client, dbConfig.tenantId);
      } catch (err) {
        console.log(`  [ERROR] ${step.name}: ${err.message}`);
      }
    }

    // Print summary counts
    console.log(`\n  --- Row counts after seeding ---`);
    for (const step of SEED_STEPS) {
      const tableName = step.name.replace('seed', '').replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
      // Map function names to actual table names
      const tableMap = {
        'shifts': 'shifts',
        'shift_assignments': 'shift_assignments',
        'alert_rules': 'alert_rules',
        'emergency_protocols': 'emergency_protocols',
        'emergency_contacts': 'emergency_contacts',
        'patrol_routes': 'patrol_routes',
        'patrol_checkpoints': 'patrol_checkpoints',
        'sla_definitions': 'sla_definitions',
        'automation_rules': 'automation_rules',
        'notification_templates': 'notification_templates',
        'notification_channels': 'notification_channels',
        'compliance_templates': 'compliance_templates',
        'training_programs': 'training_programs',
        'contracts': 'contracts',
        'key_inventory': 'key_inventory',
      };
      const actual = tableMap[tableName] || tableName;
      try {
        const countRes = await client.query(
          `SELECT count(*) AS cnt FROM ${actual} WHERE tenant_id = $1`,
          [dbConfig.tenantId]
        );
        console.log(`  ${actual.padEnd(25)} ${countRes.rows[0].cnt} rows`);
      } catch (_) {
        console.log(`  ${actual.padEnd(25)} (table not found)`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  console.log('============================================================');
  console.log('  AION Vision Hub — Seed Empty Modules');
  console.log('  Date: ' + new Date().toISOString());
  console.log('============================================================');

  for (const db of DATABASES) {
    try {
      await seedDatabase(db);
    } catch (err) {
      console.error(`\n  [FATAL] ${db.label}: ${err.message}\n`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
