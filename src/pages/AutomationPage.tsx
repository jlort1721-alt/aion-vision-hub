import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ErrorState from "@/components/ui/ErrorState";
import { automationRulesApi, automationExecutionsApi, automationStatsApi, automationSystemApi } from "@/services/automation-api";
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
import { Cog, PlayCircle, CheckCircle, XCircle, Plus, Loader2, Shield, Zap, Clock, History } from "lucide-react";

// ── Types ───────────────────────────────────────────────────

interface ActionEntry {
  type: string;
  deviceId: string;
  toggleState: string;
  sirenDuration: number;
  notifyChannel: string;
  messageTemplate: string;
  escalationPolicy: string;
}

const emptyAction: ActionEntry = {
  type: '',
  deviceId: '',
  toggleState: 'on',
  sirenDuration: 30,
  notifyChannel: 'push',
  messageTemplate: '',
  escalationPolicy: 'default',
};

// ── Constants ───────────────────────────────────────────────

const executionStatusColors: Record<string, string> = {
  success: "bg-success",
  partial: "bg-warning",
  failed: "bg-destructive",
};

const triggerTypeLabels: Record<string, string> = {
  event_severity: "Cuando se recibe un evento de severidad...",
  device_offline: "Cuando un dispositivo lleva X minutos offline",
  schedule: "A una hora programada",
  manual: "Ejecucion manual",
};

const actionTypeLabels: Record<string, string> = {
  ewelink_toggle: "Activar/Desactivar dispositivo eWeLink",
  ewelink_siren: "Activar sirena eWeLink",
  send_notification: "Enviar notificacion",
  create_incident: "Crear incidente",
  escalate: "Escalar a politica",
};

interface PresetTemplate {
  label: string;
  name: string;
  description: string;
  triggerType: string;
  severity: string;
  offlineMinutes: number;
  cronExpression: string;
  actions: ActionEntry[];
  priority: number;
  cooldownMinutes: number;
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    label: "Activar sirena en alarma critica",
    name: "Sirena en alarma critica",
    description: "Activa la sirena cuando se detecta un evento de severidad critica",
    triggerType: "event_severity",
    severity: "critical",
    offlineMinutes: 0,
    cronExpression: "",
    actions: [{ ...emptyAction, type: "ewelink_siren", sirenDuration: 60 }],
    priority: 1,
    cooldownMinutes: 5,
  },
  {
    label: "Notificar supervisor si evento sin atender > 15 min",
    name: "Notificar evento sin atender",
    description: "Envia notificacion al supervisor si un evento de alta severidad no es atendido en 15 minutos",
    triggerType: "event_severity",
    severity: "high",
    offlineMinutes: 0,
    cronExpression: "",
    actions: [{ ...emptyAction, type: "send_notification", notifyChannel: "push", messageTemplate: "Evento sin atender por mas de 15 minutos" }, { ...emptyAction, type: "escalate", escalationPolicy: "supervisor" }],
    priority: 2,
    cooldownMinutes: 15,
  },
  {
    label: "Auto-reiniciar dispositivo offline > 30 min",
    name: "Reiniciar dispositivo offline",
    description: "Reinicia automaticamente un dispositivo que lleva mas de 30 minutos offline",
    triggerType: "device_offline",
    severity: "",
    offlineMinutes: 30,
    cronExpression: "",
    actions: [{ ...emptyAction, type: "ewelink_toggle", toggleState: "off" }, { ...emptyAction, type: "ewelink_toggle", toggleState: "on" }],
    priority: 3,
    cooldownMinutes: 60,
  },
  {
    label: "Abrir puerta automatica con placa reconocida",
    name: "Apertura automatica por LPR",
    description: "Abre la puerta automaticamente cuando se reconoce una placa autorizada",
    triggerType: "event_severity",
    severity: "low",
    offlineMinutes: 0,
    cronExpression: "",
    actions: [{ ...emptyAction, type: "ewelink_toggle", toggleState: "on" }, { ...emptyAction, type: "create_incident" }],
    priority: 5,
    cooldownMinutes: 1,
  },
];

// ── Helpers ─────────────────────────────────────────────────

function buildConditionsJson(triggerType: string, severity: string, offlineMinutes: number, cronExpression: string): string {
  switch (triggerType) {
    case "event_severity":
      return JSON.stringify([{ field: "severity", operator: "eq", value: severity }]);
    case "device_offline":
      return JSON.stringify([{ field: "offlineMinutes", operator: "gte", value: offlineMinutes }]);
    case "schedule":
      return JSON.stringify([{ field: "cron", operator: "eq", value: cronExpression }]);
    case "manual":
      return JSON.stringify([]);
    default:
      return "[]";
  }
}

