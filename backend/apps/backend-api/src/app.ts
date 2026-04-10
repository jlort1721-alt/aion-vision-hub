import Fastify from 'fastify';
import cors from '@fastify/cors';

import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { createLoggerConfig } from '@aion/common-utils';
import { config } from './config/env.js';
import authPlugin from './plugins/auth.js';
import tenantPlugin from './plugins/tenant.js';
import auditPlugin from './plugins/audit.js';
import eventEmitterPlugin from './plugins/event-emitter.js';
import { registerErrorHandler } from './middleware/error-handler.js';
import { registerRequestId } from './middleware/request-id.js';
import { registerRateLimiter } from './middleware/rate-limiter.js';
import { httpRequestDuration, httpRequestsTotal } from './lib/metrics.js';

// Module routes
import { registerHealthRoutes } from './modules/health/routes.js';
import { registerAuthRoutes } from './modules/auth/routes.js';
import { registerTenantRoutes } from './modules/tenants/routes.js';
import { registerUserRoutes } from './modules/users/routes.js';
import { registerRoleRoutes } from './modules/roles/routes.js';
import { registerDeviceRoutes } from './modules/devices/routes.js';
import { registerCamerasRoutes } from './modules/cameras/routes.js';
import { registerCameraEventRoutes } from './modules/camera-events/routes.js';
import { registerOperationalDataRoutes } from './modules/operational-data/routes.js';
import { registerVisitorPreregistrationRoutes } from './modules/visitor-preregistration/routes.js';
import { registerSiteRoutes } from './modules/sites/routes.js';
import { registerStreamRoutes } from './modules/streams/routes.js';
import { registerEventRoutes } from './modules/events/routes.js';
import { registerIncidentRoutes } from './modules/incidents/routes.js';
import { registerIntegrationRoutes } from './modules/integrations/routes.js';
import { registerAIBridgeRoutes } from './modules/ai-bridge/routes.js';
import { registerMCPBridgeRoutes } from './modules/mcp-bridge/routes.js';
import { registerReportRoutes } from './modules/reports/routes.js';
import { registerAuditRoutes } from './modules/audit/routes.js';
import { registerDomoticRoutes } from './modules/domotics/routes.js';
import { registerAccessControlRoutes } from './modules/access-control/routes.js';
import { registerIntercomRoutes } from './modules/intercom/routes.js';
import { registerRebootRoutes } from './modules/reboots/routes.js';
import { registerDatabaseRecordRoutes } from './modules/database-records/routes.js';
import { registerWhatsAppRoutes } from './modules/whatsapp/routes.js';
import { registerWebhookRoutes } from './modules/whatsapp/webhook.js';
import { registerVoiceRoutes } from './modules/voice/routes.js';
import { registerEmailRoutes } from './modules/email/routes.js';
import { registerEWeLinkRoutes } from './modules/ewelink/routes.js';
import { registerAlertRoutes } from './modules/alerts/routes.js';
import { registerNotificationTemplateRoutes } from './modules/notification-templates/routes.js';
import { registerShiftRoutes } from './modules/shifts/routes.js';
import { registerSLARoutes } from './modules/sla/routes.js';
import { registerEmergencyRoutes } from './modules/emergency/routes.js';
import { registerPatrolRoutes } from './modules/patrols/routes.js';
import { registerScheduledReportRoutes } from './modules/scheduled-reports/routes.js';
import { registerAutomationRoutes } from './modules/automation/routes.js';
import { registerVisitorRoutes } from './modules/visitors/routes.js';
import { registerAnalyticsRoutes } from './modules/analytics/routes.js';
import { registerPushRoutes } from './modules/push/routes.js';
import { registerContractRoutes } from './modules/contracts/routes.js';
import { registerKeyRoutes } from './modules/keys/routes.js';
import { registerComplianceRoutes } from './modules/compliance/routes.js';
import { registerTrainingRoutes } from './modules/training/routes.js';
import { registerBackupRoutes } from './modules/backup/routes.js';
import { registerCloudAccountRoutes } from './modules/cloud-accounts/routes.js';
import { registerCloudPlatformRoutes } from './modules/cloud-accounts/cloud-routes.js';
import { registerExtensionRoutes } from './modules/extensions/routes.js';
import { registerOperationsRoutes } from './modules/operations/routes.js';
import { biomarkerRoutes } from './modules/biomarkers/routes.js';
import { registerLprRoutes } from './modules/lpr/routes.js';
import { registerRelayRoutes } from './modules/relay/routes.js';
import { registerZktecoRoutes } from './modules/zkteco/routes.js';
import { registerDeviceControlRoutes } from './modules/device-control/routes.js';
import { registerNetworkRoutes } from './modules/network/routes.js';
import { registerApiKeyRoutes } from './modules/api-keys/routes.js';
import { registerEvidenceRoutes } from './modules/evidence/routes.js';
import { registerDataImportRoutes } from './modules/data-import/routes.js';
import { registerGdprRoutes } from './modules/gdpr/routes.js';
import { registerAnomalyDetectionRoutes } from './modules/anomaly-detection/routes.js';
import { registerKnowledgeBaseRoutes } from './modules/knowledge-base/routes.js';
import { registerInternalAgentRoutes } from './modules/internal-agent/routes.js';
import { internalAgent } from './modules/internal-agent/service.js';
import { registerClaveBridgeRoutes } from './modules/clave-bridge/routes.js';
import { registerLiveViewRoutes } from './modules/live-view/routes.js';
import { registerProvisioningRoutes } from './modules/provisioning/routes.js';
import { registerImouRoutes } from './modules/imou/routes.js';
import { registerHikConnectRoutes } from './modules/hikconnect/routes.js';
import { registerFaceRecognitionRoutes } from './modules/face-recognition/routes.js';
import { registerHeatMappingRoutes } from './modules/heat-mapping/routes.js';
import { registerTwilioRoutes, registerTwilioWebhookRoutes } from './modules/twilio/routes.js';
import { registerNoteRoutes } from './modules/notes/routes.js';
import { registerCameraDetectionRoutes } from './modules/camera-detections/routes.js';
import { registerSceneRoutes } from './modules/scenes/routes.js';
import { registerPagingRoutes } from './modules/paging/routes.js';
import { registerRemoteAccessRoutes } from './modules/remote-access/routes.js';
import { registerFloorPlanRoutes } from './modules/floor-plans/routes.js';
import { registerClipRoutes } from './modules/clips/routes.js';
import { registerPlaybackRoutes } from './modules/playback/routes.js';
import { registerOperatorAssignmentRoutes } from './modules/operator-assignments/routes.js';
import websocketPlugin from './plugins/websocket.js';
import { cameraEvents } from './services/camera-events.js';
import { imouEventPoller } from './services/imou-event-poller.js';
import { imouStreamManager } from './services/imou-stream-manager.js';
import { twilioNotificationWorker } from './workers/twilio-notifications.js';

