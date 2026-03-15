/**
 * Call Sessions Schema
 *
 * Extended call tracking with full session lifecycle,
 * AI/human mode tracking, visitor info, and access decisions.
 */

import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { intercomDevices } from './intercom.js';
import { sections } from './sections.js';

export const callSessions = pgTable('call_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').references(() => intercomDevices.id, { onDelete: 'set null' }),
  sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),

  // Call identification
  direction: text('direction').notNull().default('inbound'), // inbound | outbound
  status: text('status').notNull().default('initiating'),     // initiating | ringing | answered | on_hold | completed | missed | rejected | failed | busy
  mode: text('mode').notNull().default('ai'),                // ai | human | mixed
  sipCallId: text('sip_call_id'),                            // SIP Call-ID header

  // Participants
  callerUri: text('caller_uri').notNull().default(''),
  calleeUri: text('callee_uri').notNull().default(''),
  attendedBy: text('attended_by'),                           // operator username or 'aion-agent'

  // Timing
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationSeconds: integer('duration_seconds'),

  // AI / Greeting
  greetingText: text('greeting_text'),
  handoffOccurred: boolean('handoff_occurred').default(false),
  handoffReason: text('handoff_reason'),

  // Visitor info
  visitorName: text('visitor_name'),
  visitorDestination: text('visitor_destination'),
  dtmfCollected: text('dtmf_collected'),

  // Access control
  accessGranted: boolean('access_granted').default(false),

  // Recording & Notes
  recordingUrl: text('recording_url'),
  notes: text('notes'),

  // Full conversation log and metadata
  conversationLog: jsonb('conversation_log').default([]),
  metadata: jsonb('metadata').default({}),
});

export const voipConfig = pgTable('voip_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }).unique(),

  // SIP Server
  sipHost: text('sip_host'),
  sipPort: integer('sip_port').default(5060),
  sipTransport: text('sip_transport').default('udp'),       // udp | tcp | tls | wss
  sipDomain: text('sip_domain'),

  // PBX / ARI
  pbxType: text('pbx_type').default('none'),                // asterisk | freeswitch | freepbx | 3cx | cloud | none
  ariUrl: text('ari_url'),
  ariUsername: text('ari_username'),
  ariPassword: text('ari_password'),                        // encrypted in production

  // Orchestration defaults
  defaultMode: text('default_mode').default('mixed'),       // ai | human | mixed
  greetingContext: text('greeting_context').default('default'),
  greetingLanguage: text('greeting_language').default('es'),
  greetingVoiceId: text('greeting_voice_id'),
  aiTimeoutSeconds: integer('ai_timeout_seconds').default(15),
  doorOpenDtmf: text('door_open_dtmf').default('#'),
  autoOpenEnabled: boolean('auto_open_enabled').default(false),
  operatorExtension: text('operator_extension'),
  recordingEnabled: boolean('recording_enabled').default(false),

  // Fanvil-specific — no factory defaults; must be explicitly configured per tenant
  fanvilAdminUser: text('fanvil_admin_user'),
  fanvilAdminPassword: text('fanvil_admin_password'),
  autoProvisionEnabled: boolean('auto_provision_enabled').default(false),

  // ElevenLabs voice for intercom
  customSiteName: text('custom_site_name'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
