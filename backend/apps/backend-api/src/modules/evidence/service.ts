import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { evidence } from '../../db/schema/evidence.js';
import { incidents } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';
import type {
  CreateEvidenceInput,
  CaptureSnapshotInput,
} from './schemas.js';

export class EvidenceService {
  /**
   * List all evidence for a given incident, scoped to tenant.
   */
  async list(incidentId: string, tenantId: string) {
    // Verify the incident belongs to this tenant
    const [incident] = await db
      .select({ id: incidents.id })
      .from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantId)))
      .limit(1);

    if (!incident) throw new NotFoundError('Incident', incidentId);

    const rows = await db
      .select()
      .from(evidence)
      .where(and(
        eq(evidence.incidentId, incidentId),
        eq(evidence.tenantId, tenantId),
      ))
      .orderBy(desc(evidence.createdAt));

    return rows;
  }

  /**
   * Create an evidence record manually (upload, note, etc.)
   */
  async create(data: CreateEvidenceInput, tenantId: string, userId: string) {
    // Verify the incident belongs to this tenant
    const [incident] = await db
      .select({ id: incidents.id })
      .from(incidents)
      .where(and(eq(incidents.id, data.incident_id), eq(incidents.tenantId, tenantId)))
      .limit(1);

    if (!incident) throw new NotFoundError('Incident', data.incident_id);

    const [record] = await db
      .insert(evidence)
      .values({
        tenantId,
        incidentId: data.incident_id,
        deviceId: data.device_id ?? null,
        type: data.type,
        fileUrl: data.file_url ?? null,
        thumbnailUrl: data.thumbnail_url ?? null,
        fileName: data.file_name ?? null,
        mimeType: data.mime_type ?? null,
        description: data.description ?? null,
        capturedAt: data.captured_at ? new Date(data.captured_at) : null,
        createdBy: userId,
      })
      .returning();

    return record;
  }

  /**
   * Capture a snapshot from a device and create an evidence record.
   *
   * In a production environment this would:
   * 1. Call the device adapter to take a snapshot (ONVIF / RTSP frame grab)
   * 2. Upload the resulting image to Supabase Storage
   * 3. Create an evidence record with the resulting URLs
   *
   * For now, we create the evidence record with a placeholder that the
   * gateway/adapter will update asynchronously.
   */
  async captureSnapshot(data: CaptureSnapshotInput, tenantId: string, userId: string) {
    // Verify the incident belongs to this tenant
    const [incident] = await db
      .select({ id: incidents.id })
      .from(incidents)
      .where(and(eq(incidents.id, data.incident_id), eq(incidents.tenantId, tenantId)))
      .limit(1);

    if (!incident) throw new NotFoundError('Incident', data.incident_id);

    const now = new Date();
    const snapshotId = crypto.randomUUID();

    // In production, this would call the device adapter:
    //   const snapshot = await deviceAdapter.captureSnapshot(data.device_id);
    //   const uploaded = await storageService.upload(snapshot.buffer, `evidence/${snapshotId}.jpg`);

    const placeholderUrl = `/storage/evidence/${snapshotId}.jpg`;
    const thumbnailUrl = `/storage/evidence/${snapshotId}_thumb.jpg`;

    const [record] = await db
      .insert(evidence)
      .values({
        tenantId,
        incidentId: data.incident_id,
        deviceId: data.device_id,
        type: 'snapshot',
        fileUrl: placeholderUrl,
        thumbnailUrl,
        fileName: `snapshot_${now.toISOString().replace(/[:.]/g, '-')}.jpg`,
        mimeType: 'image/jpeg',
        description: data.description ?? `Snapshot captured from device`,
        capturedAt: now,
        createdBy: userId,
      })
      .returning();

    return record;
  }

  /**
   * Delete an evidence record, scoped to tenant.
   */
  async delete(id: string, tenantId: string) {
    const [record] = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.id, id), eq(evidence.tenantId, tenantId)))
      .limit(1);

    if (!record) throw new NotFoundError('Evidence', id);

    // In production, also delete the file from object storage:
    //   await storageService.delete(record.fileUrl);

    await db
      .delete(evidence)
      .where(and(eq(evidence.id, id), eq(evidence.tenantId, tenantId)));

    return record;
  }

  /**
   * Get a single evidence record by ID, scoped to tenant.
   */
  async getById(id: string, tenantId: string) {
    const [record] = await db
      .select()
      .from(evidence)
      .where(and(eq(evidence.id, id), eq(evidence.tenantId, tenantId)))
      .limit(1);

    if (!record) throw new NotFoundError('Evidence', id);
    return record;
  }
}

export const evidenceService = new EvidenceService();
