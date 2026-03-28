import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { emergencyProtocolsApi, emergencyContactsApi, emergencyActivationsApi } from "@/services/emergency-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertOctagon, Phone, ShieldAlert, Users, Plus,
  ClipboardCheck, Send, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronUp, RotateCcw,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorState from "@/components/ui/ErrorState";

// ═══════════════════════════════════════════════════════════
// Protocol Checklists — step-by-step operator procedures
// ═══════════════════════════════════════════════════════════

const PROTOCOL_CHECKLISTS: Record<string, string[]> = {
  fire: [
    'Activar alarma de incendio general',
    'Llamar al cuerpo de bomberos (123)',
    'Verificar sistema de rociadores',
    'Confirmar evacuación de zona afectada',
    'Designar punto de encuentro',
    'Verificar que todos los pisos han sido evacuados',
    'Cortar suministro de gas si aplica',
    'Documentar con fotografías si es seguro',
    'Confirmar llegada de bomberos',
    'Coordinar acceso para servicios de emergencia',
  ],
  medical: [
    'Llamar ambulancia (125)',
    'Enviar guardia más cercano al punto',
    'No mover al paciente a menos que sea peligroso',
    'Asegurar acceso libre para ambulancia',
    'Solicitar datos del paciente (nombre, edad)',
    'Verificar si hay desfibrilador disponible',
    'Documentar hora y síntomas iniciales',
    'Guiar ambulancia hasta la ubicación exacta',
  ],
  security: [
    'Alertar a todos los guardias en turno',
    'Revisar cámaras de la zona afectada',
    'Bloquear accesos a la zona si es necesario',
    'Llamar a la policía si se requiere (112)',
    'Documentar descripción de sospechosos',
    'Preservar escena y evidencia',
    'Tomar declaraciones de testigos',
    'Generar reporte de incidente',
  ],
  natural_disaster: [
    'Activar protocolo de evacuación',
    'Verificar rutas de evacuación disponibles',
    'Mover personal a zonas seguras',
    'Cortar suministros eléctricos si hay riesgo',
    'Verificar estructuras antes de reingreso',
    'Comunicar estado a todos los pisos/zonas',
    'Coordinar con defensa civil',
  ],
  evacuation: [
    'Activar alarma de evacuación',
    'Asignar guías por piso/zona',
    'Verificar ascensores desactivados',
    'Confirmar rutas de evacuación libres',
    'Dirigir personal al punto de encuentro',
    'Hacer conteo de personal por zona',
    'Confirmar que no quedan personas en el edificio',
    'Reportar resultado del conteo',
  ],
  lockdown: [
    'Bloquear todas las entradas principales',
    'Activar cerraduras electrónicas',
    'Notificar a todos los ocupantes',
    'Verificar que nadie quede afuera',
    'Mantener comunicación con autoridades',
    'Monitorear cámaras activamente',
    'Preparar protocolo de liberación',
  ],
  bomb_threat: [
    'NO tocar objetos sospechosos',
    'Evacuar zona de 100m alrededor',
    'Llamar a policía y antiexplosivos',
    'Registrar detalles de la amenaza',
    'Revisar grabaciones de cámaras',
    'No usar radios cerca del objeto',
    'Esperar autorización para reingreso',
  ],
  active_shooter: [
    'Activar lockdown inmediato',
    'Llamar policía (112) - indicar tirador activo',
    'Instruir: Escapar, Esconderse, o Pelear como último recurso',
    'Mantener puertas cerradas y barricadas',
    'Silenciar teléfonos',
    'No abrir a menos que confirme policía',
    'Brindar primeros auxilios cuando sea seguro',
    'Preparar descripción del agresor',
  ],
  hazmat: [
    'Evacuar zona contaminada',
    'No tocar sustancia desconocida',
    'Llamar a HAZMAT / bomberos especializados',
    'Ventilar área si es seguro',
    'Identificar sustancia si es posible (etiqueta, olor)',
    'Atender afectados sin exponerse',
    'Documentar zona y tipo de derrame',
  ],
};

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

interface ChecklistItemState {
  checked: boolean;
  operator: string;
  timestamp: string | null;
}

