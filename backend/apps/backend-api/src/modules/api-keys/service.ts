import { createHash, randomBytes } from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { apiKeys } from './schema.js';
import type { CreateApiKeyInput } from './schemas.js';

/** Generate a secure API key with prefix for easy identification. */
function generateApiKey(): string {
  const prefix = 'cvs'; // clave seguridad
  const key = randomBytes(32).toString('base64url');
  return `${prefix}_${key}`;
}

/** SHA-256 hash for safe storage (never store raw keys). */
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export class ApiKeyService {
  /** Create a new API key. Returns the raw key ONCE — it cannot be retrieved later. */
  async create(input: CreateApiKeyInput, tenantId: string, userId: string) {
    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const prefix = rawKey.slice(0, 8);

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const [record] = await db.insert(apiKeys).values({
      tenantId,
      createdBy: userId,
      name: input.name,
      keyHash,
      keyPrefix: prefix,
      scopes: input.scopes,
      expiresAt,
    }).returning();

    return {
      id: record.id,
      name: record.name,
      key: rawKey, // Only returned on creation
      keyPrefix: prefix,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    };
  }

  /** List all API keys for a tenant (without revealing the key hash). */
  async list(tenantId: string) {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, tenantId))
      .orderBy(apiKeys.createdAt);

    return keys;
  }

  /** Validate an API key and return the associated context. */
  async validate(rawKey: string) {
    const keyHash = hashKey(rawKey);

    const [record] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
      .limit(1);

    if (!record) return null;

    // Check expiration
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    // Update last used timestamp (fire and forget)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, record.id))
      .then(() => {})
      .catch(() => {});

    return {
      id: record.id,
      tenantId: record.tenantId,
      createdBy: record.createdBy,
      scopes: record.scopes,
    };
  }

  /** Revoke an API key. */
  async revoke(id: string, tenantId: string) {
    const [updated] = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
      .returning({ id: apiKeys.id });

    return updated ?? null;
  }
}
