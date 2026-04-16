import type { FastifyInstance } from "fastify";
import { RoleService } from "./service.js";
import { assignRoleSchema } from "./schemas.js";
import { requireRole } from "../../plugins/auth.js";

export async function registerRoleRoutes(app: FastifyInstance) {
  const service = new RoleService();

  // Module-level permissions per role (used by AppLayout to filter sidebar)
  app.get(
    "/permissions",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async () => {
      return { success: true, data: [] };
    },
  );

  // List all role assignments for the tenant
  app.get(
    "/",
    { preHandler: [requireRole("super_admin", "tenant_admin")] },
    async (request) => {
      const data = await service.list(request.tenantId, request.userRole);
      return { success: true, data };
    },
  );

  // Assign a role to a user within the tenant
  app.post(
    "/assign",
    { preHandler: [requireRole("super_admin", "tenant_admin")] },
    async (request, reply) => {
      const body = assignRoleSchema.parse(request.body);
      const data = await service.assign(
        body,
        request.tenantId,
        request.userRole,
      );
      await request.audit("assign_role", "user_roles", data.id, {
        userId: body.userId,
        role: body.role,
      });
      reply.code(201);
      return { success: true, data };
    },
  );

  // Remove a role assignment by its ID
  app.delete(
    "/:id",
    { preHandler: [requireRole("super_admin", "tenant_admin")] },
    async (request) => {
      const { id } = request.params as { id: string };
      await service.remove(id, request.tenantId, request.userRole);
      await request.audit("remove_role", "user_roles", id);
      return { success: true };
    },
  );
}