function buildActionsJson(actions: ActionEntry[]): string {
  return JSON.stringify(
    actions.filter(a => a.type).map(a => {
      switch (a.type) {
        case "ewelink_toggle":
          return { type: "ewelink_toggle", params: { deviceId: a.deviceId, state: a.toggleState } };
        case "ewelink_siren":
          return { type: "ewelink_siren", params: { deviceId: a.deviceId, duration: a.sirenDuration } };
        case "send_notification":
          return { type: "send_notification", params: { channel: a.notifyChannel, message: a.messageTemplate } };
        case "create_incident":
          return { type: "create_incident", params: {} };
        case "escalate":
          return { type: "escalate", params: { policy: a.escalationPolicy } };
        default:
          return { type: a.type, params: {} };
      }
    })
  );
}

// ── Component ───────────────────────────────────────────────

const defaultNewRule = { name: '', description: '', triggerType: 'event_severity', conditions: '[]', actions: '[]', priority: 5, cooldownMinutes: 10, isActive: true };

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState("rules");
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [newRule, setNewRule] = useState(defaultNewRule);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Enhanced form state ────────────────────────────────────
  const [severity, setSeverity] = useState("critical");
  const [offlineMinutes, setOfflineMinutes] = useState(30);
  const [cronExpression, setCronExpression] = useState("");
  const [ruleActions, setRuleActions] = useState<ActionEntry[]>([{ ...emptyAction }]);

  // ── System-wide toggle ─────────────────────────────────────
  const { data: systemStatus } = useQuery({
    queryKey: ['automation-system-status'],
    queryFn: () => automationSystemApi.getStatus(),
  });
  const systemEnabled = (systemStatus as Record<string, unknown> | undefined)?.enabled !== false;

  const toggleSystemMutation = useMutation({
    mutationFn: (enabled: boolean) => automationSystemApi.toggle(enabled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-system-status'] }),
  });
  const toggleSystem = (checked: boolean) => toggleSystemMutation.mutate(checked);

  // ── Create rule mutation ───────────────────────────────────
  const createRuleMutation = useMutation({
    mutationFn: (data: typeof defaultNewRule) => {
      let conditions, actions;
      try { conditions = JSON.parse(data.conditions); } catch { conditions = []; }
      try { actions = JSON.parse(data.actions); } catch { actions = []; }
      return automationRulesApi.create({ ...data, conditions, actions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation'] });
      toast({ title: 'Regla de automatizacion creada' });
      setShowCreateRule(false);
      resetForm();
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
      toast({ title: "Regla actualizada" });
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

  const rules: any[] = rulesData?.data ?? [];
  const executions: any[] = executionsData?.data ?? [];
  const stats = statsData?.data as any;

  const triggerTypeSpanish: Record<string, string> = {
    event_severity: 'Severidad', device_offline: 'Offline', schedule: 'Programado', manual: 'Manual',
  };
  const execStatusSpanish: Record<string, string> = {
    success: 'Exitoso', failed: 'Fallido', partial: 'Parcial', pending: 'Pendiente',
  };

  // ── Form helpers ─────────────────────────────────────────
  function resetForm() {
    setNewRule(defaultNewRule);
    setSeverity("critical");
    setOfflineMinutes(30);
    setCronExpression("");
    setRuleActions([{ ...emptyAction }]);
  }

  function handleCreateRule() {
    const conditionsJson = buildConditionsJson(newRule.triggerType, severity, offlineMinutes, cronExpression);
    const actionsJson = buildActionsJson(ruleActions);
    createRuleMutation.mutate({ ...newRule, conditions: conditionsJson, actions: actionsJson });
  }

  function applyPreset(preset: PresetTemplate) {
    setNewRule({
      ...defaultNewRule,
      name: preset.name,
      description: preset.description,
      triggerType: preset.triggerType,
      priority: preset.priority,
      cooldownMinutes: preset.cooldownMinutes,
      conditions: '[]',
      actions: '[]',
      isActive: true,
    });
    setSeverity(preset.severity || "critical");
    setOfflineMinutes(preset.offlineMinutes || 30);
    setCronExpression(preset.cronExpression || "");
    setRuleActions(preset.actions.length > 0 ? preset.actions : [{ ...emptyAction }]);
  }

  function updateAction(index: number, updates: Partial<ActionEntry>) {
    setRuleActions(prev => prev.map((a, i) => i === index ? { ...a, ...updates } : a));
  }

  function addAction() {
    setRuleActions(prev => [...prev, { ...emptyAction }]);
  }

  function removeAction(index: number) {
    setRuleActions(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cog className="h-6 w-6" />
            Automatizacion
          </h1>
          <p className="text-muted-foreground">
            Gestiona reglas de automatizacion y monitorea el historial de ejecucion
          </p>
        </div>
      </div>

      {/* TASK 1: System-wide automation toggle */}
      <Card className="mb-4 border-amber-500/20 bg-amber-500/5">
        <CardContent className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-amber-500" />
            <div>
              <p className="font-medium">Sistema de Automatizacion AION</p>
              <p className="text-xs text-muted-foreground">
                {systemEnabled ? 'Activo — monitoreando y ejecutando reglas automaticamente' : 'Desactivado — las reglas no se ejecutaran'}
              </p>
            </div>
          </div>
          <Switch checked={systemEnabled} onCheckedChange={toggleSystem} />
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reglas</p>
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
                <p className="text-sm text-muted-foreground">Reglas Activas</p>
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
                <p className="text-sm text-muted-foreground">Ejecuciones (24h)</p>
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
                <p className="text-sm text-muted-foreground">Tasa de Exito</p>
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
            <Cog className="h-4 w-4" /> Reglas
            {rules.length > 0 && <Badge variant="outline" className="ml-1 h-5 text-[10px]">{rules.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="executions" className="gap-1">
            <PlayCircle className="h-4 w-4" /> Ejecuciones
            {executions.length > 0 && <Badge variant="secondary" className="ml-1 h-5 text-[10px]">{executions.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <History className="h-4 w-4" /> Historial
          </TabsTrigger>
        </TabsList>

        {/* ── Rules Tab ───────────────────────────────────── */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1" onClick={() => { resetForm(); setShowCreateRule(true); }}>
              <Plus className="h-4 w-4" /> Nueva Regla
            </Button>
          </div>

          {/* TASK 2: Enhanced "New Rule" dialog */}
          <Dialog open={showCreateRule} onOpenChange={setShowCreateRule}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Crear Regla de Automatizacion</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">

                {/* Preset Templates */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plantillas Rapidas</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PRESET_TEMPLATES.map((preset) => (
                      <Button
                        key={preset.label}
                        variant="outline"
                        size="sm"
                        className="justify-start text-left h-auto py-2 px-3"
                        onClick={() => applyPreset(preset)}
                      >
                        <Zap className="h-3.5 w-3.5 mr-2 flex-shrink-0 text-amber-500" />
                        <span className="text-xs">{preset.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <hr className="border-border" />

                {/* Basic info */}
                <div className="space-y-1">
                  <Label className="text-xs">Nombre de la regla *</Label>
                  <Input value={newRule.name} onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))} placeholder="Ej: Alerta por camara offline" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descripcion</Label>
                  <Input value={newRule.description} onChange={e => setNewRule(r => ({ ...r, description: e.target.value }))} placeholder="Que hace esta regla" />
                </div>

                {/* Trigger type selector */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo de Disparador</Label>
                    <Select value={newRule.triggerType} onValueChange={v => setNewRule(r => ({ ...r, triggerType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="event_severity">Severidad de evento</SelectItem>
                        <SelectItem value="device_offline">Dispositivo offline</SelectItem>
                        <SelectItem value="schedule">Programado</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {triggerTypeLabels[newRule.triggerType] ?? ''}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Prioridad (1-10)</Label>
                    <Input type="number" min={1} max={10} value={newRule.priority} onChange={e => setNewRule(r => ({ ...r, priority: parseInt(e.target.value) || 5 }))} />
                  </div>
                </div>

                {/* Condition builder - based on trigger type */}
                <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Condiciones</Label>

                  {newRule.triggerType === 'event_severity' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Severidad del evento</Label>
                      <Select value={severity} onValueChange={setSeverity}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">Critica</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                          <SelectItem value="medium">Media</SelectItem>
                          <SelectItem value="low">Baja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {newRule.triggerType === 'device_offline' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Minutos offline (umbral)</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" min={1} value={offlineMinutes} onChange={e => setOfflineMinutes(parseInt(e.target.value) || 0)} className="w-32" />
                        <span className="text-xs text-muted-foreground">minutos</span>
                      </div>
                    </div>
                  )}

                  {newRule.triggerType === 'schedule' && (
                    <div className="space-y-1">
                      <Label className="text-xs">Expresion Cron / Hora</Label>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Input value={cronExpression} onChange={e => setCronExpression(e.target.value)} placeholder="0 8 * * * (cada dia a las 8am)" className="font-mono text-xs" />
                      </div>
                      <p className="text-xs text-muted-foreground">Formato cron: minuto hora dia mes dia-semana</p>
                    </div>
                  )}

                  {newRule.triggerType === 'manual' && (
                    <p className="text-xs text-muted-foreground">Esta regla se ejecutara solo de forma manual desde el panel de control.</p>
                  )}
                </div>

                {/* Action builder */}
                <div className="space-y-2 rounded-md border p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acciones</Label>
                    <Button variant="ghost" size="sm" onClick={addAction} className="h-7 text-xs gap-1">
                      <Plus className="h-3 w-3" /> Agregar accion
                    </Button>
                  </div>

                  {ruleActions.map((action, idx) => (
                    <div key={idx} className="space-y-2 rounded border p-2 bg-background">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">Accion {idx + 1}</Label>
                        {ruleActions.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeAction(idx)} className="h-6 text-xs text-destructive hover:text-destructive">
                            <XCircle className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      <Select value={action.type} onValueChange={v => updateAction(idx, { type: v })}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Seleccionar tipo de accion" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ewelink_toggle">Activar/Desactivar dispositivo eWeLink</SelectItem>
                          <SelectItem value="ewelink_siren">Activar sirena eWeLink</SelectItem>
                          <SelectItem value="send_notification">Enviar notificacion</SelectItem>
                          <SelectItem value="create_incident">Crear incidente</SelectItem>
                          <SelectItem value="escalate">Escalar a politica</SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Action-specific fields */}
                      {action.type === 'ewelink_toggle' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">ID Dispositivo</Label>
                            <Input className="text-xs" value={action.deviceId} onChange={e => updateAction(idx, { deviceId: e.target.value })} placeholder="ID del dispositivo eWeLink" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Estado</Label>
                            <Select value={action.toggleState} onValueChange={v => updateAction(idx, { toggleState: v })}>
                              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="on">Encender (ON)</SelectItem>
                                <SelectItem value="off">Apagar (OFF)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {action.type === 'ewelink_siren' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">ID Dispositivo</Label>
                            <Input className="text-xs" value={action.deviceId} onChange={e => updateAction(idx, { deviceId: e.target.value })} placeholder="ID de la sirena eWeLink" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Duracion (segundos)</Label>
                            <Input className="text-xs" type="number" min={1} value={action.sirenDuration} onChange={e => updateAction(idx, { sirenDuration: parseInt(e.target.value) || 30 })} />
                          </div>
                        </div>
                      )}

                      {action.type === 'send_notification' && (
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Canal</Label>
                            <Select value={action.notifyChannel} onValueChange={v => updateAction(idx, { notifyChannel: v })}>
                              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="push">Push</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Mensaje</Label>
                            <Textarea className="text-xs h-16" value={action.messageTemplate} onChange={e => updateAction(idx, { messageTemplate: e.target.value })} placeholder="Plantilla del mensaje de notificacion" />
                          </div>
                        </div>
                      )}

                      {action.type === 'create_incident' && (
                        <p className="text-xs text-muted-foreground">Se creara un incidente automaticamente con los datos del disparador.</p>
                      )}

                      {action.type === 'escalate' && (
                        <div className="space-y-1">
                          <Label className="text-xs">Politica de escalamiento</Label>
                          <Select value={action.escalationPolicy} onValueChange={v => updateAction(idx, { escalationPolicy: v })}>
                            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Por defecto</SelectItem>
                              <SelectItem value="supervisor">Supervisor</SelectItem>
                              <SelectItem value="manager">Gerente</SelectItem>
                              <SelectItem value="emergency">Emergencia</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Cooldown and active toggle */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cooldown (min)</Label>
                    <Input type="number" min={0} value={newRule.cooldownMinutes} onChange={e => setNewRule(r => ({ ...r, cooldownMinutes: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Switch checked={newRule.isActive} onCheckedChange={v => setNewRule(r => ({ ...r, isActive: v }))} />
                    <Label className="text-xs">Activa</Label>
                  </div>
                </div>

                {/* Advanced: raw JSON (collapsible) */}
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">JSON avanzado (condiciones y acciones)</summary>
                  <div className="mt-2 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Condiciones (JSON)</Label>
                      <Textarea className="font-mono text-xs h-16" value={buildConditionsJson(newRule.triggerType, severity, offlineMinutes, cronExpression)} readOnly />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Acciones (JSON)</Label>
                      <Textarea className="font-mono text-xs h-16" value={buildActionsJson(ruleActions)} readOnly />
                    </div>
                  </div>
                </details>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowCreateRule(false)}>Cancelar</Button>
                <Button onClick={handleCreateRule} disabled={!newRule.name || createRuleMutation.isPending}>
                  {createRuleMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando...</> : 'Crear Regla'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {loadingRules ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Cog className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No hay reglas de automatizacion configuradas</p>
                <p className="text-sm text-muted-foreground mt-1">Crea tu primera regla para automatizar flujos de trabajo</p>
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{rule.name}</h3>
                          <Badge variant="outline">{triggerTypeSpanish[rule.triggerType] || rule.triggerType}</Badge>
                          <Badge variant="secondary">{rule.actionCount ?? 0} acciones</Badge>
                          {rule.priority && (
                            <Badge variant="outline">Prioridad: {rule.priority}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Ejecutada {rule.triggerCount ?? 0} veces
                          {rule.lastTriggeredAt && ` | Última: ${new Date(rule.lastTriggeredAt).toLocaleString('es-CO')}`}
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
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : executions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <PlayCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">Sin ejecuciones aun</p>
                <p className="text-sm text-muted-foreground mt-1">Las ejecuciones apareceran aqui cuando se activen las reglas de automatizacion</p>
              </CardContent>
            </Card>
          ) : (
            executions.map((exec: any) => {
              const status = exec.status as string;
              const StatusIcon = status === 'success' ? CheckCircle : status === 'failed' ? XCircle : PlayCircle;
              const statusColor = status === 'success' ? 'text-success' : status === 'failed' ? 'text-destructive' : 'text-warning';
              return (
                <Card key={exec.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <StatusIcon className={`h-5 w-5 mt-0.5 ${statusColor}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{exec.ruleName || 'Regla desconocida'}</h3>
                            <Badge className={executionStatusColors[status] || 'bg-gray-500'}>
                              {execStatusSpanish[status] || status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Duración: {exec.executionTime != null ? `${exec.executionTime}ms` : 'N/A'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {exec.createdAt ? new Date(exec.createdAt).toLocaleString('es-CO') : 'N/A'}
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

        {/* ── TASK 3: Historial Tab (detailed execution history) ── */}
        <TabsContent value="history" className="space-y-4">
          {loadingExecutions ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : executions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">Sin historial de ejecuciones</p>
                <p className="text-sm text-muted-foreground mt-1">El historial detallado aparecera cuando se ejecuten reglas de automatizacion</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <div className="rounded-md border">
                <div className="grid grid-cols-5 gap-4 p-3 border-b bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <span>Regla</span>
                  <span>Disparador</span>
                  <span>Acciones ejecutadas</span>
                  <span>Resultado</span>
                  <span>Fecha / Hora</span>
                </div>
                {executions.map((exec: any) => {
                  const status = exec.status as string;
                  const statusColor = status === 'success' ? 'text-success' : status === 'failed' ? 'text-destructive' : 'text-warning';
                  const StatusIcon = status === 'success' ? CheckCircle : status === 'failed' ? XCircle : PlayCircle;
                  const actionsExecuted = exec.actionsExecuted as string[] | undefined;
                  const triggerType = exec.triggerType as string | undefined;
                  return (
                    <div key={exec.id} className="grid grid-cols-5 gap-4 p-3 border-b last:border-b-0 items-center text-sm">
                      <span className="font-medium truncate">{exec.ruleName || 'Regla desconocida'}</span>
                      <span className="text-muted-foreground">
                        <Badge variant="outline" className="text-xs">{triggerTypeSpanish[triggerType || ''] || triggerType || exec.triggerData || 'N/A'}</Badge>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {actionsExecuted && actionsExecuted.length > 0
                          ? actionsExecuted.map((a, i) => (
                              <Badge key={i} variant="secondary" className="mr-1 mb-1 text-xs">
                                {actionTypeLabels[a] || a}
                              </Badge>
                            ))
                          : <span>{exec.executionTime != null ? `${exec.executionTime}ms` : 'N/A'}</span>
                        }
                      </span>
                      <span className="flex items-center gap-1">
                        <StatusIcon className={`h-3.5 w-3.5 ${statusColor}`} />
                        <span className={`text-xs font-medium ${statusColor}`}>
                          {status === 'success' ? 'Exitoso' : status === 'failed' ? 'Fallido' : status === 'partial' ? 'Parcial' : status}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {exec.createdAt ? new Date(exec.createdAt as string).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
