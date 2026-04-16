import type { FastifyInstance } from "fastify";
import { requireRole } from "../../plugins/auth.js";
import { ewelinkProxyService } from "./service.js";
import {
  ewelinkLoginSchema,
  ewelinkControlSchema,
  ewelinkBatchControlSchema,
  ewelinkAutoLoginSchema,
  ewelinkSwitchAccountSchema,
} from "./schemas.js";
import type { ApiResponse } from "@aion/shared-contracts";

export async function registerEWeLinkRoutes(app: FastifyInstance) {
  // ── GET /health — Health check ──────────────────────────────
  app.get(
    "/health",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request) => {
      const result = await ewelinkProxyService.healthCheck(request.tenantId);
      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── GET /test-connection — Full pipeline verification ────────
  app.get(
    "/test-connection",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request) => {
      const result = await ewelinkProxyService.testConnection(request.tenantId);
      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── GET /status — Lightweight auth status check ──────────────
  app.get(
    "/status",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request) => {
      const result = await ewelinkProxyService.getStatus(request.tenantId);
      return { success: true, data: result } satisfies ApiResponse;
    },
  );

  // ── POST /login — Authenticate with eWeLink ────────────────
  app.post(
    "/login",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request) => {
      const { email, password, countryCode } = ewelinkLoginSchema.parse(
        request.body,
      );
      const result = await ewelinkProxyService.login(
        request.tenantId,
        email,
        password,
        countryCode,
      );

      await request.audit("ewelink.login", "ewelink", undefined, {
        success: result.success,
      });

      return {
        success: result.success,
        data: result.data || result.error,
      } satisfies ApiResponse;
    },
  );

  // ── POST /logout — Clear eWeLink session ───────────────────
  app.post(
    "/logout",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request) => {
      await ewelinkProxyService.logout(request.tenantId);

      await request.audit("ewelink.logout", "ewelink", undefined, {});

      return {
        success: true,
        data: { message: "Logged out from eWeLink" },
      } satisfies ApiResponse;
    },
  );

  // ── GET /devices — List devices ─────────────────────────────
  app.get(
    "/devices",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request) => {
      try {
        const devices = await ewelinkProxyService.listDevices(request.tenantId);
        return {
          success: true,
          data: { devices, total: devices.length },
        } satisfies ApiResponse;
      } catch (err: any) {
        return {
          success: true,
          data: {
            devices: [],
            total: 0,
            status: "ewelink_unavailable",
            reason: err?.message ?? "eWeLink API authentication failed",
          },
        };
      }
    },
  );

  // ── GET /devices/:deviceId/state — Get device state ─────────
  app.get<{ Params: { deviceId: string } }>(
    "/devices/:deviceId/state",
    {
      preHandler: [
        requireRole("viewer", "operator", "tenant_admin", "super_admin"),
      ],
    },
    async (request) => {
      const result = await ewelinkProxyService.getDeviceState(
        request.tenantId,
        request.params.deviceId,
      );
      return {
        success: result.success,
        data: result.data || result.error,
      } satisfies ApiResponse;
    },
  );

  // ── POST /devices/control — Control single device ───────────
  app.post(
    "/devices/control",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request) => {
      const { deviceId, action, outlet } = ewelinkControlSchema.parse(
        request.body,
      );
      const result = await ewelinkProxyService.controlDevice(
        request.tenantId,
        deviceId,
        action,
        outlet,
      );

      await request.audit("ewelink.control", "ewelink", deviceId, {
        action,
        outlet,
        success: result.success,
      });

      return {
        success: result.success,
        data: result.data || result.error,
      } satisfies ApiResponse;
    },
  );

  // ── POST /devices/batch — Batch control ─────────────────────
  app.post(
    "/devices/batch",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request) => {
      const { actions } = ewelinkBatchControlSchema.parse(request.body);
      const results = await ewelinkProxyService.batchControl(
        request.tenantId,
        actions,
      );

      await request.audit("ewelink.batch_control", "ewelink", undefined, {
        count: actions.length,
      });

      return { success: true, data: results } satisfies ApiResponse;
    },
  );

  // ── GET /accounts — List stored eWeLink accounts (masked) ────
  app.get(
    "/accounts",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async () => {
      const accounts = ewelinkProxyService.getStoredAccountList();
      return {
        success: true,
        data: {
          accounts,
          hasStoredAccounts: accounts.length > 0,
        },
      } satisfies ApiResponse;
    },
  );

  // ── POST /auto-login — Auto-login with a stored account ──────
  app.post(
    "/auto-login",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request) => {
      const { accountLabel } = ewelinkAutoLoginSchema.parse(request.body ?? {});
      const result = await ewelinkProxyService.autoLogin(
        request.tenantId,
        accountLabel,
      );

      await request.audit("ewelink.auto_login", "ewelink", undefined, {
        success: result.success,
        account: result.account,
      });

      return { success: result.success, data: result } satisfies ApiResponse;
    },
  );

  // ── POST /switch-account — Switch to a different stored account
  app.post(
    "/switch-account",
    { preHandler: [requireRole("operator", "tenant_admin", "super_admin")] },
    async (request) => {
      const { accountLabel } = ewelinkSwitchAccountSchema.parse(request.body);
      const result = await ewelinkProxyService.switchAccount(
        request.tenantId,
        accountLabel,
      );

      await request.audit("ewelink.switch_account", "ewelink", undefined, {
        success: result.success,
        account: result.account,
      });

      return { success: result.success, data: result } satisfies ApiResponse;
    },
  );
}
