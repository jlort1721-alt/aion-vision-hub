import React, { lazy, Suspense, useState, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const CommandPalette = lazy(() => import('@/components/CommandPalette'));
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard, Video, Play, Bell, MonitorSpeaker, MapPin, Puzzle, Bot,
  Settings, ScrollText, FileBarChart, Activity, ChevronLeft, Search,
  LogOut, User, Shield, AlertTriangle, Menu, X, Users, Globe,
  Zap, DoorOpen, RotateCcw, Phone, Database, MessageSquare,
  Clock, Timer, AlertOctagon, Navigation, CalendarClock,
  Cog, UserCheck, BarChart3, FileText, KeyRound, ShieldCheck, GraduationCap
} from 'lucide-react';
import { hasModuleAccess, ALL_MODULES, DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/use-websocket';

interface NavItem {
  labelKey: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { labelKey: 'nav.dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { labelKey: 'nav.live_view', path: '/live-view', icon: <Video size={18} /> },
  { labelKey: 'nav.playback', path: '/playback', icon: <Play size={18} /> },
  { labelKey: 'nav.events', path: '/events', icon: <Bell size={18} />, badge: 3 },
  { labelKey: 'nav.alerts', path: '/alerts', icon: <Shield size={18} /> },
  { labelKey: 'nav.incidents', path: '/incidents', icon: <AlertTriangle size={18} />, badge: 1 },
  { labelKey: 'nav.devices', path: '/devices', icon: <MonitorSpeaker size={18} /> },
  { labelKey: 'nav.sites', path: '/sites', icon: <MapPin size={18} /> },
  { labelKey: 'nav.domotics', path: '/domotics', icon: <Zap size={18} /> },
  { labelKey: 'nav.access_control', path: '/access-control', icon: <DoorOpen size={18} /> },
  { labelKey: 'nav.reboots', path: '/reboots', icon: <RotateCcw size={18} /> },
  { labelKey: 'nav.intercom', path: '/intercom', icon: <Phone size={18} /> },
  { labelKey: 'nav.database', path: '/database', icon: <Database size={18} /> },
  { labelKey: 'nav.ai_assistant', path: '/ai-assistant', icon: <Bot size={18} /> },
  { labelKey: 'nav.whatsapp', path: '/whatsapp', icon: <MessageSquare size={18} /> },
  { labelKey: 'nav.shifts', path: '/shifts', icon: <Clock size={18} /> },
  { labelKey: 'nav.sla', path: '/sla', icon: <Timer size={18} /> },
  { labelKey: 'nav.emergency', path: '/emergency', icon: <AlertOctagon size={18} /> },
  { labelKey: 'nav.patrols', path: '/patrols', icon: <Navigation size={18} /> },
  { labelKey: 'nav.integrations', path: '/integrations', icon: <Puzzle size={18} /> },
  { labelKey: 'nav.reports', path: '/reports', icon: <FileBarChart size={18} /> },
  { labelKey: 'nav.scheduled_reports', path: '/scheduled-reports', icon: <CalendarClock size={18} /> },
  { labelKey: 'nav.automation', path: '/automation', icon: <Cog size={18} /> },
  { labelKey: 'nav.visitors', path: '/visitors', icon: <UserCheck size={18} /> },
  { labelKey: 'nav.analytics', path: '/analytics', icon: <BarChart3 size={18} /> },
  { labelKey: 'nav.contracts', path: '/contracts', icon: <FileText size={18} /> },
  { labelKey: 'nav.keys', path: '/keys', icon: <KeyRound size={18} /> },
  { labelKey: 'nav.compliance', path: '/compliance', icon: <ShieldCheck size={18} /> },
  { labelKey: 'nav.training', path: '/training', icon: <GraduationCap size={18} /> },
  { labelKey: 'nav.audit', path: '/audit', icon: <ScrollText size={18} /> },
  { labelKey: 'nav.system', path: '/system', icon: <Activity size={18} /> },
  { labelKey: 'nav.settings', path: '/settings', icon: <Settings size={18} /> },
  { labelKey: 'nav.admin', path: '/admin', icon: <Users size={18} /> },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, logout, roles } = useAuth();
  const { t, lang, setLang } = useI18n();
  useWebSocket(); // Establish real-time connection

  const { data: dbPerms } = useQuery({
    queryKey: ['role-module-permissions', profile?.tenant_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('role_module_permissions')
        .select('*')
        .eq('tenant_id', profile!.tenant_id);
      return data || [];
    },
    enabled: !!profile?.tenant_id,
  });

  const effectivePerms = useMemo(() => {
    const map: Record<string, string[]> = { ...DEFAULT_ROLE_PERMISSIONS };
    if (dbPerms && dbPerms.length > 0) {
      const editableRoles = ['operator', 'viewer', 'auditor'];
      for (const role of editableRoles) {
        const roleRows = dbPerms.filter((p: any) => p.role === role);
        if (roleRows.length > 0) {
          map[role] = roleRows.filter((p: any) => p.enabled).map((p: any) => p.module);
        }
      }
    }
    return map;
  }, [dbPerms]);

  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      const mod = ALL_MODULES.find(m => m.path === item.path);
      if (!mod) return true;
      return hasModuleAccess(roles, mod.module, effectivePerms);
    });
  }, [roles, effectivePerms]);

  const displayName = profile?.full_name || user?.email || 'User';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'AV';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-16" : "w-60",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center h-14 px-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm shrink-0">AV</div>
            {!collapsed && (
              <div className="truncate">
                <span className="font-semibold text-sm text-sidebar-primary-foreground">AION</span>
                <span className="text-xs text-sidebar-muted ml-1">Vision Hub</span>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent hidden lg:flex" onClick={() => setCollapsed(!collapsed)}>
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </Button>
          <Button variant="ghost" size="icon" className="ml-auto h-7 w-7 text-sidebar-muted lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin py-2 px-2">
          {visibleNavItems.map(item => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            const label = t(item.labelKey);
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                className={cn(
                  "flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm transition-colors mb-0.5",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary-foreground"
                )}
                title={collapsed ? label : undefined}
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="truncate">{label}</span>
                    {item.badge && (
                      <Badge variant="destructive" className="ml-auto h-5 min-w-5 text-[10px] px-1.5">{item.badge}</Badge>
                    )}
                  </>
                )}
                {collapsed && item.badge && (
                  <span className="absolute left-10 top-0.5 w-2 h-2 bg-destructive rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
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
          <Button variant="ghost" size="icon" className="lg:hidden mr-2" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('search.placeholder')} className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1" />
          </div>
          <div className="ml-auto flex items-center gap-2">
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
            <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/events')}>
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto scrollbar-thin">
          <Outlet />
        </main>
      </div>
      <Suspense fallback={null}>
        <CommandPalette />
      </Suspense>
    </div>
  );
}
