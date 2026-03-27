// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Data Import API Service Layer
// ═══════════════════════════════════════════════════════════

import { apiClient } from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  reason: string;
  data?: Record<string, unknown>;
}

export interface ImportResponse {
  success: boolean;
  data: ImportResult;
}

export type ImportEntityType = 'residents' | 'vehicles' | 'visitors' | 'devices';

// ── CSV Parser ─────────────────────────────────────────────

/**
 * Parse a CSV string into an array of objects.
 * Returns the parsed records and detected column names.
 */
export function parseCSVToRecords(csvText: string): {
  records: Record<string, string>[];
  columns: string[];
} {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return { records: [], columns: [] };

  const columns = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    const obj: Record<string, string> = {};
    for (let k = 0; k < columns.length; k++) {
      obj[columns[k]] = values[k] ?? '';
    }
    records.push(obj);
  }

  return { records, columns };
}

// ── API ────────────────────────────────────────────────────

export const dataImportApi = {
  importResidents: (records: Record<string, unknown>[]) =>
    apiClient.post<ImportResponse>('/data-import/residents', { records }),

  importVehicles: (records: Record<string, unknown>[]) =>
    apiClient.post<ImportResponse>('/data-import/vehicles', { records }),

  importVisitors: (records: Record<string, unknown>[]) =>
    apiClient.post<ImportResponse>('/data-import/visitors', { records }),

  importDevices: (records: Record<string, unknown>[]) =>
    apiClient.post<ImportResponse>('/data-import/devices', { records }),

  /**
   * Generic import by entity type
   */
  import: (entityType: ImportEntityType, records: Record<string, unknown>[]) => {
    switch (entityType) {
      case 'residents':
        return dataImportApi.importResidents(records);
      case 'vehicles':
        return dataImportApi.importVehicles(records);
      case 'visitors':
        return dataImportApi.importVisitors(records);
      case 'devices':
        return dataImportApi.importDevices(records);
    }
  },
};

// ── Column Mapping Templates ───────────────────────────────

export const EXPECTED_COLUMNS: Record<ImportEntityType, { required: string[]; optional: string[] }> = {
  residents: {
    required: ['fullName'],
    optional: ['type', 'documentId', 'phone', 'email', 'unit', 'notes', 'sectionId', 'status'],
  },
  vehicles: {
    required: ['plate'],
    optional: ['personDocumentId', 'personId', 'brand', 'model', 'color', 'type', 'status'],
  },
  visitors: {
    required: ['fullName'],
    optional: ['documentId', 'phone', 'email', 'company', 'visitReason', 'hostName', 'hostUnit', 'hostPhone', 'notes'],
  },
  devices: {
    required: ['name', 'siteId'],
    optional: ['type', 'brand', 'model', 'ipAddress', 'port', 'httpPort', 'rtspPort', 'username', 'password', 'serialNumber', 'macAddress', 'channels', 'notes'],
  },
};
