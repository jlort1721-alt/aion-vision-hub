import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertRulesApi, alertInstancesApi, escalationPoliciesApi, notificationChannelsApi } from "@/services/alerts-api";
import { Card, CardContent } from "@/components/ui/card"; // CardHeader/CardTitle available if needed
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Bell, BellRing, CheckCircle, AlertTriangle, AlertCircle, Shield, Plus,
  Clock, ArrowUpCircle, Mail, MessageSquare, Globe, Settings, Loader2, Filter
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import EscalationConfigPanel from "@/components/alerts/EscalationConfigPanel";
import { PageShell } from "@/components/shared/PageShell";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/shared/EmptyState";

const severityColors: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-warning",
  medium: "bg-warning",
  low: "bg-primary",
  info: "bg-gray-500",
};

const severityLabels: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  info: "Info",
};

const statusLabels: Record<string, string> = {
  firing: "Activa",
  acknowledged: "Reconocida",
  resolved: "Resuelta",
};

const statusIcons: Record<string, typeof Bell> = {
  firing: BellRing,
  acknowledged: Clock,
  resolved: CheckCircle,
};

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState("instances");
  const [severityFilter, setSeverityFilter] = useState("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Alert Instances ────────────────────────────────────────
  const { data: instancesData, isLoading: loadingInstances, isError: instancesError, error: instancesErrorObj, refetch: refetchInstances } = useQuery({
    queryKey: ["alerts", "instances"],
    queryFn: () => alertInstancesApi.list({ perPage: 50 }),
    refetchInterval: 15000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["alert-stats"],
    queryFn: () => alertInstancesApi.stats(),
    refetchInterval: 10000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => alertInstancesApi.acknowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert-stats"] });
      toast({ title: "Alerta reconocida" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => alertInstancesApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert-stats"] });
      toast({ title: "Alerta resuelta" });
    },
  });

  // ── Alert Rules ────────────────────────────────────────────
  const { data: rulesData, isLoading: loadingRules } = useQuery({
    queryKey: ["alerts", "rules"],
    queryFn: () => alertRulesApi.list(),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      alertRulesApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "rules"] });
      toast({ title: "Regla actualizada" });
    },
  });

  // ── Escalation Policies ────────────────────────────────────
  const { data: policiesData } = useQuery({
    queryKey: ["alerts", "policies"],
    queryFn: () => escalationPoliciesApi.list(),
  });

  // ── Notification Channels ──────────────────────────────────
  const { data: channelsData } = useQuery({
    queryKey: ["alerts", "channels"],
    queryFn: () => notificationChannelsApi.list(),
  });

  // ── Create Rule ───────────────────────────────────────────
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: "", condition: "", severity: "medium", isActive: true });
  const createRuleMutation = useMutation({
    mutationFn: (data: typeof ruleForm) =>
      alertRulesApi.create({ name: data.name, condition: data.condition, severity: data.severity, isActive: data.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "rules"] });
      toast({ title: "Regla creada" });
      setRuleDialogOpen(false);
      setRuleForm({ name: "", condition: "", severity: "medium", isActive: true });
    },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  // ── Create Channel ──────────────────────────────────────
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [channelForm, setChannelForm] = useState({ name: "", type: "email", config: "{}" });
  const createChannelMutation = useMutation({
    mutationFn: (data: typeof channelForm) => {
      let parsedConfig: unknown = {};
      try { parsedConfig = JSON.parse(data.config); } catch { /* keep empty */ }
      return notificationChannelsApi.create({ name: data.name, type: data.type, config: parsedConfig });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "channels"] });
      toast({ title: "Canal creado" });
      setChannelDialogOpen(false);
      setChannelForm({ name: "", type: "email", config: "{}" });
    },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  // ── Toggle Channel ──────────────────────────────────────
  const toggleChannelMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      notificationChannelsApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts", "channels"] });
      toast({ title: "Canal actualizado" });
    },
  });

  const stats = statsData?.data;
  const allInstances = instancesData?.data ?? [];
  const instances = severityFilter === 'all' ? allInstances : allInstances.filter((a: any) => a.severity === severityFilter);
  const rules = rulesData?.data ?? [];
  const policies = policiesData?.data ?? [];
  const channels = channelsData?.data ?? [];

  if (instancesError) return <ErrorState error={instancesErrorObj as Error} onRetry={refetchInstances} />;

  return (
    <PageShell
      title="Centro de Alertas"
      description="Reglas, alertas activas, escalamiento y canales de notificación"
      icon={<Bell className="h-5 w-5" />}
    >
      <div className="space-y-6 p-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:ring-1 hover:ring-destructive/50 transition-all" onClick={() => { setActiveTab('instances'); setSeverityFilter('all'); }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertas Activas</p>
                <p className="text-3xl font-bold">{stats?.byStatus?.firing ?? 0}</p>
              </div>
              <BellRing className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-1 hover:ring-destructive/50 transition-all" onClick={() => { setActiveTab('instances'); setSeverityFilter('critical'); }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Críticas</p>
                <p className="text-3xl font-bold text-destructive">{stats?.activeCritical ?? 0}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reconocidas</p>
                <p className="text-3xl font-bold text-warning">{stats?.byStatus?.acknowledged ?? 0}</p>
              </div>
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resueltas Hoy</p>
                <p className="text-3xl font-bold text-success">{stats?.byStatus?.resolved ?? 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs with counts */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="instances" className="gap-1">
            <BellRing className="h-4 w-4" /> Alertas Activas
            {allInstances.length > 0 && <Badge variant="destructive" className="ml-1 h-5 text-[10px]">{allInstances.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1">
            <Shield className="h-4 w-4" /> Reglas
            {rules.length > 0 && <Badge variant="outline" className="ml-1 h-5 text-[10px]">{rules.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="escalation" className="gap-1">
            <ArrowUpCircle className="h-4 w-4" /> Escalamiento
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-1">
            <Settings className="h-4 w-4" /> Canales
            {channels.length > 0 && <Badge variant="outline" className="ml-1 h-5 text-[10px]">{channels.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── Active Alerts ────────────────────────────────── */}
        <TabsContent value="instances" className="space-y-4">
          {/* Severity quick filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {['all', 'critical', 'high', 'medium', 'low'].map(sev => (
              <Button
                key={sev}
                variant={severityFilter === sev ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSeverityFilter(sev)}
              >
                {sev === 'all' ? 'Todas' : severityLabels[sev] || sev}
                {sev !== 'all' && (
                  <Badge variant="secondary" className="ml-1 h-4 text-[9px]">
                    {allInstances.filter((a: any) => a.severity === sev).length}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {loadingInstances ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : instances.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No hay alertas registradas"
              description="Todos los sistemas funcionan correctamente. Las alertas apareceran aqui cuando se detecten."
            />
          ) : (
            instances.map((alert: any) => {
              const StatusIcon = statusIcons[alert.status] ?? Bell;
              return (
                <Card key={alert.id} className={alert.status === 'firing' ? 'border-destructive/50' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <StatusIcon className={`h-5 w-5 mt-0.5 ${alert.status === 'firing' ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{alert.title}</h3>
                            <Badge className={severityColors[alert.severity]}>{severityLabels[alert.severity] || alert.severity}</Badge>
                            <Badge variant={alert.status === 'firing' ? 'destructive' : 'secondary'}>{statusLabels[alert.status] || alert.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(alert.createdAt).toLocaleString('es-CO')}
                            {alert.acknowledgedAt && ` · Reconocida: ${new Date(alert.acknowledgedAt).toLocaleString('es-CO')}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {alert.status === 'firing' && (
                          <Button size="sm" variant="outline" onClick={() => acknowledgeMutation.mutate(alert.id)} disabled={acknowledgeMutation.isPending}>
                            {acknowledgeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            Reconocer
                          </Button>
                        )}
                        {alert.status !== 'resolved' && (
                          <Button size="sm" variant="default" onClick={() => resolveMutation.mutate(alert.id)} disabled={resolveMutation.isPending}>
                            {resolveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                            Resolver
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ── Rules ────────────────────────────────────────── */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1" onClick={() => setRuleDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Nueva Regla
            </Button>
          </div>
          {loadingRules ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">Sin reglas de alerta</p>
                <p className="text-sm text-muted-foreground mt-1">Cree su primera regla para empezar a recibir alertas</p>
              </CardContent>
            </Card>
          ) : (
            rules.map((rule: any) => (
              <Card key={rule.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`h-5 w-5 ${rule.isActive ? 'text-warning' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{rule.name}</h3>
                          <Badge className={severityColors[rule.severity]}>{severityLabels[rule.severity] || rule.severity}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{rule.description || 'Sin descripción'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Disparada {rule.triggerCount ?? 0} veces
                          {rule.lastTriggeredAt && ` · Última: ${new Date(rule.lastTriggeredAt).toLocaleString('es-CO')}`}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, isActive: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Escalation Policies ──────────────────────────── */}
        <TabsContent value="escalation" className="space-y-4">
          <EscalationConfigPanel />
        </TabsContent>

        {/* ── Notification Channels ────────────────────────── */}
        <TabsContent value="channels" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1" onClick={() => setChannelDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Nuevo Canal
            </Button>
          </div>
          {channels.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">Sin canales de notificación</p>
                <p className="text-sm text-muted-foreground mt-1">Agregue canales de email, WhatsApp o webhook</p>
              </CardContent>
            </Card>
          ) : (
            channels.map((channel: any) => {
              const iconMap: Record<string, typeof Mail> = { email: Mail, whatsapp: MessageSquare, webhook: Globe, push: Bell };
              const ChannelIcon = iconMap[channel.type] ?? Bell;
              const typeLabels: Record<string, string> = { email: 'Email', whatsapp: 'WhatsApp', webhook: 'Webhook', push: 'Push' };
              return (
                <Card key={channel.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChannelIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{channel.name}</h3>
                            <Badge variant="outline">{typeLabels[channel.type] || channel.type}</Badge>
                          </div>
                          {channel.lastUsedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Último uso: {new Date(channel.lastUsedAt).toLocaleString('es-CO')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Switch checked={channel.isActive} onCheckedChange={(checked) => toggleChannelMutation.mutate({ id: channel.id, isActive: checked })} />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>

      {/* New Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Regla de Alerta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={ruleForm.name} onChange={(e) => setRuleForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre de la regla" />
            </div>
            <div className="space-y-2">
              <Label>Descripción de la Condición</Label>
              <Textarea value={ruleForm.condition} onChange={(e) => setRuleForm(f => ({ ...f, condition: e.target.value }))} placeholder="Describa cuándo se activa la alerta" />
            </div>
            <div className="space-y-2">
              <Label>Severidad</Label>
              <Select value={ruleForm.severity} onValueChange={(v) => setRuleForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Crítica</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="info">Informativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={ruleForm.isActive} onCheckedChange={(v) => setRuleForm(f => ({ ...f, isActive: v }))} />
              <Label>Activa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createRuleMutation.mutate(ruleForm)} disabled={!ruleForm.name || createRuleMutation.isPending}>
              {createRuleMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Crear Regla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Channel Dialog */}
      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Canal de Notificación</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={channelForm.name} onChange={(e) => setChannelForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del canal" />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={channelForm.type} onValueChange={(v) => setChannelForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Configuración (JSON)</Label>
              <Textarea value={channelForm.config} onChange={(e) => setChannelForm(f => ({ ...f, config: e.target.value }))} placeholder='{"email": "admin@claveseguridad.co"}' rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChannelDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => createChannelMutation.mutate(channelForm)} disabled={!channelForm.name || createChannelMutation.isPending}>
              {createChannelMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Crear Canal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
