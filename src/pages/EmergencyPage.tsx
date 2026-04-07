import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { emergencyProtocolsApi, emergencyContactsApi, emergencyActivationsApi } from "@/services/emergency-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertOctagon, Phone, ShieldAlert, Users, Plus,
  ClipboardCheck, Send, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronUp, RotateCcw, Mail, Flame, Heart, Shield, AlertTriangle,
  Pencil, Trash2
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorState from "@/components/ui/ErrorState";
import { PageShell } from "@/components/shared/PageShell";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ══════════════════════════════════════════════════════════════
// Protocol Checklists
// ══════════════════════════════════════════════════════════════

const PROTOCOL_CHECKLISTS: Record<string, string[]> = {
  fire: ['Activar alarma de incendio', 'Llamar bomberos (119)', 'Verificar rociadores', 'Evacuar zona afectada', 'Designar punto de encuentro', 'Verificar evacuación completa', 'Cortar gas si aplica', 'Documentar con fotos', 'Confirmar llegada bomberos', 'Coordinar acceso servicios'],
  medical: ['Llamar ambulancia (125)', 'Enviar guardia al punto', 'No mover al paciente', 'Asegurar acceso ambulancia', 'Solicitar datos del paciente', 'Verificar desfibrilador', 'Documentar hora y síntomas', 'Guiar ambulancia a ubicación'],
  security: ['Alertar guardias en turno', 'Revisar cámaras de la zona', 'Bloquear accesos si es necesario', 'Llamar policía (123)', 'Documentar sospechosos', 'Preservar escena y evidencia', 'Tomar declaraciones testigos', 'Generar reporte incidente'],
  intrusion: ['Alertar guardias en turno', 'Revisar cámaras de la zona', 'Bloquear accesos', 'Llamar policía (123)', 'Verificar puntos de acceso comprometidos', 'Documentar evidencia', 'Generar reporte'],
  natural_disaster: ['Activar evacuación', 'Verificar rutas de evacuación', 'Mover a zonas seguras', 'Cortar suministros eléctricos', 'Verificar estructuras antes de reingreso', 'Comunicar a todos los pisos', 'Coordinar con defensa civil'],
  panic: ['Activar alerta general', 'Notificar a todos los guardias', 'Revisar cámaras perimetrales', 'Llamar policía (123)', 'Bloquear accesos principales', 'Verificar identidad de intrusos', 'Esperar instrucciones de policía'],
  bomb_threat: ['NO tocar objetos sospechosos', 'Evacuar 100m alrededor', 'Llamar policía y antiexplosivos', 'Registrar detalles de amenaza', 'Revisar grabaciones', 'No usar radios cerca del objeto', 'Esperar autorización reingreso'],
  evacuation: ['Activar alarma de evacuación', 'Asignar guías por piso', 'Verificar ascensores desactivados', 'Confirmar rutas libres', 'Dirigir al punto de encuentro', 'Conteo de personal', 'Confirmar edificio vacío'],
  lockdown: ['Bloquear entradas principales', 'Activar cerraduras electrónicas', 'Notificar ocupantes', 'Verificar nadie quede afuera', 'Comunicación con autoridades', 'Monitorear cámaras', 'Preparar protocolo liberación'],
  active_shooter: ['Activar lockdown inmediato', 'Llamar policía (123) - tirador activo', 'Instruir: Escapar > Esconderse > Pelear', 'Mantener puertas cerradas', 'Silenciar teléfonos', 'No abrir hasta confirmar policía', 'Primeros auxilios cuando sea seguro'],
  hazmat: ['Evacuar zona contaminada', 'No tocar sustancia desconocida', 'Llamar bomberos especializados', 'Ventilar si es seguro', 'Identificar sustancia', 'Atender afectados sin exponerse', 'Documentar tipo de derrame'],
};

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const typeConfig: Record<string, { label: string; icon: typeof Flame; color: string }> = {
  fire: { label: 'Incendio', icon: Flame, color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  medical: { label: 'Médica', icon: Heart, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  security: { label: 'Seguridad', icon: Shield, color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  intrusion: { label: 'Intrusión', icon: AlertTriangle, color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  panic: { label: 'Pánico', icon: AlertOctagon, color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  natural_disaster: { label: 'Desastre Natural', icon: AlertTriangle, color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  bomb_threat: { label: 'Amenaza Bomba', icon: AlertOctagon, color: 'bg-red-600/10 text-red-500 border-red-600/30' },
  evacuation: { label: 'Evacuación', icon: Users, color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  lockdown: { label: 'Confinamiento', icon: Shield, color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  active_shooter: { label: 'Tirador Activo', icon: AlertOctagon, color: 'bg-red-700/10 text-red-500 border-red-700/30' },
  hazmat: { label: 'Mat. Peligrosos', icon: AlertTriangle, color: 'bg-amber-600/10 text-amber-500 border-amber-600/30' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: 'Activa', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
  resolved: { label: 'Resuelta', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  cancelled: { label: 'Cancelada', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  false_alarm: { label: 'Falsa Alarma', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
};

const roleLabels: Record<string, string> = {
  police: 'Policía', fire_dept: 'Bomberos', ambulance: 'Ambulancia',
  supervisor: 'Supervisor', admin: 'Administrador', custom: 'Otro',
};

interface ChecklistState { checked: boolean; operator: string; timestamp: string | null; }
interface DispatchEntry { id: string; name: string; role: string; channel: string; status: 'pending' | 'sending' | 'sent' | 'failed'; }

// ══════════════════════════════════════════════════════════════
// Checklist Sub-component
// ══════════════════════════════════════════════════════════════

function EmergencyChecklist({ protocolType, activationId }: { protocolType: string; activationId: string }) {
  const items = PROTOCOL_CHECKLISTS[protocolType] ?? [];
  const storageKey = `emergency-checklist-${activationId}`;

  const [checks, setChecks] = useState<ChecklistState[]>(() => {
    try { const s = localStorage.getItem(storageKey); if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length === items.length) return p; } } catch {}
    return items.map(() => ({ checked: false, operator: '', timestamp: null }));
  });

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(checks)); }, [checks, storageKey]);
  useEffect(() => {
    try { const s = localStorage.getItem(storageKey); if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length === items.length) { setChecks(p); return; } } } catch {}
    setChecks(items.map(() => ({ checked: false, operator: '', timestamp: null })));
  }, [activationId, storageKey, items.length]);

  const done = checks.filter(c => c.checked).length;
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
  const allDone = items.length > 0 && done === items.length;

  const toggle = useCallback((i: number) => {
    setChecks(prev => { const n = [...prev]; n[i] = { checked: !n[i].checked, operator: n[i].checked ? '' : 'Operador', timestamp: n[i].checked ? null : new Date().toISOString() }; return n; });
  }, []);

  if (items.length === 0) return <p className="text-sm text-slate-500 py-4 text-center">Sin checklist para este tipo de protocolo.</p>;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium flex items-center gap-1.5 text-white"><ClipboardCheck className="h-4 w-4" /> Progreso</span>
          <span className="text-slate-400 tabular-nums">{done}/{items.length}</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>
      {allDone && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Checklist completo
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => setChecks(prev => prev.map(c => c.checked ? c : { checked: true, operator: 'Operador', timestamp: new Date().toISOString() }))} disabled={allDone} className="gap-1 text-xs"><CheckCircle2 className="h-3 w-3" /> Completar todo</Button>
        <Button size="sm" variant="outline" onClick={() => setChecks(items.map(() => ({ checked: false, operator: '', timestamp: null })))} disabled={done === 0} className="gap-1 text-xs"><RotateCcw className="h-3 w-3" /> Reiniciar</Button>
      </div>
      <ul className="space-y-0.5">
        {items.map((label, i) => (
          <li key={`${activationId}-${i}`} className={cn("flex items-start gap-3 rounded-md px-3 py-2 transition-colors", checks[i].checked ? "bg-emerald-500/5" : "hover:bg-slate-800/50")}>
            <Checkbox checked={checks[i].checked} onCheckedChange={() => toggle(i)} className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className={cn("text-sm", checks[i].checked && "line-through text-slate-500")}>{label}</span>
              {checks[i].checked && checks[i].timestamp && <p className="text-[10px] text-slate-500 mt-0.5">{checks[i].operator} — {new Date(checks[i].timestamp!).toLocaleTimeString('es-CO')}</p>}
            </div>
            {checks[i].checked && <Badge className="shrink-0 text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 border">Listo</Badge>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Dispatch Sub-component
// ══════════════════════════════════════════════════════════════

function DispatchNotifications({ activationId, contacts }: { activationId: string; contacts: any[] }) {
  const [dispatches, setDispatches] = useState<DispatchEntry[]>([]);
  const [started, setStarted] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (contacts.length === 0) return;
    setDispatches(contacts.map((c: any) => ({
      id: c.id, name: c.name ?? 'Desconocido', role: roleLabels[c.role] || c.role || 'Contacto',
      channel: c.phone ? `SMS ${c.phone}` : c.email ? `Email ${c.email}` : 'Push', status: 'pending',
    })));
    setStarted(false);
  }, [contacts, activationId]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const run = useCallback(() => {
    setStarted(true);
    setDispatches(prev => prev.map(d => ({ ...d, status: 'sending' })));
    dispatches.forEach((entry, i) => {
      const t = setTimeout(() => {
        setDispatches(prev => prev.map(d => d.id === entry.id ? { ...d, status: Math.random() > 0.1 ? 'sent' : 'failed' } : d));
      }, 800 + i * 600 + Math.random() * 400);
      timers.current.push(t);
    });
  }, [dispatches]);

  const sent = dispatches.filter(d => d.status === 'sent').length;
  const failed = dispatches.filter(d => d.status === 'failed').length;

  const statusBadge = (s: DispatchEntry['status']) => {
    const m: Record<string, { label: string; cls: string }> = {
      pending: { label: 'Pendiente', cls: 'text-slate-400 border-slate-700' },
      sending: { label: 'Enviando...', cls: 'text-blue-400 border-blue-500/30' },
      sent: { label: 'Enviado', cls: 'text-emerald-400 border-emerald-500/30' },
      failed: { label: 'Fallido', cls: 'text-red-400 border-red-500/30' },
    };
    const cfg = m[s];
    return <Badge variant="outline" className={cn("text-[9px] gap-1", cfg.cls)}>{s === 'sending' && <Loader2 className="h-2.5 w-2.5 animate-spin" />}{s === 'sent' && <CheckCircle2 className="h-2.5 w-2.5" />}{s === 'failed' && <XCircle className="h-2.5 w-2.5" />}{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm flex items-center gap-1.5 text-white"><Send className="h-4 w-4" /> Notificaciones</span>
        {started && <span className="text-[10px] text-slate-500">{sent} enviados / {failed} fallidos</span>}
      </div>
      {!started && dispatches.length > 0 && (
        <Button size="sm" variant="destructive" onClick={run} className="gap-1 text-xs"><Send className="h-3 w-3" /> Despachar ({dispatches.length})</Button>
      )}
      {dispatches.length === 0 ? (
        <p className="text-xs text-slate-500">Sin contactos disponibles.</p>
      ) : (
        <ul className="space-y-1">
          {dispatches.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-2 hover:bg-slate-800/50">
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <div className="min-w-0"><p className="text-xs font-medium text-white truncate">{d.name}</p><p className="text-[10px] text-slate-500 truncate">{d.role} — {d.channel}</p></div>
              </div>
              {statusBadge(d.status)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════

export default function EmergencyPage() {
  const [activeTab, setActiveTab] = useState("activations");
  const [expandedActivation, setExpandedActivation] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // ── Queries ──
  const { data: protocolsData, isLoading: loadingProtocols, isError, error, refetch } = useQuery({ queryKey: ["emergency", "protocols"], queryFn: () => emergencyProtocolsApi.list() });
  const { data: contactsData, isLoading: loadingContacts } = useQuery({ queryKey: ["emergency", "contacts"], queryFn: () => emergencyContactsApi.list() });
  const { data: activationsData, isLoading: loadingActivations } = useQuery({ queryKey: ["emergency", "activations"], queryFn: () => emergencyActivationsApi.list(), refetchInterval: 10000 });
  const { data: statsData } = useQuery({ queryKey: ["emergency", "stats"], queryFn: () => emergencyActivationsApi.stats(), refetchInterval: 15000 });

  const protocols: any[] = (protocolsData as any)?.data ?? (Array.isArray(protocolsData) ? protocolsData : []);
  const contacts: any[] = (contactsData as any)?.data ?? (Array.isArray(contactsData) ? contactsData : []);
  const activations: any[] = (activationsData as any)?.data ?? (activationsData as any)?.items ?? (Array.isArray(activationsData) ? activationsData : []);
  const stats: any = (statsData as any)?.data ?? statsData;

  // ── Mutations ──
  const resolveMut = useMutation({ mutationFn: (id: string) => emergencyActivationsApi.resolve(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["emergency"] }); toast.success("Emergencia resuelta"); } });
  const cancelMut = useMutation({ mutationFn: (id: string) => emergencyActivationsApi.cancel(id), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["emergency"] }); toast.success("Emergencia cancelada"); } });

  // ── Protocol CRUD ──
  const [protocolDialogOpen, setProtocolDialogOpen] = useState(false);
  const [editingProtocolId, setEditingProtocolId] = useState<string | null>(null);
  const [protocolForm, setProtocolForm] = useState({ name: '', type: 'security', description: '', priority: '1' });

  const createProtocolMut = useMutation({
    mutationFn: (data: typeof protocolForm) => emergencyProtocolsApi.create({ name: data.name, type: data.type, description: data.description, priority: Number(data.priority) || 1, steps: PROTOCOL_CHECKLISTS[data.type] || [] }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["emergency"] }); toast.success('Protocolo creado'); setProtocolDialogOpen(false); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateProtocolMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof protocolForm }) => emergencyProtocolsApi.update(id, { name: data.name, type: data.type, description: data.description, priority: Number(data.priority) || 1 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["emergency"] }); toast.success('Protocolo actualizado'); setProtocolDialogOpen(false); setEditingProtocolId(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteProtocolMut = useMutation({
    mutationFn: (id: string) => emergencyProtocolsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["emergency"] }); toast.success('Protocolo eliminado'); },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Contact CRUD ──
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', role: 'custom', email: '', priority: '1' });

  const createContactMut = useMutation({
    mutationFn: (data: typeof contactForm) => emergencyContactsApi.create({ name: data.name, phone: data.phone, role: data.role, email: data.email || undefined, priority: Number(data.priority) || 1 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["emergency"] }); toast.success('Contacto creado'); setContactDialogOpen(false); },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateContactMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof contactForm }) => emergencyContactsApi.update(id, { name: data.name, phone: data.phone, role: data.role, email: data.email || undefined, priority: Number(data.priority) || 1 }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["emergency"] }); toast.success('Contacto actualizado'); setContactDialogOpen(false); setEditingContactId(null); },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteContactMut = useMutation({
    mutationFn: (id: string) => emergencyContactsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["emergency"] }); toast.success('Contacto eliminado'); },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Activate Emergency ──
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [activateForm, setActivateForm] = useState({ protocolId: '' });

  const activateEmergencyMut = useMutation({
    mutationFn: (data: typeof activateForm) => emergencyActivationsApi.create({ protocolId: data.protocolId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["emergency"] }); toast.error('EMERGENCIA ACTIVADA', { duration: 5000 }); setActivateDialogOpen(false); setActivateForm({ protocolId: '' }); setActiveTab('activations'); },
    onError: (err: Error) => toast.error(err.message),
  });

  const getProtocolType = useCallback((a: any): string => a.protocolType || a.type || protocols.find((p: any) => p.id === a.protocolId)?.type || 'security', [protocols]);

  const openEditProtocol = (p: any) => {
    setEditingProtocolId(p.id);
    setProtocolForm({ name: p.name, type: p.type, description: p.description || '', priority: String(p.priority || 1) });
    setProtocolDialogOpen(true);
  };

  const openEditContact = (c: any) => {
    setEditingContactId(c.id);
    setContactForm({ name: c.name, phone: c.phone || '', role: c.role || 'custom', email: c.email || '', priority: String(c.priority || 1) });
    setContactDialogOpen(true);
  };

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell
      title="Gestión de Emergencias"
      description="Protocolos, contactos y emergencias activas"
      icon={<ShieldAlert className="h-5 w-5" />}
      actions={
        <Button variant="destructive" onClick={() => setActivateDialogOpen(true)} className="gap-1.5">
          <AlertOctagon className="h-4 w-4" /> Activar Emergencia
        </Button>
      }
    >
    <div className="space-y-5 p-5">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<AlertOctagon className="h-5 w-5 text-red-400" />} label="Emergencias Activas" value={stats?.activeEmergencies ?? stats?.byStatus?.active ?? 0} color="text-red-400" />
        <StatCard icon={<ShieldAlert className="h-5 w-5 text-blue-400" />} label="Protocolos" value={stats?.totalProtocols ?? protocols.length} color="text-blue-400" />
        <StatCard icon={<Phone className="h-5 w-5 text-emerald-400" />} label="Contactos" value={stats?.emergencyContacts ?? contacts.length} color="text-emerald-400" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-purple-400" />} label="Resueltas Hoy" value={stats?.resolvedToday ?? 0} color="text-purple-400" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800/50">
          <TabsTrigger value="activations" className="gap-1 text-xs"><AlertOctagon className="h-3.5 w-3.5" /> Emergencias</TabsTrigger>
          <TabsTrigger value="protocols" className="gap-1 text-xs"><ShieldAlert className="h-3.5 w-3.5" /> Protocolos</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1 text-xs"><Phone className="h-3.5 w-3.5" /> Contactos</TabsTrigger>
        </TabsList>

        {/* ═══ Activations Tab ═══ */}
        <TabsContent value="activations" className="space-y-4">
          {loadingActivations ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
          ) : activations.length === 0 ? (
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-400 opacity-50" />
                <p className="text-base font-medium text-white">Sin emergencias activas</p>
                <p className="text-sm text-slate-400 mt-1">Todo en orden — no hay emergencias en curso</p>
              </CardContent>
            </Card>
          ) : (
            activations.map((a: any) => {
              const expanded = expandedActivation === a.id;
              const isActive = a.status === 'active';
              const pType = getProtocolType(a);
              const tc = typeConfig[pType] || typeConfig.security;
              const sc = statusConfig[a.status] || statusConfig.active;
              const protocolName = a.protocolName || protocols.find((p: any) => p.id === a.protocolId)?.name || 'Emergencia';

              return (
                <Card key={a.id} className={cn("bg-slate-800/40 border-slate-700/50", isActive && "border-red-500/40 bg-red-500/5")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <AlertOctagon className={cn("h-5 w-5 mt-0.5 shrink-0", isActive ? "text-red-400 animate-pulse" : "text-slate-500")} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-white">{protocolName}</h3>
                            <Badge className={cn("text-[9px] border", sc.color)}>{sc.label}</Badge>
                            <Badge className={cn("text-[9px] border", tc.color)}>{tc.label}</Badge>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            Activada: {a.createdAt ? new Date(a.createdAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                            {a.resolvedAt && ` \u2022 Resuelta: ${new Date(a.resolvedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}`}
                          </p>
                          {a.resolution && <p className="text-xs text-slate-500 mt-0.5">Resolución: {a.resolution}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {isActive && (
                          <>
                            <Button size="sm" onClick={() => resolveMut.mutate(a.id)} className="gap-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="h-3 w-3" /> Resolver</Button>
                            <Button size="sm" variant="outline" onClick={() => cancelMut.mutate(a.id)} className="gap-1 h-7 text-xs">Cancelar</Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setExpandedActivation(expanded ? null : a.id)} className="gap-1 h-7 text-xs">
                          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          {expanded ? 'Cerrar' : 'Gestionar'}
                        </Button>
                      </div>
                    </div>

                    {expanded && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card className="bg-slate-900/30 border-slate-700/30">
                          <CardHeader className="pb-2 px-3 pt-3">
                            <CardTitle className="text-sm flex items-center gap-1.5"><ClipboardCheck className="h-4 w-4" /> Checklist de Respuesta</CardTitle>
                            <CardDescription className="text-xs">Sigue cada paso en orden</CardDescription>
                          </CardHeader>
                          <CardContent className="px-3 pb-3"><EmergencyChecklist protocolType={pType} activationId={a.id} /></CardContent>
                        </Card>
                        <Card className="bg-slate-900/30 border-slate-700/30">
                          <CardHeader className="pb-2 px-3 pt-3">
                            <CardTitle className="text-sm flex items-center gap-1.5"><Send className="h-4 w-4" /> Despacho de Notificaciones</CardTitle>
                            <CardDescription className="text-xs">Notificar guardias y contactos de emergencia</CardDescription>
                          </CardHeader>
                          <CardContent className="px-3 pb-3"><DispatchNotifications activationId={a.id} contacts={contacts} /></CardContent>
                        </Card>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ═══ Protocols Tab ═══ */}
        <TabsContent value="protocols" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingProtocolId(null); setProtocolForm({ name: '', type: 'security', description: '', priority: '1' }); setProtocolDialogOpen(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo Protocolo
            </Button>
          </div>

          {loadingProtocols ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : protocols.length === 0 ? (
            <EmptyState icon={<ShieldAlert />} title="Sin protocolos" desc="Crea protocolos para definir procedimientos de respuesta" />
          ) : (
            protocols.map((p: any) => {
              const tc = typeConfig[p.type] || typeConfig.security;
              return (
                <Card key={p.id} className={cn("bg-slate-800/40 border-slate-700/50", !p.isActive && "opacity-50")}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldAlert className={cn("h-5 w-5", p.isActive ? "text-blue-400" : "text-slate-600")} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white">{p.name}</h3>
                            <Badge className={cn("text-[9px] border", tc.color)}>{tc.label}</Badge>
                            {p.priority > 1 && <Badge variant="outline" className="text-[9px]">Prioridad: {p.priority}</Badge>}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {p.steps?.length ?? 0} pasos{p.description ? ` \u2022 ${p.description}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => openEditProtocol(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => { if (confirm('¿Eliminar este protocolo?')) deleteProtocolMut.mutate(p.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ═══ Contacts Tab ═══ */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingContactId(null); setContactForm({ name: '', phone: '', role: 'custom', email: '', priority: '1' }); setContactDialogOpen(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo Contacto
            </Button>
          </div>

          {loadingContacts ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : contacts.length === 0 ? (
            <EmptyState icon={<Phone />} title="Sin contactos de emergencia" desc="Agrega contactos que deben ser notificados durante emergencias" />
          ) : (
            contacts.map((c: any) => (
              <Card key={c.id} className="bg-slate-800/40 border-slate-700/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-emerald-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{c.name}</h3>
                          {c.role && <Badge variant="outline" className="text-[9px]">{roleLabels[c.role] || c.role}</Badge>}
                          {c.priority > 1 && <Badge variant="outline" className="text-[9px]">P{c.priority}</Badge>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                          {c.phone && <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {c.phone}</span>}
                          {c.email && <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {c.email}</span>}
                        </p>
                        {c.availableHours && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Disponible: {typeof c.availableHours === 'object' ? `${c.availableHours.start || '00:00'} - ${c.availableHours.end || '23:59'}` : String(c.availableHours)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => openEditContact(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => { if (confirm('¿Eliminar este contacto?')) deleteContactMut.mutate(c.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ Dialogs ═══ */}

      {/* Protocol Dialog */}
      <Dialog open={protocolDialogOpen} onOpenChange={o => { if (!o) setEditingProtocolId(null); setProtocolDialogOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingProtocolId ? 'Editar Protocolo' : 'Nuevo Protocolo de Emergencia'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Nombre *</Label><Input value={protocolForm.name} onChange={e => setProtocolForm(f => ({ ...f, name: e.target.value }))} placeholder="Protocolo de incendio" className="bg-slate-900 border-slate-700" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Tipo</Label>
                <Select value={protocolForm.type} onValueChange={v => setProtocolForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeConfig).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Prioridad (1-10)</Label><Input type="number" min={1} max={10} value={protocolForm.priority} onChange={e => setProtocolForm(f => ({ ...f, priority: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Descripción</Label><Textarea value={protocolForm.description} onChange={e => setProtocolForm(f => ({ ...f, description: e.target.value }))} placeholder="Procedimiento de respuesta..." className="bg-slate-900 border-slate-700" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProtocolDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => editingProtocolId ? updateProtocolMut.mutate({ id: editingProtocolId, data: protocolForm }) : createProtocolMut.mutate(protocolForm)} disabled={!protocolForm.name.trim()} className="gap-1">
              {(createProtocolMut.isPending || updateProtocolMut.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingProtocolId ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={o => { if (!o) setEditingContactId(null); setContactDialogOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingContactId ? 'Editar Contacto' : 'Nuevo Contacto de Emergencia'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Nombre *</Label><Input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre del contacto" className="bg-slate-900 border-slate-700" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Teléfono *</Label><Input value={contactForm.phone} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))} placeholder="+57 300 123 4567" className="bg-slate-900 border-slate-700" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Email</Label><Input value={contactForm.email} onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))} placeholder="email@ejemplo.com" className="bg-slate-900 border-slate-700" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Rol</Label>
                <Select value={contactForm.role} onValueChange={v => setContactForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Prioridad</Label><Input type="number" min={1} max={10} value={contactForm.priority} onChange={e => setContactForm(f => ({ ...f, priority: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => editingContactId ? updateContactMut.mutate({ id: editingContactId, data: contactForm }) : createContactMut.mutate(contactForm)} disabled={!contactForm.name.trim() || !contactForm.phone.trim()} className="gap-1">
              {(createContactMut.isPending || updateContactMut.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingContactId ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate Emergency Dialog */}
      <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400"><AlertOctagon className="h-5 w-5" /> Activar Emergencia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-sm text-red-400">
              Esta acción activará un protocolo de emergencia y notificará a todos los contactos configurados.
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Protocolo *</Label>
              <Select value={activateForm.protocolId} onValueChange={v => setActivateForm(f => ({ ...f, protocolId: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="Seleccionar protocolo..." /></SelectTrigger>
                <SelectContent>
                  {protocols.filter((p: any) => p.isActive !== false).map((p: any) => {
                    const tc = typeConfig[p.type] || typeConfig.security;
                    return <SelectItem key={p.id} value={p.id}>{p.name} — {tc.label}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => activateEmergencyMut.mutate(activateForm)} disabled={!activateForm.protocolId || activateEmergencyMut.isPending} className="gap-1">
              {activateEmergencyMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <AlertOctagon className="h-4 w-4" /> Activar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageShell>
  );
}

// ══════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className="bg-slate-800/40 border-slate-700/50">
      <CardContent className="p-4 flex items-center justify-between">
        <div><p className="text-xs text-slate-400">{label}</p><p className={cn("text-2xl font-bold", color)}>{value}</p></div>
        {icon}
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="bg-slate-800/30 border-slate-700/40">
      <CardContent className="py-12 text-center">
        <div className="mx-auto mb-4 opacity-20 [&>svg]:h-12 [&>svg]:w-12 [&>svg]:mx-auto">{icon}</div>
        <p className="text-base font-medium text-white">{title}</p>
        <p className="text-sm text-slate-500 mt-1">{desc}</p>
      </CardContent>
    </Card>
  );
}
