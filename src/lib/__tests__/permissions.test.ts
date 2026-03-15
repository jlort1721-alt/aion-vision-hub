import { describe, it, expect } from "vitest";
import {
  hasModuleAccess,
  getModulesForRole,
  ALL_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
} from "../permissions";

describe("permissions", () => {
  describe("ALL_MODULES", () => {
    it("contains all expected modules", () => {
      const moduleNames = ALL_MODULES.map((m) => m.module);
      expect(moduleNames).toContain("dashboard");
      expect(moduleNames).toContain("live_view");
      expect(moduleNames).toContain("events");
      expect(moduleNames).toContain("incidents");
      expect(moduleNames).toContain("admin");
      expect(moduleNames).toContain("settings");
      expect(moduleNames.length).toBeGreaterThanOrEqual(14);
    });

    it("every module has required fields", () => {
      for (const mod of ALL_MODULES) {
        expect(mod.module).toBeTruthy();
        expect(mod.label).toBeTruthy();
        expect(mod.icon).toBeTruthy();
        expect(mod.path).toMatch(/^\//);
      }
    });
  });

  describe("DEFAULT_ROLE_PERMISSIONS", () => {
    it("super_admin has access to all modules", () => {
      const allModules = ALL_MODULES.map((m) => m.module);
      expect(DEFAULT_ROLE_PERMISSIONS.super_admin).toEqual(allModules);
    });

    it("tenant_admin has access to all modules", () => {
      const allModules = ALL_MODULES.map((m) => m.module);
      expect(DEFAULT_ROLE_PERMISSIONS.tenant_admin).toEqual(allModules);
    });

    it("viewer has limited access", () => {
      const viewerPerms = DEFAULT_ROLE_PERMISSIONS.viewer;
      expect(viewerPerms).toContain("dashboard");
      expect(viewerPerms).toContain("live_view");
      expect(viewerPerms).not.toContain("admin");
      expect(viewerPerms).not.toContain("settings");
    });

    it("auditor has audit access", () => {
      expect(DEFAULT_ROLE_PERMISSIONS.auditor).toContain("audit");
      expect(DEFAULT_ROLE_PERMISSIONS.auditor).toContain("dashboard");
    });

    it("operator has operational access but not admin", () => {
      const operatorPerms = DEFAULT_ROLE_PERMISSIONS.operator;
      expect(operatorPerms).toContain("dashboard");
      expect(operatorPerms).toContain("live_view");
      expect(operatorPerms).toContain("devices");
      expect(operatorPerms).not.toContain("admin");
      expect(operatorPerms).not.toContain("audit");
    });
  });

  describe("getModulesForRole", () => {
    it("returns correct modules for known roles", () => {
      expect(getModulesForRole("super_admin")).toEqual(
        DEFAULT_ROLE_PERMISSIONS.super_admin
      );
      expect(getModulesForRole("viewer")).toEqual(
        DEFAULT_ROLE_PERMISSIONS.viewer
      );
    });

    it("returns viewer permissions for unknown roles", () => {
      expect(getModulesForRole("unknown_role")).toEqual(
        DEFAULT_ROLE_PERMISSIONS.viewer
      );
    });
  });

  describe("hasModuleAccess", () => {
    it("super_admin has access to everything", () => {
      expect(hasModuleAccess(["super_admin"], "admin")).toBe(true);
      expect(hasModuleAccess(["super_admin"], "dashboard")).toBe(true);
      expect(hasModuleAccess(["super_admin"], "audit")).toBe(true);
    });

    it("tenant_admin has access to everything", () => {
      expect(hasModuleAccess(["tenant_admin"], "admin")).toBe(true);
      expect(hasModuleAccess(["tenant_admin"], "settings")).toBe(true);
    });

    it("operator cannot access admin", () => {
      expect(hasModuleAccess(["operator"], "admin")).toBe(false);
    });

    it("viewer cannot access devices", () => {
      expect(hasModuleAccess(["viewer"], "devices")).toBe(false);
    });

    it("viewer can access dashboard", () => {
      expect(hasModuleAccess(["viewer"], "dashboard")).toBe(true);
    });

    it("multiple roles combine access", () => {
      // viewer alone can't access audit, auditor can
      expect(hasModuleAccess(["viewer"], "audit")).toBe(false);
      expect(hasModuleAccess(["auditor"], "audit")).toBe(true);
      expect(hasModuleAccess(["viewer", "auditor"], "audit")).toBe(true);
    });

    it("empty roles have no access", () => {
      expect(hasModuleAccess([], "dashboard")).toBe(false);
    });

    it("accepts custom permissions map", () => {
      const customPerms = {
        custom_role: ["dashboard", "reports"],
      };
      expect(hasModuleAccess(["custom_role"], "dashboard", customPerms)).toBe(true);
      expect(hasModuleAccess(["custom_role"], "admin", customPerms)).toBe(false);
    });
  });
});
