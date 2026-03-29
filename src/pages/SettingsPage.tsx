import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Settings, User, Shield, Bell, Palette, Globe, Key, Database, Save, Loader2, Flag, BellRing, History, Trash2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { getNotificationHistory, clearNotificationHistory, subscribeNotificationHistory, type NotificationEntry } from '@/lib/notification-history';

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const { permission, isSubscribed, subscribe, unsubscribe } = usePushNotifications();
  const { t, lang, setLang } = useI18n();
  const { setTheme } = useTheme();

  // Notification history
  const notifHistory = useSyncExternalStore(
    subscribeNotificationHistory,
    getNotificationHistory,
  );

  // Tenant data
  const { data: tenant, isLoading: loadingTenant, isError, error, refetch } = useQuery({
    queryKey: ['tenant'],
    queryFn: async () => {
      const response = await apiClient.get<any>('/tenants/current');
      return response;
    },
    enabled: !!profile,
  });

  // Feature flags
  const { data: featureFlags = [], isLoading: loadingFlags } = useQuery({
    queryKey: ['feature_flags'],
    queryFn: async () => {
      const response = await apiClient.get<any>('/database-records', { category: 'feature_flag' });
      return Array.isArray(response) ? response : [];
    },
  });

  // Local state for editable fields
  const [tenantName, setTenantName] = useState('');
  const [tenantTimezone, setTenantTimezone] = useState('UTC');
  const [fullName, setFullName] = useState('');

  // Settings stored in tenant.settings JSONB
  const tenantSettings = (tenant?.settings || {}) as Record<string, any>;
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
    critical_events: true, high_severity: true, device_offline: true,
    health_changes: false, incident_updates: false,
  });

  // Initialize from tenant when loaded
  React.useEffect(() => {
    if (tenant) {
      setTenantName(tenant.name);
      setTenantTimezone(tenant.timezone);
      const s = tenant.settings as Record<string, any> || {};
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

  React.useEffect(() => {
    if (profile) setFullName(profile.full_name);
  }, [profile]);

  const saveTenantSettings = async () => {
    if (!tenant) return;
    setSaving('tenant');
    try {
      const settings = {
        dark_mode: darkMode, compact_mode: compactMode, two_factor: twoFactor,
        session_timeout: sessionTimeout, strong_passwords: strongPasswords,
        ai_provider: defaultAiProvider, ai_fallback: fallbackProvider,
        event_retention: eventRetention, audit_retention: auditRetention,
        notifications,
      };
      await apiClient.patch(`/tenants/${tenant.id}`, {
        name: tenantName, timezone: tenantTimezone, settings,
      });
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving('profile');
    try {
      await apiClient.patch(`/users/${profile.id}`, { fullName });
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="general">{t('settings.general')}</TabsTrigger>
          <TabsTrigger value="security">{t('settings.security')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('settings.notifications')}</TabsTrigger>
          <TabsTrigger value="ai">{t('settings.ai_settings')}</TabsTrigger>
          <TabsTrigger value="flags">{t('settings.feature_flags')}</TabsTrigger>
          <TabsTrigger value="advanced">{t('settings.advanced')}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> {t('settings.tenant')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingTenant ? <Skeleton className="h-20 w-full" /> : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('settings.org_name')}</Label>
                      <Input value={tenantName} onChange={e => setTenantName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('settings.timezone')}</Label>
                      <Select value={tenantTimezone} onValueChange={setTenantTimezone}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="America/Bogota">America/Bogotá (UTC-5)</SelectItem>
                          <SelectItem value="America/New_York">America/New_York (UTC-5)</SelectItem>
                          <SelectItem value="Europe/Madrid">Europe/Madrid (UTC+1)</SelectItem>
                          <SelectItem value="Asia/Tokyo">Asia/Tokyo (UTC+9)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button size="sm" onClick={saveTenantSettings} disabled={saving === 'tenant'}>
                    {saving === 'tenant' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} {t('settings.save_changes')}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> {t('settings.profile')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('settings.full_name')}</Label>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.email')}</Label>
                  <Input defaultValue={user?.email} disabled />
                </div>
              </div>
              <Button size="sm" onClick={saveProfile} disabled={saving === 'profile'}>
                {saving === 'profile' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} {t('settings.save_profile')}
              </Button>
            </CardContent>
          </Card>

          {/* Language */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> {t('settings.language')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t('settings.language_desc')}</p>
              <Select value={lang} onValueChange={(v) => setLang(v as 'es' | 'en')}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">🇪🇸 Español</SelectItem>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> {t('settings.appearance')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">{t('settings.dark_mode')}</p><p className="text-xs text-muted-foreground">{t('settings.dark_mode_desc')}</p></div>
                <Switch checked={darkMode} onCheckedChange={(v) => { setDarkMode(v); setTheme(v ? 'dark' : 'light'); }} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">{t('settings.compact_mode')}</p><p className="text-xs text-muted-foreground">{t('settings.compact_mode_desc')}</p></div>
                <Switch checked={compactMode} onCheckedChange={setCompactMode} />
              </div>
              <Button size="sm" variant="secondary" onClick={saveTenantSettings} disabled={!!saving}>{t('settings.save_appearance')}</Button>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> {t('settings.security')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">{t('settings.two_factor')}</p><p className="text-xs text-muted-foreground">{t('settings.two_factor_desc')}</p></div>
                <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">{t('settings.session_timeout')}</p><p className="text-xs text-muted-foreground">{t('settings.session_timeout_desc')}</p></div>
                <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="15">15 min</SelectItem><SelectItem value="30">30 min</SelectItem><SelectItem value="60">60 min</SelectItem><SelectItem value="never">Never</SelectItem></SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">{t('settings.strong_passwords')}</p><p className="text-xs text-muted-foreground">{t('settings.strong_passwords_desc')}</p></div>
                <Switch checked={strongPasswords} onCheckedChange={setStrongPasswords} />
              </div>
              <Button size="sm" onClick={saveTenantSettings} disabled={!!saving}>
                {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} {t('settings.save_security')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> {t('settings.notification_prefs')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'critical_events', label: t('settings.critical_events') },
                { key: 'high_severity', label: t('settings.high_severity') },
                { key: 'device_offline', label: t('settings.device_offline') },
                { key: 'health_changes', label: t('settings.health_changes') },
                { key: 'incident_updates', label: t('settings.incident_updates') },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <p className="text-sm">{item.label}</p>
                  <Switch checked={notifications[item.key] ?? false} onCheckedChange={v => setNotifications(prev => ({ ...prev, [item.key]: v }))} />
                </div>
              ))}
              <Button size="sm" onClick={saveTenantSettings} disabled={!!saving}>
                {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} {t('settings.save_notifications')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><BellRing className="h-4 w-4" /> {t('settings.push_notifications')}</CardTitle>
              <CardDescription>{t('settings.push_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t('settings.permission_status')}</p>
                  <p className="text-xs text-muted-foreground">
                    {permission === 'granted' ? t('settings.granted') : permission === 'denied' ? t('settings.denied') : t('settings.not_requested')}
                  </p>
                </div>
                <Badge variant={permission === 'granted' ? 'default' : 'secondary'} className="text-xs">{permission}</Badge>
              </div>
              <div className="flex gap-2">
                {isSubscribed ? (
                  <Button size="sm" variant="outline" onClick={unsubscribe}>{t('settings.unsubscribe')}</Button>
                ) : (
                  <Button size="sm" onClick={subscribe}>
                    <BellRing className="mr-1 h-3 w-3" /> {t('settings.enable_push')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notification History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> {t('settings.notification_history')}</CardTitle>
                  <CardDescription>{t('settings.notification_history_desc')}</CardDescription>
                </div>
                {notifHistory.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearNotificationHistory}>
                    <Trash2 className="mr-1 h-3 w-3" /> {t('settings.clear_history')}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {notifHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('settings.no_notifications')}</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {notifHistory.map(n => (
                    <div key={n.id} className="flex items-start gap-3 p-2 rounded-md bg-muted/30">
                      <Badge variant={n.severity === 'critical' ? 'destructive' : n.severity === 'high' ? 'outline' : 'secondary'} className="text-[10px] mt-0.5 shrink-0">
                        {n.severity}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.body}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground shrink-0">{new Date(n.timestamp).toLocaleTimeString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> AI Provider Configuration</CardTitle>
              <CardDescription>API keys are stored securely as Cloud Secrets — never exposed in frontend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default Provider</Label>
                <Select value={defaultAiProvider} onValueChange={setDefaultAiProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lovable">Lovable AI (Default)</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fallback Provider</Label>
                <Select value={fallbackProvider} onValueChange={setFallbackProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={saveTenantSettings} disabled={!!saving}>
                {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} Save AI Settings
              </Button>
              <div className="p-3 rounded-md bg-muted text-xs text-muted-foreground">
                <p className="font-medium mb-1">🔒 Security Note</p>
                <p>API keys for OpenAI and Anthropic are managed via Cloud Secrets and accessed only from backend functions.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Flag className="h-4 w-4" /> Feature Flags</CardTitle>
              <CardDescription>Global feature toggles. Tenant overrides can be managed by super admins.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingFlags ? <Skeleton className="h-24 w-full" /> : featureFlags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No feature flags configured</p>
              ) : featureFlags.map((flag: any) => (
                <div key={flag.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{flag.name}</p>
                      <Badge variant="outline" className="text-[9px] font-mono">{flag.key}</Badge>
                    </div>
                    {flag.description && <p className="text-xs text-muted-foreground">{flag.description}</p>}
                  </div>
                  <Badge variant={flag.enabled ? 'default' : 'secondary'} className="text-[10px]">
                    {flag.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Data & Retention</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Event Retention</Label>
                <Select value={eventRetention} onValueChange={setEventRetention}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="30">30 days</SelectItem><SelectItem value="90">90 days</SelectItem><SelectItem value="365">1 year</SelectItem><SelectItem value="unlimited">Unlimited</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Audit Log Retention</Label>
                <Select value={auditRetention} onValueChange={setAuditRetention}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="90">90 days</SelectItem><SelectItem value="365">1 year</SelectItem><SelectItem value="unlimited">Unlimited</SelectItem></SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={saveTenantSettings} disabled={!!saving}>
                {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />} Save Retention Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
