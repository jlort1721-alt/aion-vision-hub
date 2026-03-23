import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { tenants } from '../db/schema/tenants.js';
import { devices, sites } from '../db/schema/devices.js';
import { profiles } from '../db/schema/users.js';

interface TenantSettings {
  maxDevices?: number;
  maxUsers?: number;
  maxSites?: number;
  [key: string]: unknown;
}

const DEFAULT_LIMITS: Record<string, TenantSettings> = {
  starter: { maxDevices: 16, maxUsers: 5, maxSites: 2 },
  professional: { maxDevices: 64, maxUsers: 25, maxSites: 10 },
  enterprise: { maxDevices: 500, maxUsers: 100, maxSites: 50 },
};

/**
 * Resolve effective limits for a tenant.
 * Priority: tenant settings override > plan defaults > generous fallback.
 */
function getEffectiveLimits(plan: string | null, settings: TenantSettings | null): Required<Pick<TenantSettings, 'maxDevices' | 'maxUsers' | 'maxSites'>> {
  const planDefaults = DEFAULT_LIMITS[plan ?? 'starter'] ?? DEFAULT_LIMITS.starter;
  return {
    maxDevices: settings?.maxDevices ?? planDefaults.maxDevices ?? 500,
    maxUsers: settings?.maxUsers ?? planDefaults.maxUsers ?? 100,
    maxSites: settings?.maxSites ?? planDefaults.maxSites ?? 50,
  };
}

type ResourceType = 'devices' | 'users' | 'sites';

/**
 * Check if creating a new resource would exceed the tenant's plan limits.
 * Returns null if within limits, or an error object if exceeded.
 */
export async function checkPlanLimit(
  tenantId: string,
  resource: ResourceType,
): Promise<{ exceeded: true; limit: number; current: number; resource: string } | null> {
  // Fetch tenant plan and settings
  const [tenant] = await db
    .select({ id: tenants.id, settings: tenants.settings })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) return null; // Tenant not found — will be caught by tenant plugin

  const settings = (tenant.settings ?? {}) as TenantSettings & { plan?: string };
  const plan = settings.plan ?? 'starter';
  const limits = getEffectiveLimits(plan, settings);

  let currentCount = 0;
  let limit = 0;

  switch (resource) {
    case 'devices': {
      const [result] = await db
        .select({ count: count() })
        .from(devices)
        .where(eq(devices.tenantId, tenantId));
      currentCount = result?.count ?? 0;
      limit = limits.maxDevices;
      break;
    }
    case 'users': {
      const [result] = await db
        .select({ count: count() })
        .from(profiles)
        .where(eq(profiles.tenantId, tenantId));
      currentCount = result?.count ?? 0;
      limit = limits.maxUsers;
      break;
    }
    case 'sites': {
      const [result] = await db
        .select({ count: count() })
        .from(sites)
        .where(eq(sites.tenantId, tenantId));
      currentCount = result?.count ?? 0;
      limit = limits.maxSites;
      break;
    }
  }

  if (currentCount >= limit) {
    return { exceeded: true, limit, current: currentCount, resource };
  }

  return null;
}

/**
 * Fastify preHandler factory that enforces plan limits before resource creation.
 */
export function enforcePlanLimit(resource: ResourceType) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.tenantId) return;

    const result = await checkPlanLimit(request.tenantId, resource);
    if (result) {
      return reply.code(403).send({
        success: false,
        error: {
          code: 'PLAN_LIMIT_EXCEEDED',
          message: `Plan limit reached: ${result.current}/${result.limit} ${result.resource}. Upgrade your plan to add more.`,
          details: {
            resource: result.resource,
            current: result.current,
            limit: result.limit,
          },
        },
      });
    }
  };
}
