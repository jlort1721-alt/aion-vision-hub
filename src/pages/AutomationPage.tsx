import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ErrorState from "@/components/ui/ErrorState";
import { automationRulesApi, automationExecutionsApi, automationStatsApi } from "@/services/automation-api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Cog, PlayCircle, CheckCircle, XCircle, Plus, Loader2 } from "lucide-react";

const executionStatusColors: Record<string, string> = {
  success: "bg-success",
  partial: "bg-warning",
  failed: "bg-destructive",
};

const defaultNewRule = { name: '', description: '', triggerType: 'event', conditions: '[]', actions: '[]', priority: 5, cooldownMinutes: 10, isActive: true };

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState("rules");
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [newRule, setNewRule] = useState(defaultNewRule);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createRuleMutation = useMutation({
    mutationFn: (data: typeof defaultNewRule) => {
      let conditions, actions;
      try { conditions = JSON.parse(data.conditions); } catch { conditions = []; }
      try { actions = JSON.parse(data.actions); } catch { actions = []; }
      return automationRulesApi.create({ ...data, conditions, actions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation'] });
      toast({ title: 'Automation rule created' });
      setShowCreateRule(false);
      setNewRule(defaultNewRule);
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // ── Automation Rules ─────────────────────────────────────
  const { data: rulesData, isLoading: loadingRules, isError, error, refetch } = useQuery({
    queryKey: ["automation", "rules"],
    queryFn: () => automationRulesApi.list(),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      automationRulesApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation"] });
      toast({ title: "Rule updated" });
    },
  });

  // ── Executions ───────────────────────────────────────────
  const { data: executionsData, isLoading: loadingExecutions } = useQuery({
    queryKey: ["automation", "executions"],
    queryFn: () => automationExecutionsApi.list({ perPage: 50 }),
  });

  // ── Stats ────────────────────────────────────────────────
  const { data: statsData } = useQuery({
    queryKey: ["automation", "stats"],
    queryFn: () => automationStatsApi.get(),
    refetchInterval: 30000,
  });

  const rules = rulesData?.data ?? [];
  const executions = executionsData?.data ?? [];
  const stats = statsData?.data;

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cog className="h-6 w-6" />
            Automation
          </h1>
          <p className="text-muted-foreground">
            Manage automation rules and monitor execution history
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Rules</p>
                <p className="text-3xl font-bold">{stats?.totalRules ?? 0}</p>
              </div>
              <Cog className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Rules</p>
                <p className="text-3xl font-bold text-success">{stats?.activeRules ?? 0}</p>
              </div>
              <PlayCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Executions (24h)</p>
                <p className="text-3xl font-bold">{stats?.executions24h ?? 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-3xl font-bold text-success">
                  {stats?.successRate != null ? `${Math.round(stats.successRate)}%` : '--'}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rules" className="gap-1">
            <Cog className="h-4 w-4" /> Rules
          </TabsTrigger>
          <TabsTrigger value="executions" className="gap-1">
            <PlayCircle className="h-4 w-4" /> Execution History
          </TabsTrigger>
        </TabsList>

        {/* ── Rules Tab ───────────────────────────────────── */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1" onClick={() => setShowCreateRule(true)}>
              <Plus className="h-4 w-4" /> New Rule
            </Button>
          </div>

          <Dialog open={showCreateRule} onOpenChange={setShowCreateRule}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Create Automation Rule</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1"><Label className="text-xs">Rule Name *</Label><Input value={newRule.name} onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))} placeholder="e.g. Alert on camera offline" /></div>
                <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={newRule.description} onChange={e => setNewRule(r => ({ ...r, description: e.target.value }))} placeholder="What this rule does" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Trigger Type</Label>
                    <Select value={newRule.triggerType} onValueChange={v => setNewRule(r => ({ ...r, triggerType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="event">Event</SelectItem>
                        <SelectItem value="schedule">Schedule</SelectItem>
                        <SelectItem value="device_status">Device Status</SelectItem>
                        <SelectItem value="threshold">Threshold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Priority (1-10)</Label><Input type="number" min={1} max={10} value={newRule.priority} onChange={e => setNewRule(r => ({ ...r, priority: parseInt(e.target.value) || 5 }))} /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Conditions (JSON)</Label><Textarea className="font-mono text-xs h-20" value={newRule.conditions} onChange={e => setNewRule(r => ({ ...r, conditions: e.target.value }))} placeholder='[{"field":"severity","operator":"eq","value":"critical"}]' /></div>
                <div className="space-y-1"><Label className="text-xs">Actions (JSON)</Label><Textarea className="font-mono text-xs h-20" value={newRule.actions} onChange={e => setNewRule(r => ({ ...r, actions: e.target.value }))} placeholder='[{"type":"send_alert","params":{"channels":["email"]}}]' /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">Cooldown (min)</Label><Input type="number" min={0} value={newRule.cooldownMinutes} onChange={e => setNewRule(r => ({ ...r, cooldownMinutes: parseInt(e.target.value) || 0 }))} /></div>
                  <div className="flex items-center gap-2 pt-5"><Switch checked={newRule.isActive} onCheckedChange={v => setNewRule(r => ({ ...r, isActive: v }))} /><Label className="text-xs">Active</Label></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowCreateRule(false)}>Cancel</Button>
                <Button onClick={() => createRuleMutation.mutate(newRule)} disabled={!newRule.name || createRuleMutation.isPending}>
                  {createRuleMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Rule'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {loadingRules ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Cog className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No automation rules configured</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first rule to automate workflows</p>
              </CardContent>
            </Card>
          ) : (
            rules.map((rule: any) => (
              <Card key={rule.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Cog className={`h-5 w-5 ${rule.isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{rule.name}</h3>
                          <Badge variant="outline">{rule.triggerType}</Badge>
                          <Badge variant="secondary">{rule.actionCount ?? 0} actions</Badge>
                          {rule.priority && (
                            <Badge variant="outline">Priority: {rule.priority}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
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

        {/* ── Execution History Tab ───────────────────────── */}
        <TabsContent value="executions" className="space-y-4">
          {loadingExecutions ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : executions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <PlayCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No executions yet</p>
                <p className="text-sm text-muted-foreground mt-1">Executions will appear here when automation rules are triggered</p>
              </CardContent>
            </Card>
          ) : (
            executions.map((exec: any) => {
              const StatusIcon = exec.status === 'success' ? CheckCircle : exec.status === 'failed' ? XCircle : PlayCircle;
              const statusColor = exec.status === 'success' ? 'text-success' : exec.status === 'failed' ? 'text-destructive' : 'text-warning';
              return (
                <Card key={exec.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <StatusIcon className={`h-5 w-5 mt-0.5 ${statusColor}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{exec.ruleName || 'Unknown Rule'}</h3>
                            <Badge className={executionStatusColors[exec.status] || 'bg-gray-500'}>
                              {exec.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Duration: {exec.executionTime != null ? `${exec.executionTime}ms` : 'N/A'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {exec.createdAt ? new Date(exec.createdAt).toLocaleString() : 'N/A'}
                          </p>
                        </div>
                      </div>
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
