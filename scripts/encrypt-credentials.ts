/**
 * AION Vision Hub — Device Credential Encryption Script
 * Encrypts plain-text username/password in the devices table using AES-256-GCM.
 * Idempotent: skips devices that are already encrypted.
 *
 * Usage: cd backend/apps/backend-api && npx tsx ../../../scripts/encrypt-credentials.ts
 */
import postgres from 'postgres';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Load .env from backend directory ──
const envPath = path.resolve(__dirname, '../backend/.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx);
    const val = trimmed.substring(eqIdx + 1);
    if (!process.env[key]) process.env[key] = val;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not set. Check backend/.env');
  process.exit(1);
}

const CREDENTIAL_ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY;
if (!CREDENTIAL_ENCRYPTION_KEY) {
  console.error('ERROR: CREDENTIAL_ENCRYPTION_KEY not set. Check backend/.env');
  process.exit(1);
}

// ── AES-256-GCM helpers (inline, no external imports) ──

function encrypt(text: string, key: string): string {
  const keyBuf = Buffer.from(key, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(data: string, key: string): string {
  const [ivHex, tagHex, encHex] = data.split(':');
  const keyBuf = Buffer.from(key, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}

// ── Main ──

async function main() {
  const sql = postgres(DATABASE_URL!, { max: 5, idle_timeout: 30 });

  try {
    // Step 1: Run the migration SQL to ensure the column exists
    const migrationPath = path.resolve(
      __dirname,
      '../backend/apps/backend-api/src/db/migrations/010_encrypt_device_credentials.sql',
    );
    if (!fs.existsSync(migrationPath)) {
      console.error(`ERROR: Migration file not found at ${migrationPath}`);
      process.exit(1);
    }
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    console.log('Running migration 010_encrypt_device_credentials.sql ...');
    await sql.unsafe(migrationSql);
    console.log('Migration applied successfully.');

    // Step 2: Select devices that need encryption
    const rows = await sql`
      SELECT id, username, password
      FROM devices
      WHERE credentials_encrypted IS NOT TRUE
        AND (username IS NOT NULL OR password IS NOT NULL)
    `;

    console.log(`\nFound ${rows.length} device(s) with unencrypted credentials.`);

    let encryptedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
      const { id, username, password } = row;

      // Skip if both fields are null (shouldn't happen due to query, but be safe)
      if (!username && !password) {
        skippedCount++;
        continue;
      }

      const encryptedUsername = username ? encrypt(username, CREDENTIAL_ENCRYPTION_KEY!) : null;
      const encryptedPassword = password ? encrypt(password, CREDENTIAL_ENCRYPTION_KEY!) : null;

      await sql`
        UPDATE devices
        SET
          username = ${encryptedUsername},
          password = ${encryptedPassword},
          credentials_encrypted = true,
          updated_at = NOW()
        WHERE id = ${id}
      `;

      // Verify round-trip
      if (encryptedUsername) {
        const decrypted = decrypt(encryptedUsername, CREDENTIAL_ENCRYPTION_KEY!);
        if (decrypted !== username) {
          console.error(`FATAL: Round-trip verification failed for device ${id} (username)`);
          process.exit(1);
        }
      }
      if (encryptedPassword) {
        const decrypted = decrypt(encryptedPassword, CREDENTIAL_ENCRYPTION_KEY!);
        if (decrypted !== password) {
          console.error(`FATAL: Round-trip verification failed for device ${id} (password)`);
          process.exit(1);
        }
      }

      encryptedCount++;
      console.log(`  Encrypted device ${id} (username: ${username ? 'yes' : 'no'}, password: ${password ? 'yes' : 'no'})`);
    }

    // Count already-encrypted devices
    const [alreadyEncrypted] = await sql`
      SELECT count(*)::int AS count FROM devices WHERE credentials_encrypted = true
    `;

    console.log('\n── Summary ──');
    console.log(`  Total devices processed:  ${rows.length}`);
    console.log(`  Encrypted this run:       ${encryptedCount}`);
    console.log(`  Skipped (null creds):     ${skippedCount}`);
    console.log(`  Already encrypted:        ${alreadyEncrypted.count}`);
    console.log('\nDone.');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
