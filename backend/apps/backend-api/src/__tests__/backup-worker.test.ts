import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────

const { mockFs, mockExecute } = vi.hoisted(() => ({
  mockFs: {
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn().mockReturnValue('{}'),
    readdirSync: vi.fn().mockReturnValue([]),
    statSync: vi.fn().mockReturnValue({ size: 1024 }),
    rmSync: vi.fn(),
  },
  mockExecute: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('fs', () => ({
  default: mockFs,
  ...mockFs,
}));

vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return {
    ...actual,
    default: actual,
    resolve: vi.fn((...args: string[]) => args.join('/')),
    join: vi.fn((...args: string[]) => args.join('/')),
    dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
  };
});

import {
  runBackupNow,
  getBackupStatus,
  listBackups,
  startBackupWorker,
  stopBackupWorker,
} from '../workers/backup-worker.js';

// ── Tests ─────────────────────────────────────────────────────────

describe('Backup Worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.readFileSync.mockReturnValue('{}');
    mockExecute.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    stopBackupWorker();
    vi.useRealTimers();
  });

  // ── runBackupNow ──────────────────────────────────────────

  describe('runBackupNow', () => {
    it('creates backup directory with mkdirSync recursive', async () => {
      const db = { execute: mockExecute } as any;
      await runBackupNow(db);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true },
      );
    });

    it('exports all configured tables', async () => {
      mockExecute.mockResolvedValue({ rows: [{ id: '1' }] });
      const db = { execute: mockExecute } as any;
      const manifest = await runBackupNow(db);

      // 11 tables defined in BACKUP_TABLES
      expect(mockExecute).toHaveBeenCalledTimes(11);
      expect(Object.keys(manifest.table_counts).length).toBe(11);
    });

    it('returns a valid BackupManifest', async () => {
      mockExecute.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const db = { execute: mockExecute } as any;
      const manifest = await runBackupNow(db);

      expect(manifest).toHaveProperty('backup_date');
      expect(manifest).toHaveProperty('table_counts');
      expect(manifest).toHaveProperty('total_rows');
      expect(manifest).toHaveProperty('backup_size_bytes');
      expect(manifest).toHaveProperty('duration_ms');
      expect(typeof manifest.duration_ms).toBe('number');
    });

    it('writes JSON files for each table', async () => {
      mockExecute.mockResolvedValue([{ id: '1' }]);
      const db = { execute: mockExecute } as any;
      await runBackupNow(db);

      // Should write one file per table + manifest = 12 total
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(12);
    });

    it('writes manifest.json as last file', async () => {
      mockExecute.mockResolvedValue([]);
      const db = { execute: mockExecute } as any;
      await runBackupNow(db);

      const lastCall = mockFs.writeFileSync.mock.calls[mockFs.writeFileSync.mock.calls.length - 1];
      expect(lastCall[0]).toContain('manifest.json');
    });

    it('marks failed tables with -1 count', async () => {
      let callCount = 0;
      mockExecute.mockImplementation(() => {
        callCount++;
        if (callCount === 3) throw new Error('table locked');
        return Promise.resolve([]);
      });

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const db = { execute: mockExecute } as any;
      const manifest = await runBackupNow(db);

      const failedTables = Object.entries(manifest.table_counts).filter(([, v]) => v === -1);
      expect(failedTables.length).toBe(1);
      errSpy.mockRestore();
    });

    it('handles db.execute returning array directly', async () => {
      mockExecute.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const db = { execute: mockExecute } as any;
      const manifest = await runBackupNow(db);

      // Each table should get count of 2
      const counts = Object.values(manifest.table_counts);
      expect(counts.every((c) => c === 2)).toBe(true);
    });

    it('enforces retention after backup (deletes oldest when over 30)', async () => {
      // For the retention check: existsSync returns true, readdirSync returns 32 dirs
      // But for dirSize we need to avoid infinite recursion — return empty for nested calls
      let readdirCallCount = 0;
      mockFs.readdirSync.mockImplementation(() => {
        readdirCallCount++;
        if (readdirCallCount <= 1) {
          // First call inside runBackupNow -> dirSize of the backup dir — return empty
          return [];
        }
        // The retention call to list backup dirs
        return Array.from({ length: 32 }, (_, i) => ({
          name: `2026-01-${String(i + 1).padStart(2, '0')}_02-00`,
          isDirectory: () => true,
          isFile: () => false,
        }));
      });
      mockFs.existsSync.mockReturnValue(true);

      const db = { execute: mockExecute } as any;
      await runBackupNow(db);

      // Should delete 2 oldest directories (32 - 30 = 2)
      expect(mockFs.rmSync).toHaveBeenCalledTimes(2);
    });
  });

  // ── getBackupStatus ───────────────────────────────────────

  describe('getBackupStatus', () => {
    it('returns empty status when no backups directory exists', () => {
      mockFs.existsSync.mockReturnValue(false);
      const status = getBackupStatus();

      expect(status.last_backup_date).toBeNull();
      expect(status.total_backups).toBe(0);
      expect(status.disk_usage_bytes).toBe(0);
      expect(status.next_scheduled).toBeTruthy();
    });

    it('reads manifest from latest backup directory', () => {
      const manifest = {
        backup_date: '2026-01-02T07:00:00.000Z',
        table_counts: {},
        total_rows: 0,
        backup_size_bytes: 0,
        duration_ms: 0,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(manifest));
      // readdirSync: first call returns backup dirs, subsequent calls (from dirSize) return empty
      let readdirCalls = 0;
      mockFs.readdirSync.mockImplementation(() => {
        readdirCalls++;
        if (readdirCalls === 1) {
          return [
            { name: '2026-01-01_02-00', isDirectory: () => true },
            { name: '2026-01-02_02-00', isDirectory: () => true },
          ];
        }
        return []; // dirSize calls
      });

      const status = getBackupStatus();
      expect(status.last_backup_date).toBe('2026-01-02T07:00:00.000Z');
      expect(status.total_backups).toBe(2);
    });

    it('computes next_scheduled in the future', () => {
      mockFs.existsSync.mockReturnValue(false);
      const status = getBackupStatus();

      const nextDate = new Date(status.next_scheduled!);
      expect(nextDate.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ── listBackups ───────────────────────────────────────────

  describe('listBackups', () => {
    it('returns empty array when no backups directory', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(listBackups()).toEqual([]);
    });

    it('returns entries sorted newest first', () => {
      mockFs.existsSync.mockImplementation((p: string) => {
        // Backups root exists, but no manifests
        return !String(p).includes('manifest');
      });
      // First call returns dirs, subsequent calls (dirSize) return empty
      let readdirCalls = 0;
      mockFs.readdirSync.mockImplementation(() => {
        readdirCalls++;
        if (readdirCalls === 1) {
          return [
            { name: '2026-01-01_02-00', isDirectory: () => true, isFile: () => false },
            { name: '2026-01-03_02-00', isDirectory: () => true, isFile: () => false },
            { name: '2026-01-02_02-00', isDirectory: () => true, isFile: () => false },
          ];
        }
        return []; // dirSize nested calls
      });

      const entries = listBackups();
      expect(entries[0].name).toBe('2026-01-03_02-00');
      expect(entries[1].name).toBe('2026-01-02_02-00');
      expect(entries[2].name).toBe('2026-01-01_02-00');
    });
  });

  // ── startBackupWorker / stopBackupWorker ──────────────────

  describe('startBackupWorker', () => {
    it('returns a cleanup function', () => {
      mockFs.existsSync.mockReturnValue(false);
      const db = { execute: mockExecute } as any;
      const cleanup = startBackupWorker(db);
      expect(typeof cleanup).toBe('function');
      cleanup();
    });

    it('prevents double-start', () => {
      mockFs.existsSync.mockReturnValue(false);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const db = { execute: mockExecute } as any;

      startBackupWorker(db);
      startBackupWorker(db);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('already running'),
      );
      warnSpy.mockRestore();
    });

    it('triggers backup when current hour matches BACKUP_HOUR and no backup today', async () => {
      mockFs.existsSync.mockReturnValue(false);
      // BACKUP_HOUR = 2 — uses local time via getHours(), so build a Date at local 2:00 AM
      const atBackupHour = new Date();
      atBackupHour.setHours(2, 0, 0, 0);
      vi.setSystemTime(atBackupHour);

      const db = { execute: mockExecute } as any;
      startBackupWorker(db);

      // tick() runs synchronously and calls runBackupNow (async).
      // We need to flush the microtask queue for the async backup to start.
      await vi.advanceTimersByTimeAsync(100);

      // mkdirSync is called when backup runs
      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });

    it('does not trigger backup when hour does not match', async () => {
      mockFs.existsSync.mockReturnValue(false);
      const notBackupHour = new Date();
      notBackupHour.setHours(10, 0, 0, 0);
      vi.setSystemTime(notBackupHour);

      const db = { execute: mockExecute } as any;
      startBackupWorker(db);
      await vi.advanceTimersByTimeAsync(100);

      expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('stopBackupWorker', () => {
    it('stops the timer', () => {
      mockFs.existsSync.mockReturnValue(false);
      const db = { execute: mockExecute } as any;
      startBackupWorker(db);
      stopBackupWorker();

      // Safe to call again
      expect(() => stopBackupWorker()).not.toThrow();
    });
  });
});
