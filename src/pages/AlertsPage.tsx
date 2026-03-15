import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { alertRulesApi, alertInstancesApi, escalationPoliciesApi, notificationChannelsApi } from "@/services/alerts-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Bell, BellRing, CheckCircle, AlertTriangle, AlertCircle, Shield, Plus,
  Clock, ArrowUpCircle, Mail, MessageSquare, Globe, Settings
} from "lucide-react";

const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
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
  const { data: instancesData, isLoading: loadingInstances } = useQuery({
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

  const stats = statsData?.data;
  const instances = instancesData?.data ?? [];
  const rules = rulesData?.data ?? [];
  const policies = policiesData?.data ?? [];
  const channels = channelsData?.data ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Alert Center
          </h1>
          <p className="text-muted-foreground">
            Manage alert rules, monitor active alerts, and configure notifications
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Alerts</p>
                <p className="text-3xl font-bold">{stats?.byStatus?.firing ?? 0}</p>
              </div>
              <BellRing className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-3xl font-bold text-red-500">{stats?.activeCritical ?? 0}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Acknowledged</p>
                <p className="text-3xl font-bold text-yellow-500">{stats?.byStatus?.acknowledged ?? 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved Today</p>
                <p className="text-3xl font-bold text-green-500">{stats?.byStatus?.resolved ?? 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
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
            <ArrowUpCircle className="h-4 w-4" /> Escalation
          </TabsTrigger>
          <TabsTrigger value="channels" className="gap-1">
            <Settings className="h-4 w-4" /> Channels
          </TabsTrigger>
        </TabsList>

        {/* ── Active Alerts ────────────────────────────────── */}
        <TabsContent value="instances" className="space-y-4">
          {loadingInstances ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : instances.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium">No active alerts</p>
                <p className="text-sm text-muted-foreground mt-1">All systems operational</p>
              </CardContent>
            </Card>
          ) : (
            instances.map((alert: any) => {
              const StatusIcon = statusIcons[alert.status] ?? Bell;
              return (
                <Card key={alert.id} className={alert.status === 'firing' ? 'border-red-500/50' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <StatusIcon className={`h-5 w-5 mt-0.5 ${alert.status === 'firing' ? 'text-red-500 animate-pulse' : 'text-muted-foreground'}`} />
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
                          <Button size="sm" variant="outline" onClick={() => acknowledgeMutation.mutate(alert.id)}>
                            Acknowledge
                          </Button>
                        )}
                        {alert.status !== 'resolved' && (
                          <Button size="sm" variant="default" onClick={() => resolveMutation.mutate(alert.id)}>
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
            <Button className="gap-1">
              <Plus className="h-4 w-4" /> New Rule
            </Button>
          </div>
          {loadingRules ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
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
                      <AlertTriangle className={`h-5 w-5 ${rule.isActive ? 'text-yellow-500' : 'text-muted-foreground'}`} />
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
          <div className="flex justify-end">
            <Button className="gap-1">
              <Plus className="h-4 w-4" /> New Policy
            </Button>
          </div>
          {policies.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ArrowUpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No escalation policies</p>
                <p className="text-sm text-muted-foreground mt-1">Define how unacknowledged alerts should escalate</p>
              </CardContent>
            </Card>
          ) : (
            policies.map((policy: any) => (
              <Card key={policy.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{policy.name}</CardTitle>
                  <CardDescription>{policy.description || 'No description'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    {(policy.levels as any[])?.map((level: any, i: number) => (
                      <div key={i} className="flex items-center gap-1">
                        {i > 0 && <span className="text-muted-foreground mx-1">→</span>}
                        <Badge variant="outline">
                          L{level.level}: {level.notifyRoles?.join(', ') || 'Users'} ({level.timeoutMinutes}m)
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Notification Channels ────────────────────────── */}
        <TabsContent value="channels" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1">
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
                      <Switch checked={channel.isActive} />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
