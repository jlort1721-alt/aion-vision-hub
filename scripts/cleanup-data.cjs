/**
 * AION Vision Hub — Data Cleanup Script
 *
 * Connects to aionseg_prod (localhost) and normalizes data:
 *   - Fix ALL CAPS names to Title Case
 *   - Clean phone numbers (digits only)
 *   - Mark informal/placeholder entries as inactive
 *   - Apply same fixes to residents table
 *
 * Usage: node scripts/cleanup-data.cjs
 */

'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://aionseg:A10n$3g_Pr0d_2026!@localhost:5432/aionseg_prod',
});

const QUERIES = [
  {
    label: 'Fix ALL CAPS names → Title Case (access_people)',
    sql: `UPDATE access_people SET full_name = INITCAP(LOWER(full_name)) WHERE full_name = UPPER(full_name);`,
  },
  {
    label: 'Clean phone numbers — remove non-digits (access_people)',
    sql: `UPDATE access_people SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g') WHERE phone IS NOT NULL AND phone ~ '[^0-9]';`,
  },
  {
    label: 'Keep only first phone when multiple separated by dash/space (access_people)',
    sql: `UPDATE access_people SET phone = SPLIT_PART(REGEXP_REPLACE(phone, '[^0-9 -]', '', 'g'), ' ', 1) WHERE phone LIKE '%-%' OR phone LIKE '% %';`,
  },
  {
    label: 'Mark informal entries as inactive (access_people)',
    sql: `UPDATE access_people SET status = 'inactive', notes = COALESCE(notes, '') || ' [Auto-cleaned: informal entry]' WHERE full_name ILIKE '%desocupado%' OR full_name ILIKE '%vacio%';`,
  },
  {
    label: 'Fix ALL CAPS names → Title Case (residents)',
    sql: `UPDATE residents SET full_name = INITCAP(LOWER(full_name)) WHERE full_name = UPPER(full_name);`,
  },
];

async function main() {
  console.log('=== AION Data Cleanup ===\n');
  console.log('Connecting to aionseg_prod (localhost)...\n');

  const client = await pool.connect();

  try {
    for (const q of QUERIES) {
      console.log(`> ${q.label}`);
      const result = await client.query(q.sql);
      console.log(`  Rows affected: ${result.rowCount}\n`);
    }
    console.log('=== Cleanup complete ===');
  } catch (err) {
    console.error('ERROR during cleanup:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
