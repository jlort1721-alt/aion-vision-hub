import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config/env.js";
import * as schema from "./schema/index.js";

const queryClient = postgres(config.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;

/**
 * Execute a callback with RLS JWT claims set on the PostgreSQL session.
 * Uses SET LOCAL inside a transaction so claims are scoped to the request.
 */
export async function withRlsClaims(
  claims: { userId: string; role: string; tenantId: string },
  fn: () => Promise<unknown>,
): Promise<unknown> {
  return queryClient.begin(async (sql) => {
    await sql.unsafe(
      `SET LOCAL request.jwt.claim.sub = '${claims.userId.replace(/'/g, "''")}';` +
        `SET LOCAL request.jwt.claim.role = '${claims.role.replace(/'/g, "''")}';` +
        `SET LOCAL request.jwt.claim.tenant_id = '${claims.tenantId.replace(/'/g, "''")}'`,
    );
    return fn();
  });
}
