import { describe, it, expect } from 'vitest';
import {
  ALL_MODULES,
  DEFAULT_ROLE_PERMISSIONS,
  getModulesForRole,
  hasModuleAccess,
} from '@/lib/permissions';

describe('ALL_MODULES', () => {
  it('contains exactly 32 modules', () => {
    expect(ALL_MODULES).toHaveLength(32);
  });

  it('each module has required properties', () => {
    for (const mod of ALL_MODULES) {
      expect(mod).toHaveProperty('module');
      expect(mod).toHaveProperty('label');
      expect(mod).toHaveProperty('icon');
      expect(mod).toHaveProperty('path');
      expect(mod.path).toMatch(/^\//);
    }
  });

  it('has no duplicate module names', () => {
    const names = ALL_MODULES.map((m) => m.module);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('getModulesForRole', () => {
  it('super_admin gets all 32 modules', () => {
    const modules = getModulesForRole('super_admin');
    expect(modules).toHaveLength(32);
  });

  it('tenant_admin gets all 32 modules', () => {
    const modules = getModulesForRole('tenant_admin');
    expect(modules).toHaveLength(32);
  });

  it('operator gets 26 modules', () => {
    const modules = getModulesForRole('operator');
    expect(modules).toHaveLength(26);
    expect(modules).not.toContain('admin');
    expect(modules).not.toContain('audit');
    expect(modules).not.toContain('system');
    expect(modules).not.toContain('integrations');
  });

  it('viewer gets exactly 5 modules', () => {
    const modules = getModulesForRole('viewer');
    expect(modules).toEqual(['dashboard', 'live_view', 'playback', 'events', 'reports']);
  });

  it('auditor gets exactly 5 modules', () => {
    const modules = getModulesForRole('auditor');
    expect(modules).toEqual(['dashboard', 'events', 'incidents', 'audit', 'reports']);
  });

  it('unknown role falls back to viewer permissions', () => {
    const modules = getModulesForRole('nonexistent_role');
    expect(modules).toEqual(DEFAULT_ROLE_PERMISSIONS.viewer);
  });
});

describe('hasModuleAccess', () => {
  it('super_admin always has access to any module', () => {
    expect(hasModuleAccess(['super_admin'], 'admin')).toBe(true);
    expect(hasModuleAccess(['super_admin'], 'nonexistent_module')).toBe(true);
  });

  it('tenant_admin always has access to any module', () => {
    expect(hasModuleAccess(['tenant_admin'], 'admin')).toBe(true);
    expect(hasModuleAccess(['tenant_admin'], 'nonexistent_module')).toBe(true);
  });

  it('viewer can access dashboard', () => {
    expect(hasModuleAccess(['viewer'], 'dashboard')).toBe(true);
  });

  it('viewer cannot access admin', () => {
    expect(hasModuleAccess(['viewer'], 'admin')).toBe(false);
  });

  it('viewer cannot access devices', () => {
    expect(hasModuleAccess(['viewer'], 'devices')).toBe(false);
  });

  it('operator can access devices but not admin', () => {
    expect(hasModuleAccess(['operator'], 'devices')).toBe(true);
    expect(hasModuleAccess(['operator'], 'admin')).toBe(false);
  });

  it('multi-role: access granted if any role has permission', () => {
    expect(hasModuleAccess(['viewer', 'operator'], 'devices')).toBe(true);
  });

  it('empty roles array denies access', () => {
    expect(hasModuleAccess([], 'dashboard')).toBe(false);
  });

  it('custom permissions map overrides defaults', () => {
    const custom = { custom_role: ['special_module'] };
    expect(hasModuleAccess(['custom_role'], 'special_module', custom)).toBe(true);
    expect(hasModuleAccess(['custom_role'], 'dashboard', custom)).toBe(false);
  });

  it('auditor can access audit but not devices', () => {
    expect(hasModuleAccess(['auditor'], 'audit')).toBe(true);
    expect(hasModuleAccess(['auditor'], 'devices')).toBe(false);
  });
});
