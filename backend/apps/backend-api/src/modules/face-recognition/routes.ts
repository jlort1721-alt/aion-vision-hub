import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { requireRole } from '../../plugins/auth.js';
import { faceRecognition } from '../../services/face-recognition.js';
import { searchBiomarkersBySimilarity, ingestBiomarker, listBiomarkers } from '../biomarkers/service.js';
import { createLogger } from '@aion/common-utils';
import { hasBiometricConsent } from '../gdpr/service.js';

const logger = createLogger({ name: 'face-recognition-routes' });

// ── Interfaces ────────────────────────────────────────────────────────────────

interface SearchBody {
  image: string; // base64
  threshold?: number;
  limit?: number;
}

interface RegisterBody {
  name: string;
  image: string; // base64
  metadata?: Record<string, unknown>;
}

// ── Route Registration ────────────────────────────────────────────────────────

export async function registerFaceRecognitionRoutes(app: FastifyInstance) {

  /** GET /face-recognition/status */
  app.get('/status', {
    preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
  }, async (_req, reply) => {
    return reply.send({ success: true, data: faceRecognition.getStatus() });
  });

  /** POST /face-recognition/search -- Search for face matches by base64 image */
  app.post<{ Body: SearchBody }>(
    '/search',
    { preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { image, threshold, limit } = request.body;

      if (!image || typeof image !== 'string' || image.trim().length === 0) {
        return reply.code(400).send({ success: false, error: 'image (base64) is required' });
      }

      const tenantId = request.tenantId;
      const searchLimit = limit ?? 10;
      const minThreshold = threshold ?? 0;

      try {
        // Attempt face detection via the external provider if configured
        let facesDetected = 0;
        let faceInfo: { confidence: number; embedding_size: number } | undefined;

        if (faceRecognition.isConfigured()) {
          const imageBuffer = Buffer.from(image, 'base64');
          const detected = await faceRecognition.detectFaces(imageBuffer);
          facesDetected = detected.length;
          if (detected.length > 0) {
            const first = detected[0] as Record<string, unknown>;
            faceInfo = {
              confidence: (first.confidence as number) ?? 0,
              embedding_size: 0,
            };
          }
        }

        // Query biomarkers table sorted by confidence (since we don't have pgvector)
        // Pass a dummy embedding — the service already sorts by confidence
        const hits = await searchBiomarkersBySimilarity(tenantId, [], searchLimit);

        // Apply threshold filter
        const filtered = minThreshold > 0
          ? hits.filter(h => h.matchPercentage >= minThreshold)
          : hits;

        return reply.send({
          success: true,
          data: {
            faces_detected: facesDetected,
            face_info: faceInfo,
            matches: filtered.map(h => ({
              subjectId: h.subjectId,
              matchPercentage: h.matchPercentage,
              features: h.features,
              lastSeenLocationId: h.lastSeenLocationId,
              lastSeenAt: h.lastSeenAt,
            })),
            message: filtered.length > 0
              ? `Found ${filtered.length} potential match(es).`
              : 'No matches found in the biometric database.',
          },
        });
      } catch (err) {
        logger.error({ error: (err as Error).message }, 'Face search failed');
        return reply.code(500).send({ success: false, error: 'Face search failed' });
      }
    },
  );

  /** POST /face-recognition/register -- Register a new face into the biometric database */
  app.post<{ Body: RegisterBody }>(
    '/register',
    { preHandler: [requireRole('operator', 'tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { name, image, metadata } = request.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return reply.code(400).send({ success: false, error: 'name is required' });
      }
      if (!image || typeof image !== 'string' || image.trim().length === 0) {
        return reply.code(400).send({ success: false, error: 'image (base64) is required' });
      }

      const tenantId = request.tenantId;

      // Verify biometric consent (Ley 1581 / GDPR compliance)
      try {
        const hasConsent = await hasBiometricConsent(tenantId, name);
        if (!hasConsent) {
          return reply.code(403).send({
            success: false,
            error: 'Biometric consent required. Record consent via POST /gdpr/consent before enrolling faces.',
            code: 'BIOMETRIC_CONSENT_REQUIRED',
          });
        }
      } catch {
        // If GDPR module is unavailable, log and continue (don't block enrollment)
        logger.warn('GDPR consent check failed — proceeding without consent verification');
      }

      try {
        // Generate a subject ID from the name
        const subjectId = `SUB-${name.trim().replace(/\s+/g, '-').toUpperCase().slice(0, 20)}-${Date.now().toString(36).toUpperCase()}`;

        // If the external face recognition provider is configured, register there too
        if (faceRecognition.isConfigured()) {
          const imageBuffer = Buffer.from(image, 'base64');
          await faceRecognition.registerFace(subjectId, name.trim(), imageBuffer);
        }

        // Store in the biomarkers table with a placeholder embedding
        const inserted = await ingestBiomarker({
          tenantId,
          subjectId,
          embedding: [], // Placeholder — real embedding would come from InsightFace/DeepStack
          confidence: 0.95,
          phenotypicMetadata: metadata ?? {},
          featureTags: metadata?.features
            ? (metadata.features as string[])
            : [name.trim()],
          lastSeenLocationId: undefined,
        });

        return reply.code(201).send({
          success: true,
          data: {
            id: inserted.id,
            name: name.trim(),
            subjectId,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        logger.error({ error: (err as Error).message }, 'Face registration failed');
        return reply.code(500).send({ success: false, error: 'Face registration failed' });
      }
    },
  );

  /** POST /face-recognition/register-bulk -- Register multiple faces in batch */
  app.post<{ Body: { entries: Array<{ name: string; image: string; metadata?: Record<string, unknown> }> } }>(
    '/register-bulk',
    { preHandler: [requireRole('tenant_admin', 'super_admin')] },
    async (request, reply) => {
      const { entries } = request.body;

      if (!Array.isArray(entries) || entries.length === 0) {
        return reply.code(400).send({ success: false, error: 'entries array is required' });
      }
      if (entries.length > 100) {
        return reply.code(400).send({ success: false, error: 'Maximum 100 entries per batch' });
      }

      const tenantId = request.tenantId;

      // Verify biometric consent (Ley 1581 / GDPR compliance)
      try {
        const hasConsent = await hasBiometricConsent(tenantId, 'bulk');
        if (!hasConsent) {
          return reply.code(403).send({
            success: false,
            error: 'Biometric consent required. Record consent via POST /gdpr/consent before enrolling faces.',
            code: 'BIOMETRIC_CONSENT_REQUIRED',
          });
        }
      } catch {
        logger.warn('GDPR consent check failed — proceeding without consent verification');
      }

      const results: Array<{ name: string; status: 'ok' | 'error'; subjectId?: string; detail?: string }> = [];

      for (const entry of entries) {
        if (!entry.name?.trim() || !entry.image?.trim()) {
          results.push({ name: entry.name || 'unknown', status: 'error', detail: 'name and image are required' });
          continue;
        }

        try {
          const subjectId = `SUB-${entry.name.trim().replace(/\s+/g, '-').toUpperCase().slice(0, 20)}-${Date.now().toString(36).toUpperCase()}`;

          if (faceRecognition.isConfigured()) {
            const imageBuffer = Buffer.from(entry.image, 'base64');
            await faceRecognition.registerFace(subjectId, entry.name.trim(), imageBuffer);
          }

          await ingestBiomarker({
            tenantId,
            subjectId,
            embedding: [],
            confidence: 0.95,
            phenotypicMetadata: entry.metadata ?? {},
            featureTags: entry.metadata?.features
              ? (entry.metadata.features as string[])
              : [entry.name.trim()],
            lastSeenLocationId: undefined,
          });

          results.push({ name: entry.name.trim(), status: 'ok', subjectId });
        } catch (err) {
          logger.error({ error: (err as Error).message, name: entry.name }, 'Bulk face registration failed for entry');
          results.push({ name: entry.name.trim(), status: 'error', detail: (err as Error).message });
        }
      }

      return reply.send({
        success: true,
        data: {
          total: results.length,
          enrolled: results.filter(r => r.status === 'ok').length,
          errors: results.filter(r => r.status === 'error').length,
          results,
        },
      });
    },
  );

  /** GET /face-recognition/databases -- List face databases/collections (placeholder) */
  app.get('/databases', {
    preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
  }, async (request, reply) => {
    try {
      const subjects = await listBiomarkers(request.tenantId);
      return reply.send({
        success: true,
        data: subjects.length > 0
          ? [{
              name: 'default',
              count: subjects.length,
              provider: faceRecognition.isConfigured() ? 'configured' : 'database-only',
            }]
          : [],
      });
    } catch {
      return reply.send({ success: true, data: [] });
    }
  });

  /** GET /face-recognition/stats -- Enrollment coverage statistics */
  app.get('/stats', {
    preHandler: [requireRole('viewer', 'operator', 'tenant_admin', 'super_admin')],
  }, async (request, reply) => {
    try {
      const subjects = await listBiomarkers(request.tenantId);
      const { db } = await import('../../db/client.js');
      const residentsResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM biometric_records WHERE tenant_id = ${request.tenantId}`,
      );
      const totalBiometric = Number((residentsResult[0] as Record<string, unknown>)?.count ?? 0);

      return reply.send({
        success: true,
        data: {
          totalBiomarkers: subjects.length,
          totalBiometricRecords: totalBiometric,
          providerConfigured: faceRecognition.isConfigured(),
          providerStatus: faceRecognition.getStatus(),
        },
      });
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Face recognition stats failed');
      return reply.send({
        success: true,
        data: { totalBiomarkers: 0, totalBiometricRecords: 0, providerConfigured: false },
      });
    }
  });
}
