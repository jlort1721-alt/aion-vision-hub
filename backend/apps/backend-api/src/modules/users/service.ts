import { eq, and } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { profiles, userRoles } from '../../db/schema/index.js';
import { NotFoundError } from '@aion/shared-contracts';

interface CreateUserInput {
  id?: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role?: string;
}

interface UpdateUserInput {
  fullName?: string;
  avatarUrl?: string | null;
  isActive?: boolean;
}

export class UserService {
  /**
   * List all users belonging to the given tenant.
   */
  async list(tenantId: string) {
    return db
      .select()
      .from(profiles)
      .where(eq(profiles.tenantId, tenantId));
  }

  /**
   * Get a single user by ID, enforcing tenant isolation.
   * Super admins can view any user; others can only view users within their tenant.
   */
  async getById(id: string, tenantId: string, role: string) {
    const conditions =
      role === 'super_admin'
        ? eq(profiles.id, id)
        : and(eq(profiles.id, id), eq(profiles.tenantId, tenantId));

    const [user] = await db
      .select()
      .from(profiles)
      .where(conditions)
      .limit(1);

    if (!user) throw new NotFoundError('User', id);
    return user;
  }

  /**
   * Get the requesting user's own profile by their auth user ID.
   */
  async getMe(userId: string) {
    const [user] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    if (!user) throw new NotFoundError('User', userId);
    return user;
  }

  /**
   * Create a new user profile and assign a role within the tenant.
   */
  async create(data: CreateUserInput, tenantId: string, _callerRole: string) {
    // Only super_admin can create users in a different tenant
    const targetTenantId = tenantId;

    const userId = data.id ?? crypto.randomUUID();

    const [user] = await db
      .insert(profiles)
      .values({
        id: userId,
        userId: userId,
        fullName: data.fullName,
        tenantId: targetTenantId,
        avatarUrl: data.avatarUrl ?? null,
      })
      .returning();

    // Assign role (default to 'viewer' if not specified)
    const assignedRole = data.role ?? 'viewer';
    await db.insert(userRoles).values({
      userId: user.id,
      tenantId: targetTenantId,
      role: assignedRole,
    });

    return user;
  }

  /**
   * Update a user profile. Enforces tenant isolation unless caller is super_admin.
   */
  async update(id: string, data: UpdateUserInput, tenantId: string, callerRole: string) {
    // Verify the user exists and belongs to the caller's tenant
    await this.getById(id, tenantId, callerRole);

    const [user] = await db
      .update(profiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .returning();

    if (!user) throw new NotFoundError('User', id);
    return user;
  }

  /**
   * Delete a user profile. Enforces tenant isolation unless caller is super_admin.
   * Cascade-deletes related user_roles via the FK constraint.
   */
  async delete(id: string, tenantId: string, callerRole: string) {
    // Verify the user exists and belongs to the caller's tenant
    await this.getById(id, tenantId, callerRole);

    const [user] = await db
      .delete(profiles)
      .where(eq(profiles.id, id))
      .returning();

    if (!user) throw new NotFoundError('User', id);
  }
}
