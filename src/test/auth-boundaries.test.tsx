import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasModuleAccess, ALL_MODULES } from "@/lib/permissions";

/**
 * Auth Boundaries Tests
 *
 * Validates that authentication and authorization boundaries
 * are correctly enforced at the routing and module level.
 */

describe("Auth Boundaries", () => {
  it("unauthenticated users have no module access", () => {
    // With empty roles (unauthenticated), no module should be accessible
    for (const mod of ALL_MODULES) {
      expect(hasModuleAccess([], mod.module)).toBe(false);
    }
  });

  it("viewer role has restricted access", () => {
    const allowedModules = ["dashboard", "live_view", "playback", "events", "reports", "documents"];
    const deniedModules = ALL_MODULES
      .map((m) => m.module)
      .filter((m) => !allowedModules.includes(m));

    for (const mod of allowedModules) {
      expect(hasModuleAccess(["viewer"], mod)).toBe(true);
    }
    for (const mod of deniedModules) {
      expect(hasModuleAccess(["viewer"], mod)).toBe(false);
    }
  });

  it("operator cannot access admin or audit", () => {
    expect(hasModuleAccess(["operator"], "admin")).toBe(false);
    expect(hasModuleAccess(["operator"], "audit")).toBe(false);
    expect(hasModuleAccess(["operator"], "system")).toBe(false);
    expect(hasModuleAccess(["operator"], "integrations")).toBe(false);
  });

  it("operator can access operational modules", () => {
    const operationalModules = [
      "dashboard", "live_view", "playback", "events", "incidents",
      "devices", "sites", "domotics", "access_control", "reboots",
      "intercom", "database", "ai_assistant", "reports", "settings",
    ];
    for (const mod of operationalModules) {
      expect(hasModuleAccess(["operator"], mod)).toBe(true);
    }
  });

  it("super_admin can access all modules", () => {
    for (const mod of ALL_MODULES) {
      expect(hasModuleAccess(["super_admin"], mod.module)).toBe(true);
    }
  });

  it("tenant_admin can access all modules", () => {
    for (const mod of ALL_MODULES) {
      expect(hasModuleAccess(["tenant_admin"], mod.module)).toBe(true);
    }
  });

  it("auditor has audit-specific access", () => {
    expect(hasModuleAccess(["auditor"], "audit")).toBe(true);
    expect(hasModuleAccess(["auditor"], "dashboard")).toBe(true);
    expect(hasModuleAccess(["auditor"], "events")).toBe(true);
    expect(hasModuleAccess(["auditor"], "incidents")).toBe(true);
    expect(hasModuleAccess(["auditor"], "reports")).toBe(true);
    // Auditor should not have operational access
    expect(hasModuleAccess(["auditor"], "devices")).toBe(false);
    expect(hasModuleAccess(["auditor"], "live_view")).toBe(false);
  });

  it("multiple roles combine access correctly", () => {
    // viewer + auditor should have combined access
    const combinedRoles = ["viewer", "auditor"];
    expect(hasModuleAccess(combinedRoles, "live_view")).toBe(true); // from viewer
    expect(hasModuleAccess(combinedRoles, "audit")).toBe(true); // from auditor
    expect(hasModuleAccess(combinedRoles, "admin")).toBe(false); // neither has this
  });

  it("all modules in router have corresponding permission entries", () => {
    const routeModules = [
      "dashboard", "live_view", "playback", "events", "incidents",
      "devices", "sites", "domotics", "access_control", "reboots",
      "intercom", "database", "ai_assistant", "integrations",
      "reports", "audit", "system", "settings", "admin",
    ];
    const permissionModules = ALL_MODULES.map((m) => m.module);

    for (const routeModule of routeModules) {
      expect(permissionModules).toContain(routeModule);
    }
  });
});