interface DispatchEntry {
  id: string;
  name: string;
  role: string;
  channel: string;
  status: 'pending' | 'sending' | 'sent' | 'failed';
}

// ═══════════════════════════════════════════════════════════
// Helper — simulated operator name
// ═══════════════════════════════════════════════════════════
const CURRENT_OPERATOR = 'Operator';

// ═══════════════════════════════════════════════════════════
// Sub-component: Emergency Checklist
// ═══════════════════════════════════════════════════════════

function EmergencyChecklist({ protocolType, activationId }: { protocolType: string; activationId: string }) {
  const items = PROTOCOL_CHECKLISTS[protocolType] ?? [];
  const storageKey = `emergency-checklist-${activationId}`;

  const [checks, setChecks] = useState<ChecklistItemState[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ChecklistItemState[];
        if (Array.isArray(parsed) && parsed.length === items.length) {
          return parsed;
        }
      }
    } catch {
      // ignore corrupt data
    }
    return items.map(() => ({ checked: false, operator: '', timestamp: null }));
  });

  // Persist checklist state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(checks));
  }, [checks, storageKey]);

  // Reset state when the activationId or protocolType changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ChecklistItemState[];
        if (Array.isArray(parsed) && parsed.length === items.length) {
          setChecks(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setChecks(items.map(() => ({ checked: false, operator: '', timestamp: null })));
  }, [activationId, storageKey, items.length]);

  const completedCount = checks.filter((c) => c.checked).length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && completedCount === totalCount;

  const toggleItem = useCallback((index: number) => {
    setChecks((prev) => {
      const next = [...prev];
      const wasChecked = next[index].checked;
      next[index] = {
        checked: !wasChecked,
        operator: wasChecked ? '' : CURRENT_OPERATOR,
        timestamp: wasChecked ? null : new Date().toISOString(),
      };
      return next;
    });
  }, []);

  const completeAll = useCallback(() => {
    const now = new Date().toISOString();
    setChecks((prev) =>
      prev.map((c) =>
        c.checked ? c : { checked: true, operator: CURRENT_OPERATOR, timestamp: now },
      ),
    );
  }, []);

  const resetAll = useCallback(() => {
    setChecks(items.map(() => ({ checked: false, operator: '', timestamp: null })));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="py-4 text-center text-muted-foreground text-sm">
        No checklist defined for protocol type "{protocolType}".
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium flex items-center gap-1.5">
            <ClipboardCheck className="h-4 w-4" />
            Checklist Progress
          </span>
          <span className="tabular-nums text-muted-foreground">
            {completedCount}/{totalCount} completed
          </span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>

      {/* Success banner */}
      {allDone && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Checklist Complete — all steps have been verified
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button size="sm" variant="default" onClick={completeAll} disabled={allDone}>
          <CheckCircle2 className="h-4 w-4 mr-1" /> Complete All
        </Button>
        <Button size="sm" variant="outline" onClick={resetAll} disabled={completedCount === 0}>
          <RotateCcw className="h-4 w-4 mr-1" /> Reset
        </Button>
      </div>

      {/* Checklist items */}
      <ul className="space-y-1">
        {items.map((label, idx) => {
          const state = checks[idx];
          return (
            <li
              key={`${activationId}-${idx}`}
              className={`flex items-start gap-3 rounded-md px-3 py-2 transition-colors ${
                state.checked ? 'bg-green-500/5' : 'hover:bg-muted/50'
              }`}
            >
              <Checkbox
                checked={state.checked}
                onCheckedChange={() => toggleItem(idx)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${state.checked ? 'line-through text-muted-foreground' : ''}`}>
                  {label}
                </span>
                {state.checked && state.timestamp && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {state.operator} — {new Date(state.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>
              {state.checked && (
                <Badge variant="outline" className="shrink-0 text-green-600 border-green-500/30 text-xs">
                  Done
                </Badge>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Sub-component: Dispatch Notifications
// ═══════════════════════════════════════════════════════════

function DispatchNotifications({
  activationId,
  contacts,
}: {
  activationId: string;
  contacts: any[];
}) {
  const [dispatches, setDispatches] = useState<DispatchEntry[]>([]);
  const [started, setStarted] = useState(false);
  const intervalRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Build dispatch list from contacts when activation first mounts
  useEffect(() => {
    if (contacts.length === 0) return;

    const entries: DispatchEntry[] = contacts.map((c: any) => ({
      id: c.id,
      name: c.name ?? 'Unknown',
      role: c.role ?? 'Contact',
      channel: c.phone ? `SMS ${c.phone}` : c.email ? `Email ${c.email}` : 'Push',
      status: 'pending' as const,
    }));

    // Also add simulated on-duty guards
    const guardEntries: DispatchEntry[] = [
      { id: 'guard-shift-1', name: 'Guard on Duty — Lobby', role: 'Security Guard', channel: 'Radio + Push', status: 'pending' },
      { id: 'guard-shift-2', name: 'Guard on Duty — Perimeter', role: 'Security Guard', channel: 'Radio + Push', status: 'pending' },
      { id: 'guard-shift-3', name: 'Patrol Unit Alpha', role: 'Mobile Patrol', channel: 'Radio + Push', status: 'pending' },
    ];

    setDispatches([...guardEntries, ...entries]);
    setStarted(false);
  }, [contacts, activationId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intervalRefs.current.forEach(clearTimeout);
    };
  }, []);

  const runDispatch = useCallback(() => {
    setStarted(true);
    // Set all to "sending"
    setDispatches((prev) => prev.map((d) => ({ ...d, status: 'sending' as const })));

    // Simulate staggered results — each entry resolves after a random delay
    dispatches.forEach((entry, idx) => {
      const delay = 800 + idx * 600 + Math.random() * 400;
      const timer = setTimeout(() => {
        setDispatches((prev) => {
          const next = [...prev];
          const target = next.find((d) => d.id === entry.id);
          if (target) {
            // ~90% success rate simulation
            target.status = Math.random() > 0.1 ? 'sent' : 'failed';
          }
          return next;
        });
      }, delay);
      intervalRefs.current.push(timer);
    });
  }, [dispatches]);

  const sentCount = dispatches.filter((d) => d.status === 'sent').length;
  const failedCount = dispatches.filter((d) => d.status === 'failed').length;
  const sendingCount = dispatches.filter((d) => d.status === 'sending').length;

  const statusIcon = (status: DispatchEntry['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-xs text-muted-foreground">Pending</Badge>;
      case 'sending':
        return (
          <Badge variant="outline" className="text-xs text-blue-500 border-blue-500/30 gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Sending...
          </Badge>
        );
      case 'sent':
        return (
          <Badge variant="outline" className="text-xs text-green-600 border-green-500/30 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Sent
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="text-xs text-destructive border-destructive/30 gap-1">
            <XCircle className="h-3 w-3" /> Failed
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm flex items-center gap-1.5">
          <Send className="h-4 w-4" />
          Dispatch Notifications
        </span>
        {started && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {sentCount} sent / {failedCount} failed / {sendingCount} in progress
          </span>
        )}
      </div>

      {!started && dispatches.length > 0 && (
        <Button size="sm" variant="destructive" onClick={runDispatch} className="gap-1">
          <Send className="h-4 w-4" /> Dispatch All Notifications ({dispatches.length})
        </Button>
      )}

      {dispatches.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts available for dispatch.</p>
      ) : (
        <ul className="space-y-1">
          {dispatches.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{entry.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {entry.role} — {entry.channel}
                  </p>
                </div>
              </div>
              {statusIcon(entry.status)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Color maps
// ═══════════════════════════════════════════════════════════

const protocolTypeColors: Record<string, string> = {
  fire: "bg-destructive",
  medical: "bg-success",
  security: "bg-primary",
  natural_disaster: "bg-warning",
  evacuation: "bg-warning",
  lockdown: "bg-info",
  bomb_threat: "bg-red-700",
  active_shooter: "bg-red-900",
  hazmat: "bg-amber-600",
};

const activationStatusColors: Record<string, string> = {
  active: "bg-destructive",
  resolved: "bg-success",
  cancelled: "bg-gray-500",
};

// ═══════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════

export default function EmergencyPage() {
  const [activeTab, setActiveTab] = useState("protocols");
  const [expandedActivation, setExpandedActivation] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Protocols ───────────────────────────────────────────
  const { data: protocolsData, isLoading: loadingProtocols, isError: protocolsError, error: protocolsErrorObj, refetch: refetchProtocols } = useQuery({
    queryKey: ["emergency", "protocols"],
    queryFn: () => emergencyProtocolsApi.list(),
  });

  // ── Contacts ────────────────────────────────────────────
  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ["emergency", "contacts"],
    queryFn: () => emergencyContactsApi.list(),
  });

  // ── Activations ─────────────────────────────────────────
  const { data: activationsData, isLoading: loadingActivations } = useQuery({
    queryKey: ["emergency", "activations"],
    queryFn: () => emergencyActivationsApi.list(),
    refetchInterval: 10000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["emergency", "stats"],
    queryFn: () => emergencyActivationsApi.stats(),
    refetchInterval: 15000,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => emergencyActivationsApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency"] });
      toast({ title: "Emergency resolved" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => emergencyActivationsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency"] });
      toast({ title: "Emergency cancelled" });
    },
  });

  // ── Create Protocol ──────────────────────────────────────
  const [protocolDialogOpen, setProtocolDialogOpen] = useState(false);
  const [protocolForm, setProtocolForm] = useState({ name: "", type: "security", description: "", steps: "[]" });
  const createProtocolMutation = useMutation({
    mutationFn: (data: typeof protocolForm) => {
      let parsedSteps: unknown = [];
      try { parsedSteps = JSON.parse(data.steps); } catch { /* keep empty */ }
      return emergencyProtocolsApi.create({ name: data.name, type: data.type, description: data.description, steps: parsedSteps });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency"] });
      toast({ title: "Protocol created" });
      setProtocolDialogOpen(false);
      setProtocolForm({ name: "", type: "security", description: "", steps: "[]" });
    },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  // ── Create Contact ─────────────────────────────────────
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", phone: "", role: "", email: "", priority: "1" });
  const createContactMutation = useMutation({
    mutationFn: (data: typeof contactForm) =>
      emergencyContactsApi.create({ name: data.name, phone: data.phone, role: data.role, email: data.email, priority: data.priority ? Number(data.priority) : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency"] });
      toast({ title: "Contact created" });
      setContactDialogOpen(false);
      setContactForm({ name: "", phone: "", role: "", email: "", priority: "1" });
    },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  // ── Activate Emergency ─────────────────────────────────
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [activateForm, setActivateForm] = useState({ protocolId: "", notes: "" });
  const activateEmergencyMutation = useMutation({
    mutationFn: (data: typeof activateForm) =>
      emergencyActivationsApi.create({ protocolId: data.protocolId, notes: data.notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emergency"] });
      toast({ title: "Emergency activated", variant: "destructive" });
      setActivateDialogOpen(false);
      setActivateForm({ protocolId: "", notes: "" });
    },
    onError: (err: Error) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const protocols = protocolsData?.data ?? [];
  const contacts = contactsData?.data ?? [];
  const activations = activationsData?.data ?? [];
  const stats = statsData?.data;

  const toggleExpanded = useCallback((id: string) => {
    setExpandedActivation((prev) => (prev === id ? null : id));
  }, []);

  // Resolve the protocol type for an activation — uses protocolType field,
  // falls back to matching by protocolId, then defaults to 'security'.
  const resolveProtocolType = useCallback(
    (activation: any): string => {
      if (activation.protocolType) return activation.protocolType;
      if (activation.type) return activation.type;
      if (activation.protocolId) {
        const proto = protocols.find((p: any) => p.id === activation.protocolId);
        if (proto?.type) return proto.type;
      }
      return 'security';
    },
    [protocols],
  );

  if (protocolsError) return <ErrorState error={protocolsErrorObj as Error} onRetry={refetchProtocols} />;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" />
            Emergency Management
          </h1>
          <p className="text-muted-foreground">
            Manage emergency protocols, contacts, and active emergencies
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Emergencies</p>
                <p className="text-3xl font-bold text-destructive">{stats?.activeEmergencies ?? 0}</p>
              </div>
              <AlertOctagon className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Protocols</p>
                <p className="text-3xl font-bold">{stats?.totalProtocols ?? 0}</p>
              </div>
              <ShieldAlert className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Emergency Contacts</p>
                <p className="text-3xl font-bold">{stats?.emergencyContacts ?? 0}</p>
              </div>
              <Phone className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved Today</p>
                <p className="text-3xl font-bold text-success">{stats?.resolvedToday ?? 0}</p>
              </div>
              <Users className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="protocols" className="gap-1">
            <ShieldAlert className="h-4 w-4" /> Protocols
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1">
            <Phone className="h-4 w-4" /> Contacts
          </TabsTrigger>
          <TabsTrigger value="activations" className="gap-1">
            <AlertOctagon className="h-4 w-4" /> Activations
          </TabsTrigger>
        </TabsList>

        {/* ── Protocols Tab ───────────────────────────────── */}
        <TabsContent value="protocols" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1" onClick={() => setProtocolDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New Protocol
            </Button>
          </div>
          {loadingProtocols ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : protocols.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No emergency protocols</p>
                <p className="text-sm text-muted-foreground mt-1">Create protocols to define emergency response procedures</p>
              </CardContent>
            </Card>
          ) : (
            protocols.map((protocol: any) => (
              <Card key={protocol.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{protocol.name}</h3>
                          <Badge className={protocolTypeColors[protocol.type] || 'bg-gray-500'}>
                            {protocol.type?.replace('_', ' ')}
                          </Badge>
                          {protocol.priority && (
                            <Badge variant="outline">Priority: {protocol.priority}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Steps: {protocol.steps?.length ?? 0}
                          {protocol.description && ` | ${protocol.description}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Contacts Tab ────────────────────────────────── */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1" onClick={() => setContactDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New Contact
            </Button>
          </div>
          {loadingContacts ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : contacts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Phone className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No emergency contacts</p>
                <p className="text-sm text-muted-foreground mt-1">Add contacts who should be notified during emergencies</p>
              </CardContent>
            </Card>
          ) : (
            contacts.map((contact: any) => (
              <Card key={contact.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{contact.name}</h3>
                          {contact.role && <Badge variant="outline">{contact.role}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {contact.phone && `Phone: ${contact.phone}`}
                          {contact.phone && contact.email && ' | '}
                          {contact.email && `Email: ${contact.email}`}
                        </p>
                        {contact.availability && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Availability: {contact.availability}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Activations Tab ─────────────────────────────── */}
        <TabsContent value="activations" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1" variant="destructive" onClick={() => setActivateDialogOpen(true)}>
              <AlertOctagon className="h-4 w-4" /> Activate Emergency
            </Button>
          </div>
          {loadingActivations ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
            </div>
          ) : activations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertOctagon className="h-12 w-12 mx-auto mb-4 text-success" />
                <p className="text-lg font-medium">No active emergencies</p>
                <p className="text-sm text-muted-foreground mt-1">All clear — no emergencies currently active</p>
              </CardContent>
            </Card>
          ) : (
            activations.map((activation: any) => {
              const isExpanded = expandedActivation === activation.id;
              const isActive = activation.status === 'active';
              const protocolType = resolveProtocolType(activation);

              return (
                <Card key={activation.id} className={isActive ? 'border-destructive/50' : ''}>
                  <CardContent className="pt-6">
                    {/* Activation header row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertOctagon className={`h-5 w-5 mt-0.5 ${isActive ? 'text-destructive animate-pulse' : 'text-muted-foreground'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{activation.title || activation.protocolName || 'Emergency'}</h3>
                            <Badge className={activationStatusColors[activation.status] || 'bg-gray-500'}>
                              {activation.status}
                            </Badge>
                            <Badge className={protocolTypeColors[protocolType] || 'bg-gray-500'}>
                              {protocolType.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {activation.description || 'No description'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Activated: {activation.createdAt ? new Date(activation.createdAt).toLocaleString() : 'N/A'}
                            {activation.resolvedAt && ` | Resolved: ${new Date(activation.resolvedAt).toLocaleString()}`}
                            {activation.cancelledAt && ` | Cancelled: ${new Date(activation.cancelledAt).toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {isActive && (
                          <>
                            <Button size="sm" variant="default" onClick={() => resolveMutation.mutate(activation.id)}>
                              Resolve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => cancelMutation.mutate(activation.id)}>
                              Cancel
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleExpanded(activation.id)}
                          className="gap-1"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {isExpanded ? 'Collapse' : 'Manage'}
                        </Button>
                      </div>
                    </div>

                    {/* ── Expanded: Checklist + Dispatch ─────────── */}
                    {isExpanded && (
                      <div className="mt-6 space-y-6 border-t pt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Checklist Panel */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <ClipboardCheck className="h-4 w-4" />
                                Response Checklist
                              </CardTitle>
                              <CardDescription>
                                Follow each step in order. Check off items as completed.
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <EmergencyChecklist
                                protocolType={protocolType}
                                activationId={activation.id}
                              />
                            </CardContent>
                          </Card>

                          {/* Dispatch Panel */}
                          <Card>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base flex items-center gap-2">
                                <Send className="h-4 w-4" />
                                Dispatch Notifications
                              </CardTitle>
                              <CardDescription>
                                Notify on-duty guards and emergency contacts.
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <DispatchNotifications
                                activationId={activation.id}
                                contacts={contacts}
                              />
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* New Protocol Dialog */}
      <Dialog open={protocolDialogOpen} onOpenChange={setProtocolDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Emergency Protocol</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={protocolForm.name} onChange={(e) => setProtocolForm(f => ({ ...f, name: e.target.value }))} placeholder="Protocol name" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={protocolForm.type} onValueChange={(v) => setProtocolForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fire">Fire</SelectItem>
                  <SelectItem value="medical">Medical</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="natural_disaster">Natural Disaster</SelectItem>
                  <SelectItem value="evacuation">Evacuation</SelectItem>
                  <SelectItem value="lockdown">Lockdown</SelectItem>
                  <SelectItem value="bomb_threat">Bomb Threat</SelectItem>
                  <SelectItem value="active_shooter">Active Shooter</SelectItem>
                  <SelectItem value="hazmat">Hazmat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={protocolForm.description} onChange={(e) => setProtocolForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the protocol" />
            </div>
            <div className="space-y-2">
              <Label>Steps (JSON array)</Label>
              <Textarea value={protocolForm.steps} onChange={(e) => setProtocolForm(f => ({ ...f, steps: e.target.value }))} placeholder='["Step 1", "Step 2"]' rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProtocolDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createProtocolMutation.mutate(protocolForm)} disabled={!protocolForm.name || createProtocolMutation.isPending}>
              {createProtocolMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Create Protocol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Emergency Contact</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={contactForm.name} onChange={(e) => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Contact name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={contactForm.phone} onChange={(e) => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="+57 300 123 4567" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={contactForm.email} onChange={(e) => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={contactForm.role} onChange={(e) => setContactForm(f => ({ ...f, role: e.target.value }))} placeholder="Security Manager" />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input type="number" value={contactForm.priority} onChange={(e) => setContactForm(f => ({ ...f, priority: e.target.value }))} placeholder="1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createContactMutation.mutate(contactForm)} disabled={!contactForm.name || createContactMutation.isPending}>
              {createContactMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Create Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Emergency Dialog */}
      <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Activate Emergency</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select value={activateForm.protocolId} onValueChange={(v) => setActivateForm(f => ({ ...f, protocolId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a protocol" /></SelectTrigger>
                <SelectContent>
                  {protocols.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.type?.replace('_', ' ')})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={activateForm.notes} onChange={(e) => setActivateForm(f => ({ ...f, notes: e.target.value }))} placeholder="Describe the emergency situation" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => activateEmergencyMutation.mutate(activateForm)} disabled={!activateForm.protocolId || activateEmergencyMutation.isPending}>
              {activateEmergencyMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
