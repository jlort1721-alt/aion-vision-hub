import { useState, useEffect, useSyncExternalStore } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import ErrorState from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useTheme } from '@/contexts/ThemeContext';
import { apiClient } from '@/lib/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  User, Shield, Bell, Palette, Globe, Database, Save,
  Loader2, Flag, BellRing, History, Trash2, Bot, Lock, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { getNotificationHistory, clearNotificationHistory, subscribeNotificationHistory } from '@/lib/notification-history';
import { PageShell } from '@/components/shared/PageShell';

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const { permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
  const { t, lang, setLang } = useI18n();
  const { setTheme } = useTheme();

  const notifHistory = useSyncExternalStore(subscribeNotificationHistory, getNotificationHistory);

  // ── Queries ──
  const { data: tenant, isLoading: loadingTenant, isError, error, refetch } = useQuery({
    queryKey: ['tenant'],
    queryFn: () => apiClient.get<any>('/tenants/current'),
    enabled: !!profile,
  });

  const { data: featureFlags = [], isLoading: loadingFlags } = useQuery({
    queryKey: ['feature_flags'],
    queryFn: async () => { const r = await apiClient.get<any>('/database-records', { category: 'feature_flag' }); return Array.isArray(r) ? r : []; },
  });

  // ── Local state ──
  const [tenantName, setTenantName] = useState('');
  const [tenantTimezone, setTenantTimezone] = useState('UTC');
  const [fullName, setFullName] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [twoFactor, setTwoFactor] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [strongPasswords, setStrongPasswords] = useState(true);
  const [defaultAiProvider, setDefaultAiProvider] = useState('lovable');
  const [fallbackProvider, setFallbackProvider] = useState('openai');
  const [eventRetention, setEventRetention] = useState('90');
  const [auditRetention, setAuditRetention] = useState('365');
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    critical_events: true, high_severity: true, device_offline: true, health_changes: false, incident_updates: false,
  });

  // Init from tenant
  useEffect(() => {
    if (tenant) {
      setTenantName(tenant.name);
      setTenantTimezone(tenant.timezone);
      const s = (tenant.settings as Record<string, any>) || {};
      setDarkMode(s.dark_mode ?? true);
      setCompactMode(s.compact_mode ?? false);
      setTwoFactor(s.two_factor ?? false);
      setSessionTimeout(s.session_timeout ?? '30');
      setStrongPasswords(s.strong_passwords ?? true);
      setDefaultAiProvider(s.ai_provider ?? 'lovable');
      setFallbackProvider(s.ai_fallback ?? 'openai');
      setEventRetention(s.event_retention ?? '90');
      setAuditRetention(s.audit_retention ?? '365');
      setNotifications(s.notifications ?? { critical_events: true, high_severity: true, device_offline: true, health_changes: false, incident_updates: false });
    }
  }, [tenant]);

  useEffect(() => { if (profile) setFullName(profile.full_name); }, [profile]);

  // ── Save handlers ──
  const saveTenantSettings = async () => {
    if (!tenant) return;
    setSaving('tenant');
    try {
      await apiClient.patch(`/tenants/${tenant.id}`, {
        name: tenantName, timezone: tenantTimezone,
        settings: {
          dark_mode: darkMode, compact_mode: compactMode, two_factor: twoFactor,
          session_timeout: sessionTimeout, strong_passwords: strongPasswords,
          ai_provider: defaultAiProvider, ai_fallback: fallbackProvider,
          event_retention: eventRetention, audit_retention: auditRetention, notifications,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast.success('Configuración guardada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error guardando');
    } finally { setSaving(null); }
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving('profile');
    try {
      await apiClient.patch(`/users/${profile.id}`, { fullName });
      toast.success('Perfil actualizado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error guardando');
    } finally { setSaving(null); }
  };

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell title={t('settings.title')} description={t('settings.subtitle')} icon={<Settings className="h-5 w-5" />}>
    <div className="p-5 space-y-5 max-w-4xl">

      <Tabs defaultValue="general">
        <TabsList className="bg-slate-800/50 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="general" className="text-xs gap-1"><Globe className="h-3 w-3" /> {t('settings.general')}</TabsTrigger>
          <TabsTrigger value="security" className="text-xs gap-1"><Shield className="h-3 w-3" /> {t('settings.security')}</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs gap-1"><Bell className="h-3 w-3" /> {t('settings.notifications')}</TabsTrigger>
          <TabsTrigger value="ai" className="text-xs gap-1"><Bot className="h-3 w-3" /> IA</TabsTrigger>
          <TabsTrigger value="flags" className="text-xs gap-1"><Flag className="h-3 w-3" /> Flags</TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs gap-1"><Database className="h-3 w-3" /> {t('settings.advanced')}</TabsTrigger>
        </TabsList>

        {/* ═══ General Tab ═══ */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-blue-400" /> {t('settings.tenant')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {loadingTenant ? <Skeleton className="h-20 w-full" /> : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-xs text-slate-400">{t('settings.org_name')}</Label><Input value={tenantName} onChange={e => setTenantName(e.target.value)} className="bg-slate-900 border-slate-700" /></div>
                    <div className="space-y-1.5"><Label className="text-xs text-slate-400">{t('settings.timezone')}</Label>
                      <Select value={tenantTimezone} onValueChange={setTenantTimezone}>
                        <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/Bogota">Bogotá (COT, UTC-5)</SelectItem>
                          <SelectItem value="America/New_York">New York (EST, UTC-5)</SelectItem>
                          <SelectItem value="America/Sao_Paulo">São Paulo (BRT, UTC-3)</SelectItem>
                          <SelectItem value="Europe/Madrid">Madrid (CET, UTC+1)</SelectItem>
                          <SelectItem value="UTC">UTC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <SaveButton onClick={saveTenantSettings} saving={saving === 'tenant'} />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4 text-emerald-400" /> {t('settings.profile')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-xs text-slate-400">{t('settings.full_name')}</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} className="bg-slate-900 border-slate-700" /></div>
                <div className="space-y-1.5"><Label className="text-xs text-slate-400">{t('settings.email')}</Label><Input defaultValue={user?.email} disabled className="bg-slate-900/50 border-slate-700 opacity-60" /></div>
              </div>
              <SaveButton onClick={saveProfile} saving={saving === 'profile'} label="Guardar Perfil" />
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-purple-400" /> {t('settings.language')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-slate-400">{t('settings.language_desc')}</p>
              <Select value={lang} onValueChange={v => setLang(v as 'es' | 'en')}>
                <SelectTrigger className="w-48 bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="es">Español</SelectItem><SelectItem value="en">English</SelectItem></SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4 text-amber-400" /> {t('settings.appearance')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <SettingRow label={t('settings.dark_mode')} desc={t('settings.dark_mode_desc')} control={<Switch checked={darkMode} onCheckedChange={v => { setDarkMode(v); setTheme(v ? 'dark' : 'light'); }} className="h-4 w-8" />} />
              <Separator className="bg-slate-700/50" />
              <SettingRow label={t('settings.compact_mode')} desc={t('settings.compact_mode_desc')} control={<Switch checked={compactMode} onCheckedChange={setCompactMode} className="h-4 w-8" />} />
              <SaveButton onClick={saveTenantSettings} saving={!!saving} label={t('settings.save_appearance')} variant="secondary" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Security Tab ═══ */}
        <TabsContent value="security" className="space-y-4 mt-4">
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-red-400" /> {t('settings.security')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <SettingRow label={t('settings.two_factor')} desc={t('settings.two_factor_desc')} control={<Switch checked={twoFactor} onCheckedChange={setTwoFactor} className="h-4 w-8" />} />
              <Separator className="bg-slate-700/50" />
              <SettingRow label={t('settings.session_timeout')} desc={t('settings.session_timeout_desc')} control={
                <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                  <SelectTrigger className="w-32 bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="15">15 min</SelectItem><SelectItem value="30">30 min</SelectItem><SelectItem value="60">60 min</SelectItem><SelectItem value="never">Sin límite</SelectItem></SelectContent>
                </Select>
              } />
              <Separator className="bg-slate-700/50" />
              <SettingRow label={t('settings.strong_passwords')} desc={t('settings.strong_passwords_desc')} control={<Switch checked={strongPasswords} onCheckedChange={setStrongPasswords} className="h-4 w-8" />} />
              <SaveButton onClick={saveTenantSettings} saving={!!saving} label={t('settings.save_security')} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Notifications Tab ═══ */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4 text-amber-400" /> {t('settings.notification_prefs')}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: 'critical_events', label: t('settings.critical_events') },
                { key: 'high_severity', label: t('settings.high_severity') },
                { key: 'device_offline', label: t('settings.device_offline') },
                { key: 'health_changes', label: t('settings.health_changes') },
                { key: 'incident_updates', label: t('settings.incident_updates') },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-1">
                  <p className="text-sm text-white">{item.label}</p>
                  <Switch checked={notifications[item.key] ?? false} onCheckedChange={v => setNotifications(prev => ({ ...prev, [item.key]: v }))} className="h-4 w-8" />
                </div>
              ))}
              <SaveButton onClick={saveTenantSettings} saving={!!saving} label={t('settings.save_notifications')} />
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><BellRing className="h-4 w-4 text-blue-400" /> {t('settings.push_notifications')}</CardTitle>
              <CardDescription className="text-xs">{t('settings.push_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{t('settings.permission_status')}</p>
                  <p className="text-xs text-slate-400">{permission === 'granted' ? t('settings.granted') : permission === 'denied' ? t('settings.denied') : t('settings.not_requested')}</p>
                </div>
                <Badge className={cn("text-[9px] border", permission === 'granted' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30')}>{permission}</Badge>
              </div>
              <div className="flex gap-2">
                {isSubscribed ? (
                  <Button size="sm" variant="outline" onClick={unsubscribe}>{t('settings.unsubscribe')}</Button>
                ) : (
                  <Button size="sm" onClick={subscribe} className="gap-1"><BellRing className="h-3 w-3" /> {t('settings.enable_push')}</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4 text-slate-400" /> {t('settings.notification_history')}</CardTitle>
                  <CardDescription className="text-xs">{t('settings.notification_history_desc')}</CardDescription>
                </div>
                {notifHistory.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearNotificationHistory} className="gap-1 text-xs text-slate-400"><Trash2 className="h-3 w-3" /> {t('settings.clear_history')}</Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {notifHistory.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">{t('settings.no_notifications')}</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {notifHistory.map(n => (
                    <div key={n.id} className="flex items-start gap-3 p-2 rounded-md bg-slate-900/40">
                      <Badge className={cn("text-[9px] mt-0.5 shrink-0 border", n.severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/30' : n.severity === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30')}>
                        {n.severity}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{n.title}</p>
                        <p className="text-[10px] text-slate-500">{n.body}</p>
                      </div>
                      <p className="text-[10px] text-slate-500 shrink-0">{new Date(n.timestamp).toLocaleTimeString('es-CO')}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ AI Settings Tab ═══ */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4 text-purple-400" /> Configuración de IA</CardTitle>
              <CardDescription className="text-xs">Las API keys se almacenan de forma segura en el servidor — nunca se exponen en el frontend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Proveedor por defecto</Label>
                <Select value={defaultAiProvider} onValueChange={setDefaultAiProvider}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lovable">Lovable AI (Gemini)</SelectItem>
                    <SelectItem value="openai">OpenAI (GPT-4o)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Proveedor de respaldo</Label>
                <Select value={fallbackProvider} onValueChange={setFallbackProvider}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                    <SelectItem value="none">Ninguno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <SaveButton onClick={saveTenantSettings} saving={!!saving} label="Guardar Configuración IA" />
              <div className="p-3 rounded-md bg-slate-900/50 border border-slate-700/50 text-xs text-slate-400">
                <p className="font-medium mb-1 flex items-center gap-1"><Lock className="h-3 w-3" /> Nota de Seguridad</p>
                <p>Las API keys de OpenAI y Anthropic se gestionan como secretos del servidor y solo se acceden desde las funciones backend.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Feature Flags Tab ═══ */}
        <TabsContent value="flags" className="space-y-4 mt-4">
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2"><Flag className="h-4 w-4 text-amber-400" /> Feature Flags</CardTitle>
              <CardDescription className="text-xs">Toggles globales de funcionalidades. Los super admins pueden crear overrides por tenant.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingFlags ? <Skeleton className="h-24 w-full" /> : featureFlags.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">Sin feature flags configurados</p>
              ) : featureFlags.map((flag: any) => (
                <div key={flag.id} className="flex items-center justify-between p-2.5 rounded-md bg-slate-900/40 hover:bg-slate-900/60 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{flag.name}</p>
                      <Badge variant="outline" className="text-[9px] font-mono border-slate-600">{flag.key}</Badge>
                    </div>
                    {flag.description && <p className="text-[10px] text-slate-500">{flag.description}</p>}
                  </div>
                  <Badge className={cn("text-[9px] border", flag.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30')}>
                    {flag.enabled ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Advanced Tab ═══ */}
        <TabsContent value="advanced" className="space-y-4 mt-4">
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4 text-cyan-400" /> Datos y Retención</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Retención de Eventos</Label>
                <Select value={eventRetention} onValueChange={setEventRetention}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="30">30 días</SelectItem><SelectItem value="90">90 días</SelectItem><SelectItem value="365">1 año</SelectItem><SelectItem value="unlimited">Sin límite</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Retención de Logs de Auditoría</Label>
                <Select value={auditRetention} onValueChange={setAuditRetention}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="90">90 días</SelectItem><SelectItem value="365">1 año</SelectItem><SelectItem value="unlimited">Sin límite</SelectItem></SelectContent>
                </Select>
              </div>
              <SaveButton onClick={saveTenantSettings} saving={!!saving} label="Guardar Retención" />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    </PageShell>
  );
}

// ══════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════

function SettingRow({ label, desc, control }: { label: string; desc: string; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div><p className="text-sm font-medium text-white">{label}</p><p className="text-[10px] text-slate-500">{desc}</p></div>
      {control}
    </div>
  );
}

function SaveButton({ onClick, saving, label, variant }: { onClick: () => void; saving: boolean; label?: string; variant?: 'default' | 'secondary' }) {
  return (
    <Button size="sm" variant={variant} onClick={onClick} disabled={saving} className="gap-1">
      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
      {label || 'Guardar'}
    </Button>
  );
}
