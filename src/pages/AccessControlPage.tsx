import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSections, useAccessPeople, useAccessPeopleMutations, useAccessVehicles, useAccessVehicleMutations, useAccessLogs } from '@/hooks/use-module-data';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  UserCheck, Users, Car, Search, Plus, FileText, Download, FileUp,
  Shield, Clock, Pencil, Trash2, MoreHorizontal, Eye, Key, Camera, ScanLine, CarFront, CheckCircle2, AlertCircle, CalendarClock,
  X, Phone, Mail, FileBarChart, ArrowDownUp, Bike, Truck
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import DataImportDialog from '@/components/shared/DataImportDialog';
import type { ImportEntityType } from '@/services/data-import-api';
import { PageShell } from '@/components/shared/PageShell';
import ErrorState from '@/components/ui/ErrorState';
import type { ApiAccessPerson, ApiAccessVehicle, ApiAccessLog, ApiSection, ApiLprDetection } from '@/types/api-entities';

// ══════════════════════════════════════════════════════════════
// Types & Constants
// ══════════════════════════════════════════════════════════════

interface AccessSchedule {
  id: string;
  name: string;
  type: 'allow' | 'deny';
  dayOfWeek: number[];
  startTime: string;
  endTime: string;
  applies_to: 'all' | 'visitors' | 'contractors' | 'staff';
  zone: string;
  active: boolean;
}

const SCHEDULES_KEY = 'aion-access-schedules';

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const EMPTY_SCHEDULE: Omit<AccessSchedule, 'id'> = {
  name: '', type: 'allow', dayOfWeek: [1, 2, 3, 4, 5],
  startTime: '08:00', endTime: '18:00', applies_to: 'all', zone: '', active: true,
};