const loggerOpts = { name: 'aion-api', level: config.LOG_LEVEL };

export async function buildApp() {
  const app = Fastify({
    logger: createLoggerConfig(loggerOpts),
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
    bodyLimit: 15 * 1024 * 1024, // 15 MB — supports file uploads
  }).withTypeProvider<ZodTypeProvider>();

  // Add Zod validation/serialization compilers BEFORE registering routes
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Swagger OpenAPI Autogeneration
  await app.register(swagger, {
    openapi: {
      info: { title: 'AION Vision Hub API', description: 'Enterprise VMS and IoT Core Engine', version: '1.0.0' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
        }
      }
    }
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'none', deepLinking: false }
  });

  // CORS
  await app.register(cors, {
    origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Tenant-Id'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    maxAge: 86400,
  });

  // Response compression
  try {
    // @ts-ignore — package may not be installed locally
    const compress = await import('@fastify/compress');
    await app.register(compress.default, { global: true, threshold: 1024 });
  } catch { /* @fastify/compress not installed */ }

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "wss:", ...config.CORS_ORIGINS.split(',').map((o) => o.trim())],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    xFrameOptions: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  // Permissions-Policy header (not supported by helmet — set manually)
  app.addHook('onSend', (_request, reply, _payload, done) => {
    reply.header(
      'Permissions-Policy',
      'camera=(self), microphone=(self), geolocation=(self), fullscreen=(self), payment=(), usb=()',
    );
    done();
  });

  // JWT — explicit algorithm to prevent 'alg: none' attacks
  await app.register(jwt as any, {
    secret: config.JWT_SECRET,
    sign: { algorithm: 'HS256', issuer: config.JWT_ISSUER, expiresIn: config.JWT_EXPIRATION },
    verify: { algorithms: ['HS256'], issuer: config.JWT_ISSUER },
  });

  // Middleware
  registerErrorHandler(app);
  registerRequestId(app);
  await registerRateLimiter(app);

  // Request metrics hook
  app.addHook('onResponse', (request, reply, done) => {
    const route = request.routeOptions?.url ?? request.url;
    const labels = { method: request.method, route, status_code: reply.statusCode.toString() };
    httpRequestDuration.observe(labels, reply.elapsedTime / 1000);
    httpRequestsTotal.inc(labels);
    done();
  });

  // Plugins (order matters: auth → tenant → audit)
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(auditPlugin);
  await app.register(eventEmitterPlugin);

  // Routes (health first — no auth required)
  await app.register(registerHealthRoutes, { prefix: '/health' });
  await app.register(registerAuthRoutes, { prefix: '/auth' });
  await app.register(registerTenantRoutes, { prefix: '/tenants' });
  await app.register(registerUserRoutes, { prefix: '/users' });
  await app.register(registerRoleRoutes, { prefix: '/roles' });
  await app.register(biomarkerRoutes, { prefix: '/analytics/biomarkers' });
  await app.register(registerDeviceRoutes, { prefix: '/devices' });
  await app.register(registerCamerasRoutes, { prefix: '/cameras' });
  await app.register(registerCameraEventRoutes, { prefix: '/camera-events' });
  await app.register(registerOperationalDataRoutes, { prefix: '/operational-data' });
  await app.register(registerVisitorPreregistrationRoutes, { prefix: '/pre-registrations' });
  await app.register(registerSiteRoutes, { prefix: '/sites' });
  await app.register(registerStreamRoutes, { prefix: '/streams' });
  await app.register(registerEventRoutes, { prefix: '/events' });
  await app.register(registerIncidentRoutes, { prefix: '/incidents' });
  await app.register(registerIntegrationRoutes, { prefix: '/integrations' });
  await app.register(registerAIBridgeRoutes, { prefix: '/ai' });
  await app.register(registerMCPBridgeRoutes, { prefix: '/mcp' });
  await app.register(registerReportRoutes, { prefix: '/reports' });
  await app.register(registerAuditRoutes, { prefix: '/audit' });
  await app.register(registerDomoticRoutes, { prefix: '/domotics' });
  await app.register(registerAccessControlRoutes, { prefix: '/access-control' });
  await app.register(registerIntercomRoutes, { prefix: '/intercom' });
  await app.register(registerRebootRoutes, { prefix: '/reboots' });
  await app.register(registerDatabaseRecordRoutes, { prefix: '/database-records' });
  await app.register(registerWhatsAppRoutes, { prefix: '/whatsapp' });
  await app.register(registerVoiceRoutes, { prefix: '/voice' });
  await app.register(registerEmailRoutes, { prefix: '/email' });
  await app.register(registerEWeLinkRoutes, { prefix: '/ewelink' });

  // Alert system
  await app.register(registerAlertRoutes, { prefix: '/alerts' });
  await app.register(registerNotificationTemplateRoutes, { prefix: '/notification-templates' });

  // Phase 2: Operations modules
  await app.register(registerShiftRoutes, { prefix: '/shifts' });
  await app.register(registerSLARoutes, { prefix: '/sla' });
  await app.register(registerEmergencyRoutes, { prefix: '/emergency' });
  await app.register(registerPatrolRoutes, { prefix: '/patrols' });
  await app.register(registerScheduledReportRoutes, { prefix: '/scheduled-reports' });

  // Phase 3: Automation, Visitors, Analytics, Push
  await app.register(registerAutomationRoutes, { prefix: '/automation' });
  await app.register(registerVisitorRoutes, { prefix: '/visitors' });
  await app.register(registerAnalyticsRoutes, { prefix: '/analytics' });
  await app.register(registerPushRoutes, { prefix: '/push' });

  // Phase 4: Contracts, Keys, Compliance, Training
  await app.register(registerContractRoutes, { prefix: '/contracts' });
  await app.register(registerKeyRoutes, { prefix: '/keys' });
  await app.register(registerComplianceRoutes, { prefix: '/compliance' });
  await app.register(registerTrainingRoutes, { prefix: '/training' });

  // Backup management
  await app.register(registerBackupRoutes, { prefix: '/backup' });

  // Cloud account mapping & validation
  await app.register(registerCloudAccountRoutes, { prefix: '/cloud-accounts' });
  // Cloud platform integrations (Hik-Connect, DMSS/IMOU)
  await app.register(registerCloudPlatformRoutes, { prefix: '/cloud' });
  // Voice extensions (ElevenLabs TTS greetings/announcements)
  await app.register(registerExtensionRoutes, { prefix: '/extensions' });

  // Operations dashboard (consolidated overview)
  await app.register(registerOperationsRoutes, { prefix: '/operations' });

  // LPR (License Plate Recognition)
  await app.register(registerLprRoutes, { prefix: '/lpr' });
  // Universal relay control (eWeLink, HTTP, GPIO, ZKTeco, Hikvision, Dahua)
  await app.register(registerRelayRoutes, { prefix: '/relay' });
  // ZKTeco access control panels
  await app.register(registerZktecoRoutes, { prefix: '/zkteco' });
  // Universal device control (auto-detect + execute any command)
  await app.register(registerDeviceControlRoutes, { prefix: '/device-control' });
  // Network scanner, VPN profiles, diagnostics
  await app.register(registerNetworkRoutes, { prefix: '/network' });
  // Remote access proxy (HTTP reverse proxy, connectivity testing, port forwarding)
  await app.register(registerRemoteAccessRoutes, { prefix: '/remote-access' });
  // API key management (service-to-service authentication)
  await app.register(registerApiKeyRoutes, { prefix: '/api-keys' });
  // Evidence pipeline (snapshots, clips, documents, notes attached to incidents)
  await app.register(registerEvidenceRoutes, { prefix: '/evidence' });
  // Bulk data import (residents, vehicles, visitors, devices)
  await app.register(registerDataImportRoutes, { prefix: '/data-import' });
  // GDPR / Data Privacy (export, delete, consents, audit integrity)
  await app.register(registerGdprRoutes, { prefix: '/gdpr' });
  // Anomaly detection (AI-powered pattern analysis)
  await app.register(registerAnomalyDetectionRoutes, { prefix: '/anomalies' });
  // Knowledge base (RAG pipeline for AION AI agent)
  await app.register(registerKnowledgeBaseRoutes, { prefix: '/knowledge' });

  // Internal monitoring agent (background health checks)
  await app.register(registerInternalAgentRoutes, { prefix: '/internal-agent' });

  // Live view layout persistence
  await app.register(registerLiveViewRoutes, { prefix: '/live-view' });

  // IMOU / Dahua Cloud API (P2P cloud relay for XVR devices)
  await app.register(registerImouRoutes, { prefix: '/imou' });

  // Hik-Connect P2P Cloud Streaming (requires tpp.hikvision.com AK/SK)
  await app.register(registerHikConnectRoutes, { prefix: '/hikconnect' });

  // Face Recognition Framework (CodeProject.AI / DeepStack / Frigate)
  await app.register(registerFaceRecognitionRoutes, { prefix: '/face-recognition' });

  // Heat Mapping — Traffic analysis and zone activity visualization
  await app.register(registerHeatMappingRoutes, { prefix: '/analytics/heatmap' });

  // Floor Plans — Upload and manage site floor plan images
  await app.register(registerFloorPlanRoutes, { prefix: '/floor-plans' });
  // Video Clips — Export and download camera recording clips
  await app.register(registerClipRoutes, { prefix: '/clips' });
  // Playback — Camera recording playback (ranges + stream URLs)
  await app.register(registerPlaybackRoutes, { prefix: '/playback' });
  // Operator Site Assignments — Assign operators to specific sites
  await app.register(registerOperatorAssignmentRoutes, { prefix: '/operator-assignments' });

  // Operational Notes — operator notes, shift handoffs, observations
  await app.register(registerNoteRoutes, { prefix: '/notes' });

  // Phase 5: Detection analytics, domotic scenes, paging
  await app.register(registerCameraDetectionRoutes, { prefix: '/camera-detections' });
  await app.register(registerSceneRoutes, { prefix: '/scenes' });
  await app.register(registerPagingRoutes, { prefix: '/paging' });

  // Twilio — WhatsApp, SMS, Voice calls (Colombian PSTN via Twilio)
  await app.register(registerTwilioRoutes, { prefix: '/twilio' });

  // CLAVE bidirectional bridge (voice commands, event push, status)
  await app.register(registerClaveBridgeRoutes, { prefix: '/clave' });

  // Fanvil SIP phone auto-provisioning (no JWT — phones can't authenticate)
  await app.register(registerProvisioningRoutes, { prefix: '/provisioning' });

  // Public webhook routes (no JWT — Meta sends requests without auth)
  await app.register(registerWebhookRoutes, { prefix: '/webhooks/whatsapp' });

  // Public Twilio webhook routes (no JWT — Twilio sends requests without auth)
  await app.register(registerTwilioWebhookRoutes, { prefix: '/webhooks/twilio' });

  // WebSocket for real-time updates (JWT via query param)
  await app.register(websocketPlugin);

  // ═══ Consolidated VPS Plugins (skills, VMS, wall, webhooks, platform) ═══
  const { registerVPSPlugins, registerWallSystem } = await import('./modules/vps-plugins/index.js');
  await registerVPSPlugins(app);
  await app.register(registerWallSystem, { prefix: '/wall-sys' });

  // Start internal monitoring agent (5 min interval)
  internalAgent.start(300000);

  // Start camera event poller (1 min interval)
  cameraEvents.start(60000);

  // Start IMOU cloud event poller (1 min interval, configurable via IMOU_POLL_INTERVAL_MS)
  imouEventPoller.start();

  // Start IMOU stream manager — maintains live HLS streams for all Dahua XVR via P2P Cloud
  // Refreshes every 20 min (URLs expire ~30min). Registers streams in go2rtc as da-{name}-ch{N}
  imouStreamManager.start();

  // Start Twilio scheduled notifications (15 min interval)
  twilioNotificationWorker.start(900_000);

  // Graceful shutdown
  app.addHook('onClose', async () => {
    internalAgent.stop();
    cameraEvents.stop();
    imouEventPoller.stop();
    imouStreamManager.stop();
    twilioNotificationWorker.stop();
  });

  return app;
}
