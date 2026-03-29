import React, { lazy, Suspense, useState, useMemo, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const CommandPalette = lazy(() => import('@/components/CommandPalette'));
const AlarmVideoPopup = lazy(() => import('@/components/alarms/AlarmVideoPopup'));
const AIONFloatingAssistant = lazy(() => import('@/components/ai/AIONFloatingAssistant').then(m => ({ default: m.AIONFloatingAssistant })));
import { useI18n } from '@/contexts/I18nContext';
import { useBranding } from '@/contexts/BrandingContext';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  LayoutDashboard, Video, Play, Bell, MonitorSpeaker, MapPin, Puzzle, Bot,
  Settings, ScrollText, FileBarChart, Activity, ChevronLeft, Search,
  LogOut, User, Shield, AlertTriangle, Menu, X, Users, Globe,
  Zap, DoorOpen, RotateCcw, Phone, Database, MessageSquare, StickyNote,
  Clock, Timer, AlertOctagon, Navigation, CalendarClock,
  Cog, UserCheck, BarChart3, FileText, KeyRound, ShieldCheck, GraduationCap, Building2,
  FolderOpen, ClipboardList, PhoneCall, Scan
} from 'lucide-react';
import { hasModuleAccess, ALL_MODULES, DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/use-websocket';
import { apiClient } from '@/lib/api-client';
import Logo from '@/components/brand/Logo';

// ── Navigation with categories ─────────────────────────────

interface NavItem {
  labelKey: string;
  path: string;
  icon: React.ReactNode;
  badgeKey?: string;
}

interface NavCategory {
  key: string;
  labelKey: string;
  items: NavItem[];
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    key: 'monitoring',
    labelKey: 'nav.cat.monitoring',
    items: [
      { labelKey: 'nav.dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
      { labelKey: 'nav.live_view', path: '/live-view', icon: <Video size={18} /> },
      { labelKey: 'nav.playback', path: '/playback', icon: <Play size={18} /> },
      { labelKey: 'nav.events', path: '/events', icon: <Bell size={18} />, badgeKey: 'events' },
      { labelKey: 'nav.alerts', path: '/alerts', icon: <Shield size={18} />, badgeKey: 'alerts' },
      { labelKey: 'nav.incidents', path: '/incidents', icon: <AlertTriangle size={18} />, badgeKey: 'incidents' },
    ],
  },
  {
    key: 'infrastructure',
    labelKey: 'nav.cat.infrastructure',
    items: [
      { labelKey: 'nav.devices', path: '/devices', icon: <MonitorSpeaker size={18} /> },
      { labelKey: 'nav.sites', path: '/sites', icon: <MapPin size={18} /> },
      { labelKey: 'nav.domotics', path: '/domotics', icon: <Zap size={18} /> },
      { labelKey: 'nav.access_control', path: '/access-control', icon: <DoorOpen size={18} /> },
      { labelKey: 'nav.reboots', path: '/reboots', icon: <RotateCcw size={18} /> },
      { labelKey: 'nav.intercom', path: '/intercom', icon: <Phone size={18} /> },
    ],
  },
  {
    key: 'operations',
    labelKey: 'nav.cat.operations',
    items: [
      { labelKey: 'nav.shifts', path: '/shifts', icon: <Clock size={18} /> },
      { labelKey: 'nav.patrols', path: '/patrols', icon: <Navigation size={18} /> },
      { labelKey: 'nav.posts', path: '/posts', icon: <Building2 size={18} /> },
      { labelKey: 'nav.visitors', path: '/visitors', icon: <UserCheck size={18} /> },
      { labelKey: 'nav.emergency', path: '/emergency', icon: <AlertOctagon size={18} /> },
      { labelKey: 'nav.sla', path: '/sla', icon: <Timer size={18} /> },
      { labelKey: 'nav.automation', path: '/automation', icon: <Cog size={18} /> },
      { labelKey: 'nav.minuta', path: '/minuta', icon: <ClipboardList size={18} /> },
      { labelKey: 'nav.phone', path: '/phone', icon: <PhoneCall size={18} /> },
    ],
  },
  {
    key: 'intelligence',
    labelKey: 'nav.cat.intelligence',
    items: [
      // PredictiveCriminology and BiogeneticSearch hidden — no backend implementation (ADR-009)
      { labelKey: 'nav.ai_assistant', path: '/ai-assistant', icon: <Bot size={18} /> },
      { labelKey: 'nav.analytics', path: '/analytics', icon: <BarChart3 size={18} /> },
      { labelKey: 'nav.reports', path: '/reports', icon: <FileBarChart size={18} /> },
      { labelKey: 'nav.scheduled_reports', path: '/scheduled-reports', icon: <CalendarClock size={18} /> },
      { labelKey: 'nav.database', path: '/database', icon: <Database size={18} /> },
      { labelKey: 'nav.notes', path: '/notes', icon: <StickyNote size={18} /> },
      { labelKey: 'nav.documents', path: '/documents', icon: <FolderOpen size={18} /> },
    ],
  },
  {
    key: 'management',
    labelKey: 'nav.cat.management',
    items: [
      { labelKey: 'nav.contracts', path: '/contracts', icon: <FileText size={18} /> },
      { labelKey: 'nav.keys', path: '/keys', icon: <KeyRound size={18} /> },
      { labelKey: 'nav.compliance', path: '/compliance', icon: <ShieldCheck size={18} /> },
      { labelKey: 'nav.training', path: '/training', icon: <GraduationCap size={18} /> },
      { labelKey: 'nav.whatsapp', path: '/whatsapp', icon: <MessageSquare size={18} /> },
      { labelKey: 'nav.integrations', path: '/integrations', icon: <Puzzle size={18} /> },
    ],
  },
  {
    key: 'system',
    labelKey: 'nav.cat.system',
    items: [
      { labelKey: 'nav.audit', path: '/audit', icon: <ScrollText size={18} /> },
      { labelKey: 'nav.system', path: '/system', icon: <Activity size={18} /> },
      { labelKey: 'nav.settings', path: '/settings', icon: <Settings size={18} /> },
      { labelKey: 'nav.admin', path: '/admin', icon: <Users size={18} /> },
      { labelKey: 'nav.network', path: '/network', icon: <Scan size={18} /> },
    ],
  },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, logout, roles, isAuthenticated } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { branding } = useBranding();
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const { status: wsStatus } = useWebSocket(); // Establish real-time connection

  // ── Badge counts for sidebar nav ──────────────────────────
  interface PaginatedEnvelope { meta?: { total?: number }; items?: unknown[]; data?: unknown[]; count?: number }
  interface NotificationEvent { id: string; title?: string; description?: string; severity?: string; created_at?: string }

  const { data: eventCount = 0 } = useQuery({
    queryKey: ['sidebar-event-count'],
    queryFn: async () => {
      const resp = await apiClient.get<PaginatedEnvelope>('/events', { status: 'new', limit: '1' });
      return resp?.meta?.total ?? (Array.isArray(resp) ? (resp as unknown[]).length : 0);
    },
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  const { data: alertCount = 0 } = useQuery({
    queryKey: ['sidebar-alert-count'],
    queryFn: async () => {
      const resp = await apiClient.get<PaginatedEnvelope>('/alerts', { status: 'active', limit: '1' });
      return resp?.meta?.total ?? (Array.isArray(resp) ? (resp as unknown[]).length : 0);
    },
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  const { data: incidentCount = 0 } = useQuery({
    queryKey: ['sidebar-incident-count'],
    queryFn: async () => {
      const resp = await apiClient.get<PaginatedEnvelope>('/incidents', { status: 'open', limit: '1' });
      return resp?.meta?.total ?? (Array.isArray(resp) ? (resp as unknown[]).length : 0);
    },
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  const badgeCounts: Record<string, number> = useMemo(() => ({
    events: eventCount as number,
    alerts: alertCount as number,
    incidents: incidentCount as number,
  }), [eventCount, alertCount, incidentCount]);

  // ── Recent events for notification bell ───────────────────
  const { data: recentNotifications = [] } = useQuery({
    queryKey: ['header-notifications'],
    queryFn: async () => {
      const resp = await apiClient.get<PaginatedEnvelope>('/events', { limit: '5', status: 'new' });
      const items = Array.isArray(resp) ? resp : (resp?.items ?? resp?.data ?? []);
      return items as NotificationEvent[];
    },
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  const totalUnread = eventCount as number;

  const openCommandPalette = useCallback(() => {
    document.dispatchEvent(new CustomEvent('open-command-palette'));
  }, []);

  const { data: dbPerms } = useQuery({
    queryKey: ['role-module-permissions', profile?.tenant_id],
    queryFn: async () => {
      const data = await apiClient.get<DbPermRow[]>('/roles/permissions');
      return data || [];
    },
    enabled: !!profile?.tenant_id,
  });

  interface DbPermRow { role: string; module: string; enabled: boolean; tenant_id: string }

  const effectivePerms = useMemo(() => {
    const map: Record<string, string[]> = { ...DEFAULT_ROLE_PERMISSIONS };
    if (dbPerms && dbPerms.length > 0) {
      const editableRoles = ['operator', 'viewer', 'auditor'];
      for (const role of editableRoles) {
        const roleRows = (dbPerms as DbPermRow[]).filter((p) => p.role === role);
        if (roleRows.length > 0) {
          map[role] = roleRows.filter((p) => p.enabled).map((p) => p.module);
        }
      }
    }
    return map;
  }, [dbPerms]);

  // Filter categories based on user permissions
  const visibleCategories = useMemo(() => {
    return NAV_CATEGORIES.map(cat => ({
      ...cat,
      items: cat.items.filter((item: NavItem) => {
        const mod = ALL_MODULES.find(m => m.path === item.path);
        if (!mod) return true;
        return hasModuleAccess(roles, mod.module, effectivePerms);
      }),
    })).filter(cat => cat.items.length > 0);
  }, [roles, effectivePerms]);

  const displayName = profile?.full_name || user?.email || 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'AV';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[9999] focus:top-2 focus:left-2 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded">
        Saltar al contenido principal
      </a>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        role="navigation"
        aria-label="Main navigation"
        className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-16" : "w-60",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center h-14 px-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2 min-w-0">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.name || 'AION'} className="w-8 h-8 shrink-0" />
            ) : (
              <Logo variant="icon" height={32} className="shrink-0" onClick={() => {}} />
            )}
            {!collapsed && (
              <div className="truncate">
                <span className="font-semibold text-sm text-sidebar-primary-foreground" style={{ fontFamily: 'var(--font-heading)' }}>{branding.name || 'Clave Seguridad'}</span>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent hidden lg:flex" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar" aria-expanded={!collapsed}>
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-sidebar-muted lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav aria-label="Menu principal" className="flex-1 overflow-y-auto scrollbar-thin py-2 px-2">
          {visibleCategories.map((cat) => (
            <div key={cat.key} className="mb-1" role="group" aria-label={t(cat.labelKey) || cat.key}>
              {!collapsed && (
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted/70 mt-2 first:mt-0">
                  {t(cat.labelKey) || cat.key}
                </div>
              )}
              {collapsed && <div className="border-t border-sidebar-border/30 mx-2 my-1.5" />}
              {cat.items.map((item: NavItem) => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                const label = t(item.labelKey);
                return (
                  <button
                    key={item.path}
                    onClick={() => { navigate(item.path); setMobileOpen(false); }}
                    className={cn(
                      "flex items-center gap-3 w-full rounded-md px-3 py-1.5 text-sm transition-colors mb-0.5 relative",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary-foreground"
                    )}
                    title={collapsed ? label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="truncate">{label}</span>
                        {item.badgeKey && badgeCounts[item.badgeKey] > 0 && (
                          <span className="ml-auto flex items-center justify-center h-5 min-w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium px-1.5">
                            {badgeCounts[item.badgeKey]}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="User menu"
                className={cn(
                "flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent/50 transition-colors",
                collapsed && "justify-center px-0"
              )}>
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="text-left truncate">
                    <div className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</div>
                    <div className="text-[10px] text-sidebar-muted truncate">{user?.email}</div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/settings')}><User className="mr-2 h-4 w-4" /> {t('common.profile')}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/settings')}><Shield className="mr-2 h-4 w-4" /> {t('common.security')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" /> {t('common.sign_out')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className={cn("flex-1 flex flex-col transition-all duration-200", collapsed ? "lg:ml-16" : "lg:ml-60")}>
        <header className="sticky top-0 z-30 flex items-center h-14 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <Button variant="ghost" size="icon" className="lg:hidden mr-2" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </Button>
          <button
            onClick={openCommandPalette}
            className="relative flex-1 max-w-md flex items-center gap-2 h-9 px-3 rounded-md bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">{t('search.placeholder')}</span>
            <kbd className="ml-auto hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            {/* Network status indicator */}
            {!isOnline ? (
              <Badge variant="destructive" className="gap-1 text-[10px] h-6">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive-foreground animate-pulse" />
                [OFFLINE]
              </Badge>
            ) : isSlowConnection ? (
              <Badge variant="outline" className="gap-1 text-[10px] h-6 border-warning text-warning">
                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                {t('common.slow_connection') || 'Slow'}
              </Badge>
            ) : wsStatus === 'connected' ? (
              <Badge variant="outline" className="gap-1 text-[10px] h-6 border-success text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Live
              </Badge>
            ) : wsStatus === 'connecting' ? (
              <Badge variant="outline" className="gap-1 text-[10px] h-6 border-warning text-warning">
                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                {t('common.connecting') || 'Connecting'}
              </Badge>
            ) : null}
            {/* Language selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                  <Globe className="h-3.5 w-3.5" />
                  {lang === 'es' ? 'ES' : 'EN'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLang('es')} className={lang === 'es' ? 'bg-accent' : ''}>
                  🇪🇸 Español
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLang('en')} className={lang === 'en' ? 'bg-accent' : ''}>
                  🇬🇧 English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  {totalUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0" {...(totalUnread > 0 ? { role: 'alert' as const } : {})}>
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <p className="text-sm font-semibold">{t('common.notifications') || 'Notifications'}</p>
                  {totalUnread > 0 && (
                    <Badge variant="destructive" className="text-[10px]">{totalUnread} {t('common.new') || 'new'}</Badge>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {recentNotifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">{t('common.no_notifications') || 'No new notifications'}</p>
                  ) : (
                    recentNotifications.map((evt) => (
                      <button
                        key={evt.id}
                        className="flex items-start gap-3 w-full px-4 py-2.5 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0"
                        onClick={() => navigate('/events')}
                      >
                        <span className="mt-0.5 shrink-0">
                          {evt.severity === 'critical' ? <AlertTriangle className="h-4 w-4 text-destructive" /> :
                           evt.severity === 'high' ? <AlertTriangle className="h-4 w-4 text-warning" /> :
                           <Bell className="h-4 w-4 text-muted-foreground" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{evt.title || evt.description || 'Event'}</p>
                          {evt.created_at && (
                            <p className="text-[11px] text-muted-foreground">{new Date(evt.created_at).toLocaleString()}</p>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t px-4 py-2">
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate('/events')}>
                    {t('dashboard.view_all') || 'View all'} &rarr;
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <main id="main-content" className="flex-1 overflow-auto scrollbar-thin">
          <Outlet />
        </main>
        <footer className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center justify-between gap-4 shrink-0">
          <span>&copy; {new Date().getFullYear()} Clave Seguridad CTA</span>
          <nav className="flex items-center gap-3">
            <a href="/privacy" className="hover:underline">Privacidad</a>
            <a href="/terms" className="hover:underline">Términos</a>
            <a href="/cookies" className="hover:underline">Cookies</a>
          </nav>
        </footer>
      </div>
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
      <Suspense fallback={null}>
        <AlarmVideoPopup />
      </Suspense>
      <Suspense fallback={null}>
        <AIONFloatingAssistant />
      </Suspense>
    </div>
  );
}
