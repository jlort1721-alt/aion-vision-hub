import { describe, it, expect } from 'vitest';
import {
  ALL_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
  getModulesForRole,
  hasModuleAccess,
} from '@/lib/permissions';

describe('Role-based module permissions', () => {
  // ── super_admin ──────────────────────────────────────

  describe('super_admin', () => {
    it('has access to ALL modules', () => {
      const modules = getModulesForRole('super_admin');
      expect(modules.length).toBe(ALL_MODULES.length);
      for (const mod of ALL_MODULES) {
        expect(modules).toContain(mod.module);
      }
    });

    it('hasModuleAccess returns true for any module', () => {
      expect(hasModuleAccess(['super_admin'], 'dashboard')).toBe(true);
      expect(hasModuleAccess(['super_admin'], 'admin')).toBe(true);
      expect(hasModuleAccess(['super_admin'], 'audit')).toBe(true);
      expect(hasModuleAccess(['super_admin'], 'nonexistent_module')).toBe(true);
    });
  });

  // ── tenant_admin ─────────────────────────────────────

  describe('tenant_admin', () => {
    it('has access to ALL modules', () => {
      const modules = getModulesForRole('tenant_admin');
      expect(modules.length).toBe(ALL_MODULES.length);
    });

    it('hasModuleAccess returns true for any module', () => {
      expect(hasModuleAccess(['tenant_admin'], 'dashboard')).toBe(true);
      expect(hasModuleAccess(['tenant_admin'], 'admin')).toBe(true);
      expect(hasModuleAccess(['tenant_admin'], 'nonexistent_module')).toBe(true);
    });
  });

  // ── operator ─────────────────────────────────────────

  describe('operator', () => {
    const operatorModules = getModulesForRole('operator');

    it('has access to core monitoring modules', () => {
      const expected = [
        'dashboard', 'live_view', 'playback', 'events', 'alerts', 'incidents',
      ];
      for (const mod of expected) {
        expect(operatorModules).toContain(mod);
      }
    });

    it('has access to device and site management', () => {
      expect(operatorModules).toContain('devices');
      expect(operatorModules).toContain('sites');
    });

    it('has access to automation and operational modules', () => {
      expect(operatorModules).toContain('domotics');
      expect(operatorModules).toContain('access_control');
      expect(operatorModules).toContain('reboots');
      expect(operatorModules).toContain('intercom');
      expect(operatorModules).toContain('automation');
    });

    it('does NOT have access to admin-only modules', () => {
      expect(operatorModules).not.toContain('admin');
      expect(operatorModules).not.toContain('audit');
      expect(operatorModules).not.toContain('system');
      expect(operatorModules).not.toContain('integrations');
    });

    it('has access to field modules: shifts, patrols, emergency', () => {
      expect(operatorModules).toContain('shifts');
      expect(operatorModules).toContain('patrols');
      expect(operatorModules).toContain('emergency');
    });

    it('hasModuleAccess works correctly for operator', () => {
      expect(hasModuleAccess(['operator'], 'dashboard')).toBe(true);
      expect(hasModuleAccess(['operator'], 'devices')).toBe(true);
      expect(hasModuleAccess(['operator'], 'admin')).toBe(false);
      expect(hasModuleAccess(['operator'], 'audit')).toBe(false);
    });
  });

  // ── viewer ───────────────────────────────────────────

  describe('viewer', () => {
    const viewerModules = getModulesForRole('viewer');

    it('has exactly 6 modules', () => {
      expect(viewerModules).toHaveLength(6);
    });

    it('can access dashboard, live_view, playback, events, reports, documents', () => {
      expect(viewerModules).toEqual([
        'dashboard', 'live_view', 'playback', 'events', 'reports', 'documents',
      ]);
    });

    it('cannot access devices, admin, incidents, or settings', () => {
      expect(viewerModules).not.toContain('devices');
      expect(viewerModules).not.toContain('admin');
      expect(viewerModules).not.toContain('incidents');
      expect(viewerModules).not.toContain('settings');
    });

    it('hasModuleAccess returns false for restricted modules', () => {
      expect(hasModuleAccess(['viewer'], 'admin')).toBe(false);
      expect(hasModuleAccess(['viewer'], 'devices')).toBe(false);
      expect(hasModuleAccess(['viewer'], 'incidents')).toBe(false);
    });
  });

  // ── auditor ──────────────────────────────────────────

  describe('auditor', () => {
    const auditorModules = getModulesForRole('auditor');

    it('has exactly 7 modules', () => {
      expect(auditorModules).toHaveLength(7);
    });

    it('includes audit-specific modules: audit, incidents, reports', () => {
      expect(auditorModules).toContain('audit');
      expect(auditorModules).toContain('incidents');
      expect(auditorModules).toContain('reports');
    });

    it('includes read-only modules: dashboard, events, documents, notes', () => {
      expect(auditorModules).toContain('dashboard');
      expect(auditorModules).toContain('events');
      expect(auditorModules).toContain('documents');
      expect(auditorModules).toContain('notes');
    });

    it('cannot access admin, devices, or live_view', () => {
      expect(auditorModules).not.toContain('admin');
      expect(auditorModules).not.toContain('devices');
      expect(auditorModules).not.toContain('live_view');
    });
  });

  // ── Edge cases ───────────────────────────────────────

  describe('edge cases', () => {
    it('unknown role falls back to viewer permissions', () => {
      const modules = getModulesForRole('nonexistent_role');
      expect(modules).toEqual(DEFAULT_ROLE_PERMISSIONS.viewer);
    });

    it('hasModuleAccess returns false for empty roles array', () => {
      expect(hasModuleAccess([], 'dashboard')).toBe(false);
    });

    it('hasModuleAccess returns false for non-existent role (not in perms map)', () => {
      expect(hasModuleAccess(['ghost_role'], 'dashboard')).toBe(false);
    });

    it('multi-role: access granted if any role has the permission', () => {
      // viewer cannot access devices, operator can
      expect(hasModuleAccess(['viewer', 'operator'], 'devices')).toBe(true);
    });

    it('multi-role: denied only if no role has the permission', () => {
      expect(hasModuleAccess(['viewer', 'auditor'], 'admin')).toBe(false);
    });

    it('custom permissions override defaults', () => {
      const custom = { custom_role: ['special_module', 'dashboard'] };
      expect(hasModuleAccess(['custom_role'], 'special_module', custom)).toBe(true);
      expect(hasModuleAccess(['custom_role'], 'dashboard', custom)).toBe(true);
      expect(hasModuleAccess(['custom_role'], 'admin', custom)).toBe(false);
    });

    it('custom permissions: role not in custom map returns false', () => {
      const custom = { some_role: ['dashboard'] };
      expect(hasModuleAccess(['other_role'], 'dashboard', custom)).toBe(false);
    });
  });

  // ── ALL_MODULES structure ────────────────────────────

  describe('ALL_MODULES data integrity', () => {
    it('has at least 32 modules', () => {
      expect(ALL_MODULES.length).toBeGreaterThanOrEqual(32);
    });

    it('every module has required properties with correct types', () => {
      for (const mod of ALL_MODULES) {
        expect(typeof mod.module).toBe('string');
        expect(typeof mod.label).toBe('string');
        expect(typeof mod.icon).toBe('string');
        expect(typeof mod.path).toBe('string');
        expect(mod.path).toMatch(/^\//);
      }
    });

    it('has no duplicate module names', () => {
      const names = ALL_MODULES.map((m) => m.module);
      expect(new Set(names).size).toBe(names.length);
    });

    it('has no duplicate paths', () => {
      const paths = ALL_MODULES.map((m) => m.path);
      expect(new Set(paths).size).toBe(paths.length);
    });
  });
});
