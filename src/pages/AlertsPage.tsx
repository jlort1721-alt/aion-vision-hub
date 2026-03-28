import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertRulesApi, alertInstancesApi, escalationPoliciesApi, notificationChannelsApi } from "@/services/alerts-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Clock, ArrowUpCircle, Mail, MessageSquare, Globe, Settings, Loader2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import EscalationConfigPanel from "@/components/alerts/EscalationConfigPanel";
import { PageShell } from "@/components/shared/PageShell";
import ErrorState from "@/components/ui/ErrorState";

const severityColors: Record<string, string> = {
  critical: "bg-destructive",
  high: "bg-warning",
  medium: "bg-warning",
  low: "bg-primary",
  info: "bg-gray-500",
};

const statusIcons: Record<string, typeof Bell> = {
  firing: BellRing,
  acknowledged: Clock,
  resolved: CheckCircle,
};

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState("instances");
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
      toast({ title: "Alert acknowledged" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => alertInstancesApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert-stats"] });
      toast({ title: "Alert resolved" });
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
      toast({ title: "Rule updated" });
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
      toast({ title: "Rule created" });
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
      toast({ title: "Channel created" });
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
      toast({ title: "Channel updated" });
    },
  });

  const stats = statsData?.data;
  const instances = instancesData?.data ?? [];
  const rules = rulesData?.data ?? [];
  const policies = policiesData?.data ?? [];
  const channels = channelsData?.data ?? [];

  if (instancesError) return <ErrorState error={instancesErrorObj as Error} onRetry={refetchInstances} />;

  return (
    <PageShell
      title="Alert Center"
      description="Manage alert rules, monitor active alerts, and configure notifications"
      icon={<Bell className="h-5 w-5" />}
    >
      <div className="space-y-6 p-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card aria-label="Active alerts count">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-3xl font-bold">{stats?.byStatus?.firing ?? 0}</p>
              </div>
              <BellRing className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card aria-label="Critical alerts count">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-3xl font-bold text-destructive">{stats?.activeCritical ?? 0}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card aria-label="Acknowledged alerts count">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Acknowledged</p>
                <p className="text-3xl font-bold text-warning">{stats?.byStatus?.acknowledged ?? 0}</p>
              </div>
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card aria-label="Resolved today count">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved Today</p>
                <p className="text-3xl font-bold text-success">{stats?.byStatus?.resolved ?? 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="instances" className="gap-1">
            <BellRing className="h-4 w-4" /> Active Alerts
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1">
            <Shield className="h-4 w-4" /> Rules
          </TabsTrigger>
          <TabsTrigger value="escalation" className="gap-1">
            <ArrowUpCircle className="h-4 w-4" /> Escalation Policies
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-1">
            <Settings className="h-4 w-4" /> Channels
          </TabsTrigger>
        </TabsList>

        {/* ── Active Alerts ────────────────────────────────── */}
        <TabsContent value="instances" className="space-y-4">
          {loadingInstances ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : instances.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                <p className="text-lg font-medium">No active alerts</p>
                <p className="text-sm text-muted-foreground mt-1">All systems operational</p>
              </CardContent>
            </Card>
          ) : (
            instances.map((alert: any) => {
              const StatusIcon = statusIcons[alert.status] ?? Bell;
              return (
                <Card key={alert.id} className={alert.status === 'firing' ? 'border-destructive/50' : ''} aria-label={`Alert: ${alert.title}, severity ${alert.severity}, status ${alert.status}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <StatusIcon className={`h-5 w-5 mt-0.5 ${alert.status === 'firing' ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{alert.title}</h3>
                            <Badge className={severityColors[alert.severity]}>{alert.severity}</Badge>
                            <Badge variant={alert.status === 'firing' ? 'destructive' : 'secondary'}>{alert.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(alert.createdAt).toLocaleString()}
                            {alert.acknowledgedAt && ` | Acknowledged: ${new Date(alert.acknowledgedAt).toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {alert.status === 'firing' && (
                          <Button size="sm" variant="outline" onClick={() => acknowledgeMutation.mutate(alert.id)} aria-label={`Acknowledge alert: ${alert.title}`}>
                            Acknowledge
                          </Button>
                        )}
                        {alert.status !== 'resolved' && (
                          <Button size="sm" variant="default" onClick={() => resolveMutation.mutate(alert.id)} aria-label={`Resolve alert: ${alert.title}`}>
                            Resolve
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
              <Plus className="h-4 w-4" /> New Rule
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
                <p className="text-lg font-medium">No alert rules configured</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first rule to start receiving alerts</p>
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
                          <Badge className={severityColors[rule.severity]}>{rule.severity}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{rule.description || 'No description'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Triggered {rule.triggerCount ?? 0} times
                          {rule.lastTriggeredAt && ` | Last: ${new Date(rule.lastTriggeredAt).toLocaleString()}`}
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
              <Plus className="h-4 w-4" /> New Channel
            </Button>
          </div>
          {channels.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No notification channels</p>
                <p className="text-sm text-muted-foreground mt-1">Add email, WhatsApp, or webhook channels</p>
              </CardContent>
            </Card>
          ) : (
            channels.map((channel: any) => {
              const iconMap: Record<string, typeof Mail> = { email: Mail, whatsapp: MessageSquare, webhook: Globe, push: Bell };
              const ChannelIcon = iconMap[channel.type] ?? Bell;
              return (
                <Card key={channel.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChannelIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{channel.name}</h3>
                            <Badge variant="outline">{channel.type}</Badge>
                          </div>
                          {channel.lastUsedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last used: {new Date(channel.lastUsedAt).toLocaleString()}
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
          <DialogHeader><DialogTitle>New Alert Rule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={ruleForm.name} onChange={(e) => setRuleForm(f => ({ ...f, name: e.target.value }))} placeholder="Rule name" />
            </div>
            <div className="space-y-2">
              <Label>Condition Description</Label>
              <Textarea value={ruleForm.condition} onChange={(e) => setRuleForm(f => ({ ...f, condition: e.target.value }))} placeholder="Describe the alert condition" />
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={ruleForm.severity} onValueChange={(v) => setRuleForm(f => ({ ...f, severity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={ruleForm.isActive} onCheckedChange={(v) => setRuleForm(f => ({ ...f, isActive: v }))} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createRuleMutation.mutate(ruleForm)} disabled={!ruleForm.name || createRuleMutation.isPending}>
              {createRuleMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Channel Dialog */}
      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Notification Channel</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={channelForm.name} onChange={(e) => setChannelForm(f => ({ ...f, name: e.target.value }))} placeholder="Channel name" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={channelForm.type} onValueChange={(v) => setChannelForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Config (JSON)</Label>
              <Textarea value={channelForm.config} onChange={(e) => setChannelForm(f => ({ ...f, config: e.target.value }))} placeholder='{"email": "admin@example.com"}' rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChannelDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createChannelMutation.mutate(channelForm)} disabled={!channelForm.name || createChannelMutation.isPending}>
              {createChannelMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Create Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
