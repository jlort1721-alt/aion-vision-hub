import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accessVehicles, accessPeople, accessLogs, devices } from '../../db/schema/index.js';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PlateDetection {
  plate: string;
  confidence: number;
  cameraId: string;
  imageUrl?: string;
  timestamp: string;
}

export interface DetectionRecord {
  id: string;
  plate: string;
  normalizedPlate: string;
  confidence: number;
  cameraId: string;
  imageUrl: string | null;
  matched: boolean;
  vehicleId: string | null;
  personId: string | null;
  personName: string | null;
  vehicleInfo: { brand?: string; model?: string; color?: string; type?: string } | null;
  status: 'pending' | 'matched' | 'unmatched' | 'action_taken';
  action: string | null;
  timestamp: string;
  createdAt: string;
}

export interface LprCameraConfig {
  detectionZone?: { x: number; y: number; width: number; height: number };
  sensitivity?: number;
  plateFormat?: string;
  relayDeviceId?: string;
  relayType?: 'ewelink' | 'generic';
  relayEndpoint?: string;
  autoOpen?: boolean;
  autoOpenMinConfidence?: number;
}

export interface DetectionFilters {
  plate?: string;
  confidence?: number;
  status?: string;
  from?: string;
  to?: string;
  cameraId?: string;
  limit?: number;
  offset?: number;
}

export interface LprStats {
  totalDetections: number;
  matchedDetections: number;
  unmatchedDetections: number;
  actionsExecuted: number;
  averageConfidence: number;
  detectionsByHour: Array<{ hour: number; count: number }>;
}

// ── In-memory detection store ──────────────────────────────────────────────────
// Detections are stored per-tenant in memory and flushed to access_logs.
// For production at scale, swap this for Redis or a dedicated table.

const detectionStore = new Map<string, DetectionRecord[]>();
const MAX_DETECTIONS_PER_TENANT = 10_000;

function getDetections(tenantId: string): DetectionRecord[] {
  if (!detectionStore.has(tenantId)) {
    detectionStore.set(tenantId, []);
  }
  return detectionStore.get(tenantId)!;
}

function pushDetection(tenantId: string, record: DetectionRecord): void {
  const list = getDetections(tenantId);
  list.unshift(record);
  if (list.length > MAX_DETECTIONS_PER_TENANT) {
    list.length = MAX_DETECTIONS_PER_TENANT;
  }
}

// ── Camera config store (tenant → deviceId → config) ──────────────────────────

const cameraConfigStore = new Map<string, Map<string, LprCameraConfig>>();

export function getCameraConfig(tenantId: string, deviceId: string): LprCameraConfig | undefined {
  return cameraConfigStore.get(tenantId)?.get(deviceId);
}

export function setCameraConfig(tenantId: string, deviceId: string, config: LprCameraConfig): void {
  if (!cameraConfigStore.has(tenantId)) {
    cameraConfigStore.set(tenantId, new Map());
  }
  const existing = cameraConfigStore.get(tenantId)!.get(deviceId) ?? {};
  cameraConfigStore.get(tenantId)!.set(deviceId, { ...existing, ...config });
}

// ── SSE subscribers ────────────────────────────────────────────────────────────

type SseCallback = (detection: DetectionRecord) => void;
const sseSubscribers = new Map<string, Set<SseCallback>>();

function notifySubscribers(tenantId: string, detection: DetectionRecord): void {
  const subs = sseSubscribers.get(tenantId);
  if (!subs) return;
  for (const cb of subs) {
    try {
      cb(detection);
    } catch {
      // subscriber may have disconnected
    }
  }
}

export function subscribeLive(tenantId: string, cb: SseCallback): () => void {
  if (!sseSubscribers.has(tenantId)) {
    sseSubscribers.set(tenantId, new Set());
  }
  sseSubscribers.get(tenantId)!.add(cb);
  return () => {
    sseSubscribers.get(tenantId)?.delete(cb);
  };
}

// ── Plate normalization ────────────────────────────────────────────────────────