const typeConfig: Record<string, { label: string; color: string }> = {
  resident: { label: 'Residente', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  visitor: { label: 'Visitante', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  staff: { label: 'Personal', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  provider: { label: 'Proveedor', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
};

const vehicleTypeIcon: Record<string, typeof Car> = {
  car: Car,
  motorcycle: Bike,
  truck: Truck,
  bicycle: Bike,
};

function loadSchedules(): AccessSchedule[] {
  try { return JSON.parse(localStorage.getItem(SCHEDULES_KEY) || '[]'); } catch { return []; }
}

function persistSchedules(schedules: AccessSchedule[]) {
  try { localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules)); } catch { /* noop */ }
}

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════

export default function AccessControlPage() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { data: rawSections = [] } = useSections();
  const sections = rawSections as ApiSection[];
  const { data: rawPeople = [], isLoading, isError, error, refetch } = useAccessPeople();
  const { data: rawVehicles = [] } = useAccessVehicles();
  const { data: rawLogs = [] } = useAccessLogs();
  const peopleMut = useAccessPeopleMutations();
  const vehicleMut = useAccessVehicleMutations();

  const people = rawPeople as ApiAccessPerson[];
  const vehicles = rawVehicles as ApiAccessVehicle[];
  const logs = rawLogs as ApiAccessLog[];

  const { data: lprDetections = [] } = useQuery({
    queryKey: ['lpr-detections'],
    queryFn: async () => {
      const resp = await apiClient.get<ApiLprDetection[] | { items?: ApiLprDetection[]; data?: ApiLprDetection[] }>('/lpr/detections', { limit: '20' });
      return Array.isArray(resp) ? resp : (resp?.items ?? resp?.data ?? []);
    },
    enabled: isAuthenticated,
    refetchInterval: 10000,
  });

  // ── State ──
  const [activeTab, setActiveTab] = useState('residents');
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState<ImportEntityType>('residents');
  const [form, setForm] = useState({ full_name: '', type: 'resident', section_id: '', unit: '', phone: '', email: '', document_id: '', notes: '' });
  const [vehicleForm, setVehicleForm] = useState({ plate: '', brand: '', model: '', color: '', type: 'car', person_id: '' });
  const [deletePersonId, setDeletePersonId] = useState<string | null>(null);
  const [editingPerson, setEditingPerson] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<string | null>(null);
  const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null);

  // Schedule state
  const [schedules, setSchedules] = useState<AccessSchedule[]>(() => loadSchedules());
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<AccessSchedule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState<Omit<AccessSchedule, 'id'>>(EMPTY_SCHEDULE);

  useEffect(() => { persistSchedules(schedules); }, [schedules]);

  // ── Computed ──
  const getSectionName = useCallback((id: string) => sections.find(s => s.id === id)?.name || '—', [sections]);

  const filtered = useMemo(() => {
    return people.filter((p) => {
      const q = search.toLowerCase();
      if (q && !(p.fullName || p.full_name || '').toLowerCase().includes(q) && !(p.unit || '').toLowerCase().includes(q) && !(p.phone || '').includes(q)) return false;
      const sid = p.sectionId || p.section_id;
      if (sectionFilter !== 'all' && sid !== sectionFilter) return false;
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      return true;
    });
  }, [people, search, sectionFilter, typeFilter]);

  const selected = useMemo(() => selectedPerson ? people.find((p) => p.id === selectedPerson) : null, [selectedPerson, people]);

  const personVehicles = useMemo(() => {
    if (!selected) return [];
    return vehicles.filter((v) => (v.personId || v.person_id) === selected.id);
  }, [selected, vehicles]);

  const personName = (p: ApiAccessPerson) => p.fullName || p.full_name || '—';
  const personSection = (p: ApiAccessPerson) => p.sectionId || p.section_id;
  const personDoc = (p: ApiAccessPerson) => p.documentId || p.document_id;

  // ── Stats ──
  const stats = useMemo(() => ({
    total: people.length,
    residents: people.filter((p) => p.type === 'resident').length,
    vehicles: vehicles.length,
    todayLogs: logs.filter((l) => {
      const d = new Date(String(l.createdAt || l.created_at));
      return d.toDateString() === new Date().toDateString();
    }).length,
  }), [people, vehicles, logs]);

  // ── Handlers ──
  const openAddPerson = () => {
    setEditingPerson(null);
    setForm({ full_name: '', type: 'resident', section_id: '', unit: '', phone: '', email: '', document_id: '', notes: '' });
    setPersonDialogOpen(true);
  };

  const openEditPerson = (p: ApiAccessPerson) => {
    setEditingPerson(p.id);
    setForm({
      full_name: personName(p), type: p.type || 'resident',
      section_id: personSection(p) || '', unit: p.unit || '',
      phone: p.phone || '', email: p.email || '',
      document_id: personDoc(p) || '', notes: p.notes || '',
    });
    setPersonDialogOpen(true);
  };

  const handleSavePerson = () => {
    if (!form.full_name.trim()) return;
    const payload = {
      full_name: form.full_name, type: form.type,
      section_id: form.section_id || undefined, unit: form.unit || undefined,
      phone: form.phone || undefined, email: form.email || undefined,
      document_id: form.document_id || undefined, notes: form.notes || undefined,
    };
    if (editingPerson) {
      peopleMut.update.mutate({ id: editingPerson, ...payload });
    } else {
      peopleMut.create.mutate(payload);
    }
    setPersonDialogOpen(false);
    setEditingPerson(null);
  };

  const openAddVehicle = (personId?: string) => {
    setEditingVehicle(null);
    setVehicleForm({ plate: '', brand: '', model: '', color: '', type: 'car', person_id: personId || '' });
    setVehicleDialogOpen(true);
  };

  const openEditVehicle = (v: ApiAccessVehicle) => {
    setEditingVehicle(v.id);
    setVehicleForm({
      plate: v.plate || '', brand: v.brand || '', model: v.model || '',
      color: v.color || '', type: v.type || 'car',
      person_id: v.personId || v.person_id || '',
    });
    setVehicleDialogOpen(true);
  };

  const handleSaveVehicle = () => {
    if (!vehicleForm.plate.trim()) return;
    if (editingVehicle) {
      vehicleMut.update.mutate({ id: editingVehicle, ...vehicleForm });
    } else {
      vehicleMut.create.mutate(vehicleForm);
    }
    setVehicleDialogOpen(false);
    setEditingVehicle(null);
  };

  const handleOpenGate = async (detectionId: string) => {
    try {
      await apiClient.post('/lpr/gate-action', { detectionId, action: 'open' });
      toast.success('Puerta abierta');
    } catch {
      toast.error('Error al abrir puerta');
    }
  };

  // Schedule handlers
  const openScheduleDialog = useCallback((schedule?: AccessSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setScheduleForm({ name: schedule.name, type: schedule.type, dayOfWeek: [...schedule.dayOfWeek], startTime: schedule.startTime, endTime: schedule.endTime, applies_to: schedule.applies_to, zone: schedule.zone, active: schedule.active });
    } else {
      setEditingSchedule(null);
      setScheduleForm({ ...EMPTY_SCHEDULE });
    }
    setScheduleDialogOpen(true);
  }, []);

  const saveSchedule = useCallback(() => {
    if (!scheduleForm.name.trim()) { toast.error('El nombre es requerido'); return; }
    if (editingSchedule) {
      setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? { ...scheduleForm, id: editingSchedule.id } : s));
      toast.success('Horario actualizado');
    } else {
      setSchedules(prev => [...prev, { ...scheduleForm, id: `sched-${Date.now()}` }]);
      toast.success('Horario creado');
    }
    setScheduleDialogOpen(false);
  }, [scheduleForm, editingSchedule]);

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell
      title="Control de Acceso"
      description="Personas, vehículos y registros de acceso"
      icon={<Shield className="h-5 w-5" />}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setImportType('residents'); setImportOpen(true); }} className="gap-1"><FileUp className="h-3 w-3" /> Importar</Button>
          <Button size="sm" onClick={openAddPerson} className="gap-1"><Plus className="h-3.5 w-3.5" /> Nueva Persona</Button>
        </div>
      }
    >
    <div className="flex flex-col lg:flex-row h-full">
      <div className={cn("flex-1 flex flex-col min-w-0 transition-all", selected && "lg:max-w-[58%]")}>

        {/* Stats */}
        <div className="px-4 py-3 border-b border-slate-700/50 flex gap-3 flex-wrap">
          <StatCard icon={<Users className="h-4 w-4 text-blue-400" />} label="Total Personas" value={stats.total} />
          <StatCard icon={<UserCheck className="h-4 w-4 text-emerald-400" />} label="Residentes" value={stats.residents} />
          <StatCard icon={<Car className="h-4 w-4 text-purple-400" />} label="Vehículos" value={stats.vehicles} />
          <StatCard icon={<Clock className="h-4 w-4 text-amber-400" />} label="Accesos hoy" value={stats.todayLogs} />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-4 pt-2 border-b border-slate-700/50 overflow-x-auto">
            <TabsList className="h-8 bg-slate-800/50">
              <TabsTrigger value="residents" className="text-xs gap-1"><Users className="h-3 w-3" /> Personas</TabsTrigger>
              <TabsTrigger value="vehicles" className="text-xs gap-1"><Car className="h-3 w-3" /> Vehículos</TabsTrigger>
              <TabsTrigger value="logs" className="text-xs gap-1"><Clock className="h-3 w-3" /> Registro</TabsTrigger>
              <TabsTrigger value="lpr_scanner" className="text-xs gap-1 text-blue-400 data-[state=active]:bg-blue-500/10"><ScanLine className="h-3 w-3" /> LPR</TabsTrigger>
              <TabsTrigger value="schedules" className="text-xs gap-1"><CalendarClock className="h-3 w-3" /> Horarios</TabsTrigger>
              <TabsTrigger value="reports" className="text-xs gap-1"><FileBarChart className="h-3 w-3" /> Reportes</TabsTrigger>
            </TabsList>
          </div>

          {/* Filters */}
          <div className="px-4 py-2 border-b border-slate-700/50 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input placeholder="Buscar por nombre, unidad o teléfono..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-slate-900/50 border-slate-700" />
            </div>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-40 h-8 text-xs bg-slate-900/50 border-slate-700"><SelectValue placeholder="Todas las sedes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sedes</SelectItem>
                {sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32 h-8 text-xs bg-slate-900/50 border-slate-700"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="resident">Residentes</SelectItem>
                <SelectItem value="visitor">Visitantes</SelectItem>
                <SelectItem value="staff">Personal</SelectItem>
                <SelectItem value="provider">Proveedores</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── People Tab ── */}
          <TabsContent value="residents" className="flex-1 overflow-auto m-0">
            {isLoading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={<Users />} message={people.length === 0 ? 'No hay personas registradas' : 'Sin resultados para el filtro actual'} action={people.length === 0 ? <Button size="sm" onClick={openAddPerson} className="gap-1"><Plus className="h-3.5 w-3.5" /> Agregar persona</Button> : <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTypeFilter('all'); setSectionFilter('all'); }}>Limpiar filtros</Button>} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700/50">
                    <TableHead className="text-xs">Nombre</TableHead>
                    <TableHead className="text-xs">Sede</TableHead>
                    <TableHead className="text-xs">Unidad</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Contacto</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p: any) => {
                    const tc = typeConfig[p.type] || typeConfig.resident;
                    return (
                      <TableRow
                        key={p.id}
                        className={cn("cursor-pointer border-slate-800 hover:bg-slate-800/50", selectedPerson === p.id && "bg-slate-800/70")}
                        onClick={() => setSelectedPerson(p.id)}
                      >
                        <TableCell className="font-medium text-sm text-white">{personName(p)}</TableCell>
                        <TableCell className="text-xs text-slate-400">{getSectionName(personSection(p))}</TableCell>
                        <TableCell className="text-xs text-slate-300">{p.unit || '—'}</TableCell>
                        <TableCell><Badge className={cn("text-[9px] border", tc.color)}>{tc.label}</Badge></TableCell>
                        <TableCell className="text-xs text-slate-400">
                          {p.phone && <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" /> {p.phone}</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'active' ? 'default' : p.status === 'blocked' ? 'destructive' : 'secondary'} className="text-[9px] capitalize">
                            {p.status === 'active' ? 'Activo' : p.status === 'blocked' ? 'Bloqueado' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedPerson(p.id)}><Eye className="mr-2 h-3 w-3" /> Ver detalle</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditPerson(p)}><Pencil className="mr-2 h-3 w-3" /> Editar</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeletePersonId(p.id)}><Trash2 className="mr-2 h-3 w-3" /> Eliminar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* ── Vehicles Tab ── */}
          <TabsContent value="vehicles" className="flex-1 overflow-auto m-0">
            <div className="px-4 py-2 border-b border-slate-700/50 flex justify-between items-center">
              <p className="text-xs text-slate-400">{vehicles.length} vehículos registrados</p>
              <Button size="sm" variant="outline" onClick={() => openAddVehicle()} className="gap-1 h-7 text-xs"><Plus className="h-3 w-3" /> Agregar</Button>
            </div>
            {vehicles.length === 0 ? (
              <EmptyState icon={<Car />} message="No hay vehículos registrados" action={<Button size="sm" onClick={() => openAddVehicle()} className="gap-1"><Plus className="h-3.5 w-3.5" /> Registrar vehículo</Button>} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700/50">
                    <TableHead className="text-xs">Placa</TableHead>
                    <TableHead className="text-xs">Marca / Modelo</TableHead>
                    <TableHead className="text-xs">Color</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Propietario</TableHead>
                    <TableHead className="text-xs">Estado</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((v: any) => {
                    const owner = people.find((p: any) => p.id === (v.personId || v.person_id));
                    return (
                      <TableRow key={v.id} className="border-slate-800">
                        <TableCell className="font-mono font-bold text-sm text-white">{v.plate}</TableCell>
                        <TableCell className="text-xs text-slate-300">{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</TableCell>
                        <TableCell className="text-xs">{v.color || '—'}</TableCell>
                        <TableCell className="text-xs capitalize">{v.type}</TableCell>
                        <TableCell className="text-xs text-slate-400">{owner ? personName(owner) : '—'}</TableCell>
                        <TableCell><Badge variant={v.status === 'active' ? 'default' : 'secondary'} className="text-[9px] capitalize">{v.status === 'active' ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditVehicle(v)}><Pencil className="mr-2 h-3 w-3" /> Editar</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteVehicleId(v.id)}><Trash2 className="mr-2 h-3 w-3" /> Eliminar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* ── Access Logs Tab ── */}
          <TabsContent value="logs" className="flex-1 overflow-auto m-0">
            {logs.length === 0 ? (
              <EmptyState icon={<Clock />} message="No hay registros de acceso" />
            ) : (
              <Table>
                <TableHeader><TableRow className="border-slate-700/50">
                  <TableHead className="text-xs">Fecha/Hora</TableHead>
                  <TableHead className="text-xs">Persona</TableHead>
                  <TableHead className="text-xs">Dirección</TableHead>
                  <TableHead className="text-xs">Método</TableHead>
                  <TableHead className="text-xs">Sede</TableHead>
                  <TableHead className="text-xs">Notas</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {logs.map((log: any) => {
                    const person = people.find((p: any) => p.id === (log.personId || log.person_id));
                    return (
                      <TableRow key={log.id} className="border-slate-800">
                        <TableCell className="text-xs font-mono text-slate-300">{new Date(log.createdAt || log.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                        <TableCell className="text-xs text-white">{person ? personName(person) : '—'}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-[9px]", log.direction === 'in' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30')}>
                            {log.direction === 'in' ? '→ Entrada' : '← Salida'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-400 capitalize">{log.method}</TableCell>
                        <TableCell className="text-xs text-slate-400">{getSectionName(log.sectionId || log.section_id)}</TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-[150px] truncate">{log.notes || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* ── LPR Tab ── */}
          <TabsContent value="lpr_scanner" className="flex-1 overflow-auto m-0 p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
              {/* Camera Feed */}
              <Card className="flex flex-col border-blue-500/20 overflow-hidden bg-slate-900/50">
                <CardHeader className="py-2.5 px-4 border-b border-slate-700/50 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
                    <Camera className="h-4 w-4" /> Cámara LPR - Entrada
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>
                    <span className="text-[10px] text-slate-500 font-mono">EN VIVO / OCR ACTIVO</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-[280px]">
                  <ScanLine className="absolute h-full w-full text-blue-500/15 animate-pulse pointer-events-none p-16" />
                  <div className="w-[75%] h-[55%] border-2 border-dashed border-blue-500/40 relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-400 -translate-x-1 -translate-y-1"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-400 translate-x-1 -translate-y-1"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-400 -translate-x-1 translate-y-1"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-400 translate-x-1 translate-y-1"></div>
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 flex justify-between font-mono text-[9px] text-blue-500/60">
                    <span>RECONOCIMIENTO OPTICO...</span>
                    <span>CONFIANZA: 98.8%</span>
                  </div>
                </CardContent>
              </Card>

              {/* Detections */}
              <Card className="flex flex-col max-h-[500px] bg-slate-900/30">
                <CardHeader className="py-2.5 px-4 border-b border-slate-700/50">
                  <CardTitle className="text-xs font-bold flex items-center gap-2"><CarFront className="h-4 w-4 text-slate-400" /> Detecciones de Placas</CardTitle>
                </CardHeader>
                <CardContent className="p-3 overflow-y-auto space-y-2">
                  {(lprDetections as ApiLprDetection[]).length === 0 ? (
                    <EmptyState icon={<ScanLine />} message="Sin detecciones. Configure cámaras LPR para comenzar." compact />
                  ) : (
                    (lprDetections as ApiLprDetection[]).map((det) => {
                      const isAuth = det.status === 'authorized' || det.authorized;
                      const isUnknown = det.status === 'unknown' || (!det.authorized && !det.person_name);
                      const elapsed = det.detected_at ? `${Math.round((Date.now() - new Date(det.detected_at).getTime()) / 1000)}s` : '';
                      return (
                        <div key={det.id} className={cn('flex items-center justify-between p-2.5 rounded-lg border', isAuth && 'border-emerald-500/30 bg-emerald-500/5', isUnknown && 'border-red-500/30 bg-red-500/5', !isAuth && !isUnknown && 'bg-slate-800/30 border-slate-700/30 opacity-60')}>
                          {isUnknown && <div className="absolute left-0 top-0 w-1 h-full bg-red-500 animate-pulse rounded-l" />}
                          <div className="flex gap-3 items-center">
                            <div className={cn('h-9 w-20 rounded border-2 border-black flex items-center justify-center', isUnknown ? 'bg-yellow-400' : 'bg-white')}>
                              <span className="text-black font-extrabold font-mono tracking-widest text-xs">{det.plate}</span>
                            </div>
                            <div>
                              {isAuth ? <p className="text-xs font-bold text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> AUTORIZADO</p>
                               : isUnknown ? <p className="text-xs font-bold text-red-400 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> DESCONOCIDO</p>
                               : <p className="text-xs font-bold text-slate-400">{(det.status || 'detectado').toUpperCase()}</p>}
                              <p className="text-[10px] text-slate-500">{det.person_name ? `${det.person_type || 'Residente'}: ${det.person_name}` : 'Sin registros'}{det.zone ? ` \u2022 ${det.zone}` : ''}</p>
                            </div>
                          </div>
                          {isUnknown ? <Button size="sm" variant="destructive" className="h-6 text-[10px]" onClick={() => handleOpenGate(det.id)}>Abrir</Button> : <span className="text-[10px] text-slate-500 font-mono">{elapsed}</span>}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Schedules Tab ── */}
          <TabsContent value="schedules" className="flex-1 overflow-auto m-0">
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2"><CalendarClock className="h-4 w-4 text-blue-400" /> Horarios de Acceso</h2>
                <p className="text-xs text-slate-500">Reglas de acceso basadas en horarios y zonas</p>
              </div>
              <Button size="sm" onClick={() => openScheduleDialog()} className="gap-1"><Plus className="h-3 w-3" /> Nuevo Horario</Button>
            </div>
            {schedules.length === 0 ? (
              <EmptyState icon={<CalendarClock />} message="No hay horarios de acceso definidos" action={<Button size="sm" onClick={() => openScheduleDialog()} className="gap-1"><Plus className="h-3.5 w-3.5" /> Crear primer horario</Button>} />
            ) : (
              <Table>
                <TableHeader><TableRow className="border-slate-700/50">
                  <TableHead className="text-xs">Nombre</TableHead><TableHead className="text-xs">Tipo</TableHead><TableHead className="text-xs">Días</TableHead><TableHead className="text-xs">Horario</TableHead><TableHead className="text-xs">Aplica a</TableHead><TableHead className="text-xs">Zona</TableHead><TableHead className="text-xs">Activo</TableHead><TableHead className="w-10"></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {schedules.map(s => (
                    <TableRow key={s.id} className={cn("border-slate-800", !s.active && 'opacity-40')}>
                      <TableCell className="font-medium text-sm text-white">{s.name}</TableCell>
                      <TableCell><Badge variant={s.type === 'allow' ? 'default' : 'destructive'} className="text-[9px]">{s.type === 'allow' ? 'Permitir' : 'Denegar'}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">{DAY_LABELS.map((d, i) => (
                          <span key={i} className={cn('w-5 h-5 rounded text-[9px] flex items-center justify-center font-medium', s.dayOfWeek.includes(i) ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-600')}>{d}</span>
                        ))}</div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-300">{s.startTime} - {s.endTime}</TableCell>
                      <TableCell className="text-xs capitalize text-slate-400">{s.applies_to === 'all' ? 'Todos' : s.applies_to}</TableCell>
                      <TableCell className="text-xs text-slate-400">{s.zone || '—'}</TableCell>
                      <TableCell><Switch checked={s.active} onCheckedChange={() => setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, active: !x.active } : x))} className="h-4 w-8" /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openScheduleDialog(s)}><Pencil className="mr-2 h-3 w-3" /> Editar</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm(s.id)}><Trash2 className="mr-2 h-3 w-3" /> Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* ── Reports Tab ── */}
          <TabsContent value="reports" className="flex-1 overflow-auto m-0 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'daily', label: 'Reporte Diario', desc: 'Todos los accesos del día de hoy' },
                { key: 'weekly', label: 'Reporte Semanal', desc: 'Resumen de accesos de la semana' },
                { key: 'biweekly', label: 'Reporte Quincenal', desc: 'Estadísticas de los últimos 15 días' },
                { key: 'monthly', label: 'Reporte Mensual', desc: 'Informe completo del mes' },
              ].map(r => (
                <Card key={r.key} className="bg-slate-800/30 border-slate-700/40">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{r.label}</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-xs text-slate-500 mb-3">{r.desc}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => toast.success(`Generando ${r.label} CSV...`)}><Download className="h-3 w-3" /> CSV</Button>
                      <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => toast.success(`Generando ${r.label} Excel...`)}><FileText className="h-3 w-3" /> Excel</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Detail Panel ── */}
      {selected && (
        <div className="lg:w-[42%] border-t lg:border-t-0 lg:border-l border-slate-700/50 overflow-auto bg-slate-900/30 p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-bold text-lg text-white">{personName(selected)}</h2>
              <p className="text-xs text-slate-400">{selected.unit || '—'} &bull; {getSectionName(personSection(selected))}</p>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant={selected.status === 'active' ? 'default' : selected.status === 'blocked' ? 'destructive' : 'secondary'} className="capitalize text-xs">
                {selected.status === 'active' ? 'Activo' : selected.status === 'blocked' ? 'Bloqueado' : 'Inactivo'}
              </Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => setSelectedPerson(null)}><X className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          {/* Contact Info */}
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-2 px-3 pt-3"><CardTitle className="text-sm">Información de Contacto</CardTitle></CardHeader>
            <CardContent className="px-3 pb-3 space-y-1.5 text-sm">
              <InfoRow icon={<Phone className="h-3 w-3" />} label="Teléfono" value={selected.phone || '—'} />
              <InfoRow icon={<Mail className="h-3 w-3" />} label="Email" value={selected.email || '—'} />
              <InfoRow icon={<FileText className="h-3 w-3" />} label="Documento" value={personDoc(selected) || '—'} />
              <InfoRow icon={<Shield className="h-3 w-3" />} label="Tipo" value={<Badge className={cn("text-[9px] border", (typeConfig[selected.type] || typeConfig.resident).color)}>{(typeConfig[selected.type] || typeConfig.resident).label}</Badge>} />
            </CardContent>
          </Card>

          {/* Vehicles */}
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardHeader className="pb-2 px-3 pt-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5"><Car className="h-4 w-4 text-purple-400" /> Vehículos ({personVehicles.length})</CardTitle>
              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => openAddVehicle(selected.id)}><Plus className="h-3 w-3" /> Agregar</Button>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {personVehicles.length > 0 ? (
                <div className="space-y-1.5">
                  {personVehicles.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-2 rounded-md bg-slate-900/40">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-16 rounded bg-yellow-400 flex items-center justify-center border border-black">
                          <span className="text-black font-bold font-mono text-[10px] tracking-wider">{v.plate}</span>
                        </div>
                        <div>
                          <p className="text-xs text-slate-300">{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</p>
                          <p className="text-[10px] text-slate-500">{v.color || ''} {v.type}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditVehicle(v)}><Pencil className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-500 text-center py-3">Sin vehículos registrados</p>}
            </CardContent>
          </Card>

          {/* Notes */}
          {selected.notes && (
            <Card className="bg-slate-800/30 border-slate-700/40">
              <CardHeader className="pb-2 px-3 pt-3"><CardTitle className="text-sm">Notas</CardTitle></CardHeader>
              <CardContent className="px-3 pb-3 text-sm text-slate-400">{selected.notes}</CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1" onClick={() => openEditPerson(selected)}><Pencil className="h-3 w-3" /> Editar</Button>
            <Button variant="outline" className="text-destructive gap-1" onClick={() => setDeletePersonId(selected.id)}><Trash2 className="h-3 w-3" /> Eliminar</Button>
          </div>
        </div>
      )}

      {/* ══════════ Dialogs ══════════ */}

      {/* Person Dialog */}
      <Dialog open={personDialogOpen} onOpenChange={(open) => { setPersonDialogOpen(open); if (!open) setEditingPerson(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>{editingPerson ? 'Editar Persona' : 'Nueva Persona'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs text-slate-400">Nombre completo *</Label><Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Juan Carlos Pérez" className="bg-slate-900 border-slate-700" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs text-slate-400">Unidad</Label><Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="Apto 301" className="bg-slate-900 border-slate-700" /></div>
              <div className="space-y-1"><Label className="text-xs text-slate-400">Teléfono</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="3001234567" className="bg-slate-900 border-slate-700" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs text-slate-400">Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="resident">Residente</SelectItem><SelectItem value="visitor">Visitante</SelectItem><SelectItem value="staff">Personal</SelectItem><SelectItem value="provider">Proveedor</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs text-slate-400">Sede</Label>
                <Select value={form.section_id} onValueChange={v => setForm(p => ({ ...p, section_id: v }))}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{sections.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs text-slate-400">Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@ejemplo.com" type="email" className="bg-slate-900 border-slate-700" /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-400">Documento de identidad</Label><Input value={form.document_id} onChange={e => setForm(p => ({ ...p, document_id: e.target.value }))} placeholder="CC 1234567890" className="bg-slate-900 border-slate-700" /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-400">Notas</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPersonDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePerson} disabled={!form.full_name.trim() || peopleMut.create.isPending || peopleMut.update.isPending}>{editingPerson ? 'Actualizar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Dialog */}
      <Dialog open={vehicleDialogOpen} onOpenChange={(open) => { setVehicleDialogOpen(open); if (!open) setEditingVehicle(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>{editingVehicle ? 'Editar Vehículo' : 'Nuevo Vehículo'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs text-slate-400">Placa *</Label><Input value={vehicleForm.plate} onChange={e => setVehicleForm(p => ({ ...p, plate: e.target.value.toUpperCase() }))} placeholder="ABC123" className="bg-slate-900 border-slate-700 font-mono text-lg tracking-widest" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs text-slate-400">Marca</Label><Input value={vehicleForm.brand} onChange={e => setVehicleForm(p => ({ ...p, brand: e.target.value }))} placeholder="Renault" className="bg-slate-900 border-slate-700" /></div>
              <div className="space-y-1"><Label className="text-xs text-slate-400">Modelo</Label><Input value={vehicleForm.model} onChange={e => setVehicleForm(p => ({ ...p, model: e.target.value }))} placeholder="Sandero 2024" className="bg-slate-900 border-slate-700" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs text-slate-400">Color</Label><Input value={vehicleForm.color} onChange={e => setVehicleForm(p => ({ ...p, color: e.target.value }))} placeholder="Blanco" className="bg-slate-900 border-slate-700" /></div>
              <div className="space-y-1"><Label className="text-xs text-slate-400">Tipo</Label>
                <Select value={vehicleForm.type} onValueChange={v => setVehicleForm(p => ({ ...p, type: v }))}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="car">Auto</SelectItem><SelectItem value="motorcycle">Moto</SelectItem><SelectItem value="truck">Camión</SelectItem><SelectItem value="bicycle">Bicicleta</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {!vehicleForm.person_id && (
              <div className="space-y-1"><Label className="text-xs text-slate-400">Propietario</Label>
                <Select value={vehicleForm.person_id} onValueChange={v => setVehicleForm(p => ({ ...p, person_id: v }))}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="Seleccionar persona" /></SelectTrigger>
                  <SelectContent>{people.map((p: any) => <SelectItem key={p.id} value={p.id}>{personName(p)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVehicleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveVehicle} disabled={!vehicleForm.plate.trim()}>{editingVehicle ? 'Actualizar' : 'Registrar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DataImportDialog open={importOpen} onOpenChange={setImportOpen} entityType={importType} onImportComplete={() => refetch()} />

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingSchedule ? 'Editar Horario' : 'Nuevo Horario de Acceso'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs text-slate-400">Nombre *</Label><Input value={scheduleForm.name} onChange={e => setScheduleForm(p => ({ ...p, name: e.target.value }))} placeholder="Horario laboral" className="bg-slate-900 border-slate-700" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs text-slate-400">Tipo</Label>
                <Select value={scheduleForm.type} onValueChange={(v: 'allow' | 'deny') => setScheduleForm(p => ({ ...p, type: v }))}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="allow">Permitir</SelectItem><SelectItem value="deny">Denegar</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs text-slate-400">Aplica a</Label>
                <Select value={scheduleForm.applies_to} onValueChange={(v: any) => setScheduleForm(p => ({ ...p, applies_to: v }))}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="visitors">Visitantes</SelectItem><SelectItem value="contractors">Contratistas</SelectItem><SelectItem value="staff">Personal</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Días de la semana</Label>
              <div className="flex gap-1">{DAY_NAMES.map((d, i) => (
                <button key={i} type="button" onClick={() => setScheduleForm(prev => ({ ...prev, dayOfWeek: prev.dayOfWeek.includes(i) ? prev.dayOfWeek.filter(x => x !== i) : [...prev.dayOfWeek, i].sort() }))}
                  className={cn('w-9 h-9 rounded-md text-xs font-medium transition-colors border', scheduleForm.dayOfWeek.includes(i) ? 'bg-blue-500 text-white border-blue-600' : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700')}>
                  {d}
                </button>
              ))}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs text-slate-400">Hora inicio</Label><Input type="time" value={scheduleForm.startTime} onChange={e => setScheduleForm(p => ({ ...p, startTime: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
              <div className="space-y-1"><Label className="text-xs text-slate-400">Hora fin</Label><Input type="time" value={scheduleForm.endTime} onChange={e => setScheduleForm(p => ({ ...p, endTime: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs text-slate-400">Zona</Label><Input value={scheduleForm.zone} onChange={e => setScheduleForm(p => ({ ...p, zone: e.target.value }))} placeholder="Entrada principal, Parqueadero..." className="bg-slate-900 border-slate-700" /></div>
            <div className="flex items-center gap-2"><Switch checked={scheduleForm.active} onCheckedChange={active => setScheduleForm(p => ({ ...p, active }))} className="h-4 w-8" /><Label className="text-xs text-slate-400 cursor-pointer">Activo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveSchedule} disabled={!scheduleForm.name.trim()}>{editingSchedule ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmations */}
      <ConfirmDelete open={!!deletePersonId} onCancel={() => setDeletePersonId(null)} onConfirm={() => { if (deletePersonId) { peopleMut.remove.mutate(deletePersonId); if (selectedPerson === deletePersonId) setSelectedPerson(null); setDeletePersonId(null); } }} title="Eliminar Persona" desc="Se eliminará esta persona y sus vehículos asociados. Esta acción no se puede deshacer." />
      <ConfirmDelete open={!!deleteVehicleId} onCancel={() => setDeleteVehicleId(null)} onConfirm={() => { if (deleteVehicleId) { vehicleMut.remove.mutate(deleteVehicleId); setDeleteVehicleId(null); } }} title="Eliminar Vehículo" desc="Se eliminará este vehículo del sistema." />
      <ConfirmDelete open={!!deleteConfirm} onCancel={() => setDeleteConfirm(null)} onConfirm={() => { if (deleteConfirm) { setSchedules(prev => prev.filter(s => s.id !== deleteConfirm)); setDeleteConfirm(null); toast.success('Horario eliminado'); } }} title="Eliminar Horario" desc="Se eliminará esta regla de horario de acceso." />
    </div>
    </PageShell>
  );
}

// ══════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/30">
      {icon}
      <div>
        <p className="text-lg font-bold text-white leading-none">{value}</p>
        <p className="text-[10px] text-slate-500">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, message, action, compact }: { icon: React.ReactNode; message: string; action?: React.ReactNode; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-slate-500", compact ? 'py-8' : 'h-52')}>
      <div className="opacity-20 mb-2 [&>svg]:h-10 [&>svg]:w-10">{icon}</div>
      <p className="text-sm text-center">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500 text-xs flex items-center gap-1.5">{icon} {label}</span>
      <span className="text-white text-xs">{value}</span>
    </div>
  );
}

function ConfirmDelete({ open, onCancel, onConfirm, title, desc }: { open: boolean; onCancel: () => void; onConfirm: () => void; title: string; desc: string }) {
  return (
    <AlertDialog open={open} onOpenChange={o => { if (!o) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{desc}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
