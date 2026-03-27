import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '@aion/common-utils';
import type { Database } from '../db/client.js';

const logger = createLogger({ name: 'backup-worker' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BackupManifest {
  backup_date: string;
  table_counts: Record<string, number>;
  total_rows: number;
  backup_size_bytes: number;
  duration_ms: number;
}

export interface BackupStatus {
  last_backup_date: string | null;
  next_scheduled: string | null;
  total_backups: number;
  disk_usage_bytes: number;
}

export interface BackupEntry {
  name: string;
  date: string;
  size_bytes: number;
  table_count: number;
  total_rows: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKUP_TABLES: Array<{ name: string; query: string }> = [
  { name: 'tenants', query: 'SELECT * FROM tenants' },
  { name: 'profiles', query: 'SELECT * FROM profiles' },
  { name: 'user_roles', query: 'SELECT * FROM user_roles' },
  { name: 'sites', query: 'SELECT * FROM sites' },
  { name: 'devices', query: 'SELECT * FROM devices' },
  {
    name: 'events',
    query: `SELECT * FROM events WHERE created_at >= NOW() - INTERVAL '30 days'`,
  },
  { name: 'incidents', query: 'SELECT * FROM incidents' },
  { name: 'alert_rules', query: 'SELECT * FROM alert_rules' },
  { name: 'automation_rules', query: 'SELECT * FROM automation_rules' },
  { name: 'contracts', query: 'SELECT * FROM contracts' },
  { name: 'shifts', query: 'SELECT * FROM shifts' },
];

const MAX_RETENTION = 30;
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const BACKUP_HOUR = 2; // 2:00 AM

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the backups root directory (project root / backups). */
function getBackupsRoot(): string {
  // Navigate from src/workers/ up to project root (backend/apps/backend-api)
  return path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..', '..', '..', 'backups',
  );
}

/** Format date for backup folder name: YYYY-MM-DD_HH-mm */
function formatBackupDir(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

/** Get the date string (YYYY-MM-DD) for a given Date. */
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Calculate total size of a directory in bytes. */
function dirSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isFile()) {
      total += fs.statSync(full).size;
    } else if (entry.isDirectory()) {
      total += dirSize(full);
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Core backup logic
// ---------------------------------------------------------------------------

/**
 * Run a full backup of all critical tables. Can be called manually or by the
 * scheduled worker.
 */
export async function runBackupNow(db: Database): Promise<BackupManifest> {
  const startTime = Date.now();
  const now = new Date();
  const backupsRoot = getBackupsRoot();
  const backupDir = path.join(backupsRoot, formatBackupDir(now));

  logger.info({ backupDir }, 'Starting backup');

  // Ensure directory exists
  fs.mkdirSync(backupDir, { recursive: true });

  const tableCounts: Record<string, number> = {};
  let totalRows = 0;

  for (const table of BACKUP_TABLES) {
    try {
      logger.info({ table: table.name }, 'Exporting table');
      const rows = await db.execute(/* sql */ table.query as any);

      // drizzle execute returns an array of row objects
      const data = Array.isArray(rows) ? rows : (rows as any).rows ?? [];
      const count = data.length;
      tableCounts[table.name] = count;
      totalRows += count;

      const filePath = path.join(backupDir, `${table.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

      logger.info({ table: table.name, count }, 'Table exported');
    } catch (err) {
      logger.error({ err, table: table.name }, 'Failed to export table');
      tableCounts[table.name] = -1; // mark as failed
    }
  }

  const durationMs = Date.now() - startTime;
  const backupSizeBytes = dirSize(backupDir);

  const manifest: BackupManifest = {
    backup_date: now.toISOString(),
    table_counts: tableCounts,
    total_rows: totalRows,
    backup_size_bytes: backupSizeBytes,
    duration_ms: durationMs,
  };

  // Write manifest
  fs.writeFileSync(
    path.join(backupDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );

  logger.info({ totalRows, backupSizeKB: (backupSizeBytes / 1024).toFixed(1), durationMs }, 'Backup complete');

  // Enforce retention policy
  enforceRetention();

  return manifest;
}

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

function enforceRetention(): void {
  const backupsRoot = getBackupsRoot();
  if (!fs.existsSync(backupsRoot)) return;

  const entries = fs
    .readdirSync(backupsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(); // chronological because of YYYY-MM-DD_HH-mm format

  if (entries.length <= MAX_RETENTION) return;

  const toDelete = entries.slice(0, entries.length - MAX_RETENTION);
  for (const dir of toDelete) {
    const fullPath = path.join(backupsRoot, dir);
    logger.info({ dir }, 'Retention: deleting old backup');
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Status & listing helpers (used by routes)
// ---------------------------------------------------------------------------

export function getBackupStatus(): BackupStatus {
  const backupsRoot = getBackupsRoot();

  if (!fs.existsSync(backupsRoot)) {
    return {
      last_backup_date: null,
      next_scheduled: computeNextScheduled(),
      total_backups: 0,
      disk_usage_bytes: 0,
    };
  }

  const entries = fs
    .readdirSync(backupsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => b.name.localeCompare(a.name));

  let lastDate: string | null = null;
  if (entries.length > 0) {
    const manifestPath = path.join(backupsRoot, entries[0].name, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest: BackupManifest = JSON.parse(
        fs.readFileSync(manifestPath, 'utf-8'),
      );
      lastDate = manifest.backup_date;
    }
  }

  return {
    last_backup_date: lastDate,
    next_scheduled: computeNextScheduled(),
    total_backups: entries.length,
    disk_usage_bytes: dirSize(backupsRoot),
  };
}

export function listBackups(): BackupEntry[] {
  const backupsRoot = getBackupsRoot();
  if (!fs.existsSync(backupsRoot)) return [];

  const entries = fs
    .readdirSync(backupsRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse(); // newest first

  return entries.map((name) => {
    const dir = path.join(backupsRoot, name);
    const manifestPath = path.join(dir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest: BackupManifest = JSON.parse(
        fs.readFileSync(manifestPath, 'utf-8'),
      );
      return {
        name,
        date: manifest.backup_date,
        size_bytes: manifest.backup_size_bytes,
        table_count: Object.keys(manifest.table_counts).length,
        total_rows: manifest.total_rows,
      };
    }
    return {
      name,
      date: name,
      size_bytes: dirSize(dir),
      table_count: 0,
      total_rows: 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

function computeNextScheduled(): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(BACKUP_HOUR, 0, 0, 0);
  if (now.getHours() >= BACKUP_HOUR) {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString();
}

let timerHandle: ReturnType<typeof setInterval> | null = null;
let lastBackupDate: string | null = null;

/**
 * Start the scheduled backup worker. Checks every 30 minutes if it is time
 * to run the daily 2:00 AM backup.
 */
export function startBackupWorker(db: Database): () => void {
  if (timerHandle) {
    logger.warn('Worker already running — skipping duplicate start');
    return () => stopBackupWorker();
  }

  // Seed lastBackupDate from existing backups so we don't re-run today
  const status = getBackupStatus();
  if (status.last_backup_date) {
    lastBackupDate = dateKey(new Date(status.last_backup_date));
  }

  logger.info({ checkIntervalMin: CHECK_INTERVAL_MS / 60_000, backupHour: BACKUP_HOUR }, 'Starting backup worker');

  const tick = () => {
    const now = new Date();
    const todayKey = dateKey(now);

    if (now.getHours() === BACKUP_HOUR && lastBackupDate !== todayKey) {
      lastBackupDate = todayKey;
      logger.info('Scheduled backup triggered');
      runBackupNow(db).catch((err) => {
        logger.error({ err }, 'Scheduled backup failed');
        // Reset so it can retry next tick
        lastBackupDate = null;
      });
    }
  };

  // Check immediately on start
  tick();

  timerHandle = setInterval(tick, CHECK_INTERVAL_MS);

  return () => stopBackupWorker();
}

/**
 * Stop the backup worker if running.
 */
export function stopBackupWorker(): void {
  if (timerHandle) {
    clearInterval(timerHandle);
    timerHandle = null;
    logger.info('Worker stopped');
  }
}
