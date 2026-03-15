import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { userRoles, profiles } from '../../db/schema/index.js';
import { NotFoundError, ForbiddenError, ConflictError } from '@aion/shared-contracts';

interface AssignRoleInput {
  userId: string;
  role: string;
  tenantId?: string;
}

export class RoleService {
  /**
   * List all role assignments for a tenant.
   * Super admins see all role assignments across tenants.
   */
  async list(tenantId: string, callerRole: string) {
    if (callerRole === 'super_admin') {
      return db.select().from(userRoles);
    }
    return db
      .select()
      .from(userRoles)
      .where(eq(userRoles.tenantId, tenantId));
  }

  /**
   * Assign a role to a user within a tenant.
   * Enforces that:
   *  - The target user exists and belongs to the tenant (or caller is super_admin).
   *  - The user does not already hold the same role in the tenant.
   *  - Tenant admins cannot assign the super_admin role.
   */
  async assign(data: AssignRoleInput, tenantId: string, callerRole: string) {
    const targetTenantId = callerRole === 'super_admin' && data.tenantId
      ? data.tenantId
      : tenantId;

    // Prevent tenant_admin from escalating to super_admin
    if (callerRole !== 'super_admin' && data.role === 'super_admin') {
      throw new ForbiddenError('Only super admins can assign the super_admin role');
    }

    // Verify the target user exists and belongs to the tenant
    const [user] = await db
      .select()
      .from(profiles)
      .where(
        callerRole === 'super_admin'
          ? eq(profiles.id, data.userId)
          : and(eq(profiles.id, data.userId), eq(profiles.tenantId, targetTenantId)),
      )
      .limit(1);

    if (!user) throw new NotFoundError('User', data.userId);

    // Check for duplicate role assignment
    const [existing] = await db
      .select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, data.userId),
          eq(userRoles.tenantId, targetTenantId),
          eq(userRoles.role, data.role),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictError(`User already has the '${data.role}' role in this tenant`);
    }

    const [roleAssignment] = await db
      .insert(userRoles)
      .values({
        userId: data.userId,
        tenantId: targetTenantId,
        role: data.role,
      })
      .returning();

    return roleAssignment;
  }

  /**
   * Remove a role assignment by its ID.
   * Enforces tenant isolation unless the caller is super_admin.
   */
  async remove(id: string, tenantId: string, callerRole: string) {
    const conditions =
      callerRole === 'super_admin'
        ? eq(userRoles.id, id)
        : and(eq(userRoles.id, id), eq(userRoles.tenantId, tenantId));

    const [roleAssignment] = await db
      .delete(userRoles)
      .where(conditions)
      .returning();

    if (!roleAssignment) throw new NotFoundError('Role assignment', id);
  }
}