function normalizePlate(plate: string): string {
  return plate
    .toUpperCase()
    .replace(/[\s\-_.]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function plateDistance(a: string, b: string): number {
  // Levenshtein distance for fuzzy matching
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

// ── Service ────────────────────────────────────────────────────────────────────

class LprService {
  /**
   * Match a plate against the access_vehicles table.
   * Returns exact match first, then fuzzy matches within edit-distance 2.
   */
  async matchPlate(plate: string, tenantId: string) {
    const normalized = normalizePlate(plate);

    // Exact match (case-insensitive, ignoring separators)
    const allVehicles = await db
      .select({
        vehicle: accessVehicles,
        person: accessPeople,
      })
      .from(accessVehicles)
      .leftJoin(accessPeople, eq(accessVehicles.personId, accessPeople.id))
      .where(
        and(
          eq(accessVehicles.tenantId, tenantId),
          eq(accessVehicles.status, 'active'),
        ),
      );

    // Try exact normalized match first
    const exactMatch = allVehicles.find(
      (v) => normalizePlate(v.vehicle.plate) === normalized,
    );

    if (exactMatch) {
      return {
        matched: true,
        exact: true,
        distance: 0,
        vehicle: exactMatch.vehicle,
        person: exactMatch.person,
      };
    }

    // Fuzzy match: find closest within distance <= 2
    let bestMatch: (typeof allVehicles)[0] | null = null;
    let bestDist = Infinity;

    for (const row of allVehicles) {
      const dist = plateDistance(normalized, normalizePlate(row.vehicle.plate));
      if (dist <= 2 && dist < bestDist) {
        bestDist = dist;
        bestMatch = row;
      }
    }

    if (bestMatch) {
      return {
        matched: true,
        exact: false,
        distance: bestDist,
        vehicle: bestMatch.vehicle,
        person: bestMatch.person,
      };
    }

    return { matched: false, exact: false, distance: -1, vehicle: null, person: null };
  }

  /**
   * Log a new plate detection, auto-match against registered vehicles,
   * optionally trigger gate action if configured.
   */
  async logDetection(detection: PlateDetection, tenantId: string): Promise<DetectionRecord> {
    const normalized = normalizePlate(detection.plate);
    const matchResult = await this.matchPlate(detection.plate, tenantId);

    const id = crypto.randomUUID();
    const record: DetectionRecord = {
      id,
      plate: detection.plate,
      normalizedPlate: normalized,
      confidence: detection.confidence,
      cameraId: detection.cameraId,
      imageUrl: detection.imageUrl ?? null,
      matched: matchResult.matched,
      vehicleId: matchResult.vehicle?.id ?? null,
      personId: matchResult.person?.id ?? null,
      personName: matchResult.person?.fullName ?? null,
      vehicleInfo: matchResult.vehicle
        ? {
            brand: matchResult.vehicle.brand ?? undefined,
            model: matchResult.vehicle.model ?? undefined,
            color: matchResult.vehicle.color ?? undefined,
            type: matchResult.vehicle.type,
          }
        : null,
      status: matchResult.matched ? 'matched' : 'unmatched',
      action: null,
      timestamp: detection.timestamp,
      createdAt: new Date().toISOString(),
    };

    pushDetection(tenantId, record);

    // Persist to access_logs with method='plate'
    try {
      await db.insert(accessLogs).values({
        tenantId,
        personId: matchResult.person?.id ?? null,
        vehicleId: matchResult.vehicle?.id ?? null,
        direction: 'in',
        method: 'plate',
        notes: JSON.stringify({
          detectionId: id,
          plate: detection.plate,
          confidence: detection.confidence,
          cameraId: detection.cameraId,
          imageUrl: detection.imageUrl,
          matched: matchResult.matched,
          exact: matchResult.exact,
        }),
      });
    } catch (err) {
      // Log persistence failure but don't block detection flow
      console.error('[LPR] Failed to persist access log:', err);
    }

    // Notify SSE subscribers
    notifySubscribers(tenantId, record);

    // Auto-open gate if configured
    const config = getCameraConfig(tenantId, detection.cameraId);
    if (
      config?.autoOpen &&
      matchResult.matched &&
      matchResult.exact &&
      detection.confidence >= (config.autoOpenMinConfidence ?? 0.85) &&
      config.relayDeviceId
    ) {
      try {
        await this.triggerGateAction(config.relayDeviceId, 'open_gate', tenantId, config);
        record.action = 'auto_open';
        record.status = 'action_taken';
      } catch (err) {
        console.error('[LPR] Auto-open gate failed:', err);
      }
    }

    return record;
  }

  /**
   * Retrieve detections for a tenant with optional filters.
   */
  listDetections(tenantId: string, filters?: DetectionFilters): { data: DetectionRecord[]; total: number } {
    let results = getDetections(tenantId);

    if (filters?.plate) {
      const search = normalizePlate(filters.plate);
      results = results.filter((d) => d.normalizedPlate.includes(search));
    }
    if (filters?.confidence) {
      results = results.filter((d) => d.confidence >= filters.confidence!);
    }
    if (filters?.status) {
      results = results.filter((d) => d.status === filters.status);
    }
    if (filters?.cameraId) {
      results = results.filter((d) => d.cameraId === filters.cameraId);
    }
    if (filters?.from) {
      const fromDate = new Date(filters.from).getTime();
      results = results.filter((d) => new Date(d.timestamp).getTime() >= fromDate);
    }
    if (filters?.to) {
      const toDate = new Date(filters.to).getTime();
      results = results.filter((d) => new Date(d.timestamp).getTime() <= toDate);
    }

    const total = results.length;
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 100;
    const data = results.slice(offset, offset + limit);

    return { data, total };
  }

  /**
   * Compute detection statistics for a tenant.
   */
  getStats(tenantId: string): LprStats {
    const detections = getDetections(tenantId);

    const totalDetections = detections.length;
    const matchedDetections = detections.filter((d) => d.matched).length;
    const unmatchedDetections = totalDetections - matchedDetections;
    const actionsExecuted = detections.filter((d) => d.action !== null).length;

    const averageConfidence =
      totalDetections > 0
        ? detections.reduce((sum, d) => sum + d.confidence, 0) / totalDetections
        : 0;

    // Group detections by hour of day
    const hourBuckets = new Array(24).fill(0);
    for (const d of detections) {
      const hour = new Date(d.timestamp).getHours();
      hourBuckets[hour]++;
    }
    const detectionsByHour = hourBuckets.map((c, hour) => ({ hour, count: c }));

    return {
      totalDetections,
      matchedDetections,
      unmatchedDetections,
      actionsExecuted,
      averageConfidence: Math.round(averageConfidence * 1000) / 1000,
      detectionsByHour,
    };
  }

  /**
   * Trigger a relay/gate action via eWeLink or generic HTTP relay.
   */
  async triggerGateAction(
    deviceId: string,
    action: 'open_gate' | 'close_gate' | 'pulse',
    tenantId: string,
    config?: LprCameraConfig,
  ): Promise<{ success: boolean; message: string }> {
    const relayType = config?.relayType ?? 'ewelink';
    const baseUrl = process.env.BACKEND_BASE_URL ?? 'http://localhost:3001';

    if (relayType === 'ewelink') {
      // Turn relay ON
      const onResponse = await fetch(`${baseUrl}/api/v1/ewelink/devices/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, action: 'on' }),
      });

      if (!onResponse.ok) {
        const errText = await onResponse.text();
        throw new Error(`eWeLink relay ON failed (${onResponse.status}): ${errText}`);
      }

      // Schedule relay OFF after 3 seconds (gate pulse)
      setTimeout(async () => {
        try {
          await fetch(`${baseUrl}/api/v1/ewelink/devices/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, action: 'off' }),
          });
        } catch (err) {
          console.error('[LPR] Failed to turn relay OFF:', err);
        }
      }, 3000);

      // Log action in access_logs
      await db.insert(accessLogs).values({
        tenantId,
        direction: 'in',
        method: 'plate',
        notes: JSON.stringify({
          action: 'gate_open',
          relayType: 'ewelink',
          deviceId,
          triggeredAt: new Date().toISOString(),
        }),
      });

      return { success: true, message: `Gate relay ${deviceId} activated via eWeLink (3s pulse)` };
    }

    // Generic HTTP relay
    const endpoint = config?.relayEndpoint;
    if (!endpoint) {
      throw new Error(`No relay endpoint configured for device ${deviceId}`);
    }

    // Resolve device IP from the devices table
    const [device] = await db
      .select({ ipAddress: devices.ipAddress })
      .from(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.tenantId, tenantId)))
      .limit(1);

    const relayUrl = device?.ipAddress
      ? `http://${device.ipAddress}${endpoint}`
      : endpoint;

    const relayResponse = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, timestamp: new Date().toISOString() }),
    });

    if (!relayResponse.ok) {
      const errText = await relayResponse.text();
      throw new Error(`Generic relay failed (${relayResponse.status}): ${errText}`);
    }

    await db.insert(accessLogs).values({
      tenantId,
      direction: 'in',
      method: 'plate',
      notes: JSON.stringify({
        action: 'gate_open',
        relayType: 'generic',
        deviceId,
        endpoint: relayUrl,
        triggeredAt: new Date().toISOString(),
      }),
    });

    return { success: true, message: `Gate relay ${deviceId} activated via generic HTTP` };
  }

  /**
   * Update the status/action on a detection record.
   */
  updateDetection(tenantId: string, detectionId: string, update: Partial<DetectionRecord>): DetectionRecord | null {
    const list = getDetections(tenantId);
    const idx = list.findIndex((d) => d.id === detectionId);
    if (idx === -1) return null;
    Object.assign(list[idx], update);
    return list[idx];
  }
}

export const lprService = new LprService();
