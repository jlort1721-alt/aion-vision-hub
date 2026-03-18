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
import { registerOperationsRoutes } from './modules/operations/routes.js';
import websocketPlugin from './plugins/websocket.js';

const loggerOpts = { name: 'aion-api', level: config.LOG_LEVEL };

export async function buildApp() {
  const app = Fastify({
    logger: createLoggerConfig(loggerOpts),
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
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
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "wss:", ...config.CORS_ORIGINS.split(',').map((o) => o.trim())],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
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

  // Routes (health first — no auth required)
  await app.register(registerHealthRoutes, { prefix: '/health' });
  await app.register(registerAuthRoutes, { prefix: '/auth' });
  await app.register(registerTenantRoutes, { prefix: '/tenants' });
  await app.register(registerUserRoutes, { prefix: '/users' });
  await app.register(registerRoleRoutes, { prefix: '/roles' });
  await app.register(registerDeviceRoutes, { prefix: '/devices' });
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

  // Operations dashboard (consolidated overview)
  await app.register(registerOperationsRoutes, { prefix: '/operations' });

  // Public webhook routes (no JWT — Meta sends requests without auth)
  await app.register(registerWebhookRoutes, { prefix: '/webhooks/whatsapp' });

  // WebSocket for real-time updates (JWT via query param)
  await app.register(websocketPlugin);

  return app;
}
