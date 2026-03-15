// Granular module permissions per role
// Defines which modules each role can access

export interface ModulePermission {
  module: string;
  label: string;
  icon: string;
  path: string;
}

export const ALL_MODULES: ModulePermission[] = [
  { module: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
  { module: 'live_view', label: 'Live View', icon: 'Video', path: '/live-view' },
  { module: 'playback', label: 'Playback', icon: 'Play', path: '/playback' },
  { module: 'events', label: 'Events', icon: 'Bell', path: '/events' },
  { module: 'alerts', label: 'Alerts', icon: 'Shield', path: '/alerts' },
  { module: 'incidents', label: 'Incidents', icon: 'AlertTriangle', path: '/incidents' },
  { module: 'devices', label: 'Devices', icon: 'MonitorSpeaker', path: '/devices' },
  { module: 'sites', label: 'Sites', icon: 'MapPin', path: '/sites' },
  { module: 'domotics', label: 'Domotics', icon: 'Zap', path: '/domotics' },
  { module: 'access_control', label: 'Access Control', icon: 'DoorOpen', path: '/access-control' },
  { module: 'reboots', label: 'Reboots', icon: 'RotateCcw', path: '/reboots' },
  { module: 'intercom', label: 'Intercom', icon: 'Phone', path: '/intercom' },
  { module: 'database', label: 'Database', icon: 'Database', path: '/database' },
  { module: 'ai_assistant', label: 'AI Assistant', icon: 'Bot', path: '/ai-assistant' },
  { module: 'integrations', label: 'Integrations', icon: 'Puzzle', path: '/integrations' },
  { module: 'reports', label: 'Reports', icon: 'FileBarChart', path: '/reports' },
  { module: 'audit', label: 'Audit Log', icon: 'ScrollText', path: '/audit' },
  { module: 'system', label: 'System Health', icon: 'Activity', path: '/system' },
  { module: 'shifts', label: 'Shifts & Guards', icon: 'Clock', path: '/shifts' },
  { module: 'sla', label: 'SLA Management', icon: 'Timer', path: '/sla' },
  { module: 'emergency', label: 'Emergency', icon: 'AlertOctagon', path: '/emergency' },
  { module: 'patrols', label: 'Patrols', icon: 'Navigation', path: '/patrols' },
  { module: 'scheduled_reports', label: 'Scheduled Reports', icon: 'CalendarClock', path: '/scheduled-reports' },
  { module: 'automation', label: 'Automation', icon: 'Cog', path: '/automation' },
  { module: 'visitors', label: 'Visitors', icon: 'UserCheck', path: '/visitors' },
  { module: 'analytics', label: 'Analytics', icon: 'BarChart3', path: '/analytics' },
  { module: 'settings', label: 'Settings', icon: 'Settings', path: '/settings' },
  { module: 'admin', label: 'Admin', icon: 'Users', path: '/admin' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ALL_MODULES.map(m => m.module),
  tenant_admin: ALL_MODULES.map(m => m.module),
  operator: [
    'dashboard', 'live_view', 'playback', 'events', 'alerts', 'incidents',
    'devices', 'sites', 'domotics', 'access_control', 'reboots',
    'intercom', 'database', 'ai_assistant', 'reports', 'settings',
    'shifts', 'sla', 'emergency', 'patrols',
    'automation', 'visitors', 'analytics',
  ],
  viewer: [
    'dashboard', 'live_view', 'playback', 'events', 'reports',
  ],
  auditor: [
    'dashboard', 'events', 'incidents', 'audit', 'reports',
  ],
};

export function getModulesForRole(role: string): string[] {
  return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.viewer;
}

export function hasModuleAccess(roles: string[], moduleName: string, customPerms?: Record<string, string[]>): boolean {
  // Super/tenant admin always has access
  if (roles.includes('super_admin') || roles.includes('tenant_admin')) return true;
  const permsMap = customPerms || DEFAULT_ROLE_PERMISSIONS;
  return roles.some(role => {
    const perms = permsMap[role];
    return perms?.includes(moduleName);
  });
}
