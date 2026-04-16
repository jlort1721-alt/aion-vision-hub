import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ErrorState from '@/components/ui/ErrorState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  ShieldCheck, Plus, FileText, Clock, CheckCircle2, Search, MoreHorizontal, Pencil, Trash2, Eye,
  AlertTriangle, TrendingUp, Upload, Download, CalendarDays, ChevronLeft, ChevronRight, Loader2,
  FileImage, File, Archive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { complianceTemplatesApi, retentionPoliciesApi, complianceStatsApi } from '@/services/compliance-api';
import { evidenceApi } from '@/services/evidence-api';
import { PageShell } from '@/components/shared/PageShell';

// ══════════════════════════════════════════════════════════════
// Constants — Spanish labels
// ══════════════════════════════════════════════════════════════

const templateTypeLabels: Record<string, string> = {
  habeas_data: 'Habeas Data', consent_form: 'Formulario de Consentimiento', privacy_policy: 'Política de Privacidad',
  data_retention: 'Retención de Datos', incident_report: 'Reporte de Incidente', data_breach_notification: 'Notificación de Brecha',
};
const templateTypeColor: Record<string, string> = {
  habeas_data: 'bg-blue-500/10 text-blue-400 border-blue-500/30', consent_form: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  privacy_policy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', data_retention: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  incident_report: 'bg-red-500/10 text-red-400 border-red-500/30', data_breach_notification: 'bg-red-600/10 text-red-500 border-red-600/30',
};

const retentionDataTypeLabels: Record<string, string> = {
  video_footage: 'Grabaciones de Video', event_logs: 'Logs de Eventos', access_logs: 'Logs de Acceso',
  visitor_records: 'Registros de Visitantes', audit_logs: 'Logs de Auditoría', personal_data: 'Datos Personales',
};
const actionLabels: Record<string, string> = { delete: 'Eliminar', archive: 'Archivar', anonymize: 'Anonimizar' };
const actionColors: Record<string, string> = {
  delete: 'bg-red-500/10 text-red-400 border-red-500/30', archive: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  anonymize: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
};

const auditStatusConfig: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Programada', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  completed: { label: 'Completada', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  overdue: { label: 'Vencida', color: 'bg-red-500/10 text-red-400 border-red-500/30' },
};

// ── Form defaults ──
const defaultTemplateForm = { name: '', type: 'privacy_policy', content: '', version: 1, isActive: true };
const defaultRetentionForm = { name: '', dataType: 'video_footage', retentionDays: 365, action: 'delete', isActive: true };
const defaultAuditForm = { date: '', templateName: '', auditor: '' };

// ── LocalStorage types/helpers ──
interface AuditSchedule { id: string; date: string; templateName: string; auditor: string; status: 'scheduled' | 'completed' | 'overdue'; }
interface EvidenceItem { id: string; fileName: string; uploadDate: string; uploader: string; linkedTemplate: string; notes: string; }

const AUDIT_KEY = 'aion_compliance_audits';
const EVIDENCE_KEY = 'aion_compliance_evidence_items';
function loadAudits(): AuditSchedule[] { try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch { return []; } }
function saveAudits(a: AuditSchedule[]) { localStorage.setItem(AUDIT_KEY, JSON.stringify(a)); }
function loadEvidence(): EvidenceItem[] { try { return JSON.parse(localStorage.getItem(EVIDENCE_KEY) || '[]'); } catch { return []; } }
function saveEvidence(e: EvidenceItem[]) { localStorage.setItem(EVIDENCE_KEY, JSON.stringify(e)); }

function getMonthDates(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const weeks: (Date | null)[][] = [];
  let current = 0;
  for (let w = 0; current <= last.getDate(); w++) {
    const week: (Date | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const dayNum = w * 7 + d - startPad + 1;
      if (dayNum < 1 || dayNum > last.getDate()) week.push(null);
      else { week.push(new Date(year, month, dayNum)); current = dayNum; }
    }
    weeks.push(week);
    if (current >= last.getDate()) break;
  }
  return weeks;
}

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ══════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════

export default function CompliancePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('templates');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dataTypeFilter, setDataTypeFilter] = useState('all');

  // Dialogs
  const [showTplDialog, setShowTplDialog] = useState(false);
  const [editingTpl, setEditingTpl] = useState<any>(null);
  const [showRetDialog, setShowRetDialog] = useState(false);
  const [editingRet, setEditingRet] = useState<any>(null);
  const [showPreview, setShowPreview] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'template' | 'retention'; id: string; label: string } | null>(null);

  // Forms
  const [tplForm, setTplForm] = useState({ ...defaultTemplateForm });
  const [retForm, setRetForm] = useState({ ...defaultRetentionForm });

  // Evidence
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>(() => loadEvidence());
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [evidenceTemplate, setEvidenceTemplate] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audit calendar
  const [audits, setAudits] = useState<AuditSchedule[]>(() => loadAudits());
  const [auditMonth, setAuditMonth] = useState(new Date().getMonth());
  const [auditYear, setAuditYear] = useState(new Date().getFullYear());
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [auditForm, setAuditForm] = useState({ ...defaultAuditForm });

  // Auto-mark overdue
  useEffect(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    let changed = false;
    const updated = audits.map(a => {
      if (a.status === 'scheduled' && new Date(a.date) < now) { changed = true; return { ...a, status: 'overdue' as const }; }
      return a;
    });
    if (changed) { setAudits(updated); saveAudits(updated); }
  }, [audits]);

  // ── Queries ──
  const { data: templates, isLoading: loadingTpl, isError, error, refetch } = useQuery({
    queryKey: ['compliance-templates', typeFilter],
    queryFn: () => complianceTemplatesApi.list({ ...(typeFilter !== 'all' && { type: typeFilter }) }),
  });
  const { data: policies, isLoading: loadingRet } = useQuery({
    queryKey: ['retention-policies', dataTypeFilter],
    queryFn: () => retentionPoliciesApi.list({ ...(dataTypeFilter !== 'all' && { dataType: dataTypeFilter }) }),
  });
  const { data: statsResult } = useQuery({ queryKey: ['compliance-stats'], queryFn: () => complianceStatsApi.get() });

  const templatesEnvelope = templates as Record<string, unknown> | undefined;
  const policiesEnvelope = policies as Record<string, unknown> | undefined;
  const statsResultEnvelope = statsResult as Record<string, unknown> | undefined;

  const tplList: Record<string, unknown>[] = (templatesEnvelope?.data as Record<string, unknown>[] | undefined) ?? [];
  const retList: Record<string, unknown>[] = (policiesEnvelope?.data as Record<string, unknown>[] | undefined) ?? [];
  const s: Record<string, unknown> | undefined = (statsResultEnvelope?.data as Record<string, unknown> | undefined) ?? statsResultEnvelope;

  // ── Mutations (Templates) ──
  const createTplMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => complianceTemplatesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-templates'] }); qc.invalidateQueries({ queryKey: ['compliance-stats'] }); closeTplDialog(); toast.success('Plantilla creada'); },
    onError: (err: Error) => toast.error(err.message),
  });
  const updateTplMut = useMutation({
    mutationFn: ({ id, ...data }: any) => complianceTemplatesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-templates'] }); qc.invalidateQueries({ queryKey: ['compliance-stats'] }); closeTplDialog(); toast.success('Plantilla actualizada'); },
    onError: (err: Error) => toast.error(err.message),
  });
  const approveTplMut = useMutation({
    mutationFn: (id: string) => complianceTemplatesApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-templates'] }); qc.invalidateQueries({ queryKey: ['compliance-stats'] }); toast.success('Plantilla aprobada'); },
    onError: (err: Error) => toast.error(err.message),
  });
  const deleteTplMut = useMutation({
    mutationFn: (id: string) => complianceTemplatesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-templates'] }); qc.invalidateQueries({ queryKey: ['compliance-stats'] }); setDeleteTarget(null); toast.success('Plantilla eliminada'); },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Mutations (Retention) ──
  const createRetMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => retentionPoliciesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['retention-policies'] }); qc.invalidateQueries({ queryKey: ['compliance-stats'] }); closeRetDialog(); toast.success('Política creada'); },
    onError: (err: Error) => toast.error(err.message),
  });
  const updateRetMut = useMutation({
    mutationFn: ({ id, ...data }: any) => retentionPoliciesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['retention-policies'] }); qc.invalidateQueries({ queryKey: ['compliance-stats'] }); closeRetDialog(); toast.success('Política actualizada'); },
    onError: (err: Error) => toast.error(err.message),
  });
  const deleteRetMut = useMutation({
    mutationFn: (id: string) => retentionPoliciesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['retention-policies'] }); qc.invalidateQueries({ queryKey: ['compliance-stats'] }); setDeleteTarget(null); toast.success('Política eliminada'); },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Dialog helpers ──
  const openCreateTpl = () => { setEditingTpl(null); setTplForm({ ...defaultTemplateForm }); setShowTplDialog(true); };
  const openEditTpl = (t: any) => { setEditingTpl(t); setTplForm({ name: t.name, type: t.type, content: t.content || '', version: t.version || 1, isActive: t.isActive ?? true }); setShowTplDialog(true); };
  const closeTplDialog = () => { setShowTplDialog(false); setEditingTpl(null); };
  const handleTplSubmit = () => { if (editingTpl) updateTplMut.mutate({ id: editingTpl.id, ...tplForm }); else createTplMut.mutate(tplForm); };

  const openCreateRet = () => { setEditingRet(null); setRetForm({ ...defaultRetentionForm }); setShowRetDialog(true); };
  const openEditRet = (r: any) => { setEditingRet(r); setRetForm({ name: r.name, dataType: r.dataType, retentionDays: r.retentionDays, action: r.action || 'delete', isActive: r.isActive ?? true }); setShowRetDialog(true); };
  const closeRetDialog = () => { setShowRetDialog(false); setEditingRet(null); };
  const handleRetSubmit = () => { if (editingRet) updateRetMut.mutate({ id: editingRet.id, ...retForm }); else createRetMut.mutate(retForm); };

  // ── Evidence upload ──
  const handleEvidenceUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setEvidenceUploading(true);
    for (const file of Array.from(files)) {
      try {
        await evidenceApi.create({ incident_id: 'compliance-evidence', type: 'document', file_name: file.name, mime_type: file.type, description: evidenceNotes || `Evidencia: ${file.name}` });
        const item: EvidenceItem = { id: crypto.randomUUID(), fileName: file.name, uploadDate: new Date().toISOString(), uploader: 'Operador', linkedTemplate: evidenceTemplate, notes: evidenceNotes };
        setEvidenceItems(prev => { const updated = [item, ...prev]; saveEvidence(updated); return updated; });
        toast.success(`${file.name} subido`);
      } catch { toast.error(`Error subiendo ${file.name}`); }
    }
    setEvidenceUploading(false);
    setEvidenceNotes('');
    setEvidenceTemplate('');
  }, [evidenceNotes, evidenceTemplate]);

  // ── Audit helpers ──
  const saveAudit = useCallback(() => {
    if (!auditForm.date || !auditForm.templateName || !auditForm.auditor) { toast.error('Completa todos los campos'); return; }
    const newAudit: AuditSchedule = { id: `audit-${Date.now()}`, ...auditForm, status: 'scheduled' };
    setAudits(prev => { const u = [...prev, newAudit]; saveAudits(u); return u; });
    setShowAuditDialog(false);
    setAuditForm({ ...defaultAuditForm });
    toast.success('Auditoría programada');
  }, [auditForm]);

  const toggleAuditComplete = useCallback((id: string) => {
    setAudits(prev => {
      const u = prev.map(a => a.id === id ? { ...a, status: (a.status === 'completed' ? 'scheduled' : 'completed') as AuditSchedule['status'] } : a);
      saveAudits(u); return u;
    });
  }, []);

  const deleteAudit = useCallback((id: string) => {
    setAudits(prev => { const u = prev.filter(a => a.id !== id); saveAudits(u); return u; });
    toast.success('Auditoría eliminada');
  }, []);

  // ── Filtered data ──
  const filteredTpl = useMemo(() => {
    if (!search) return tplList;
    const q = search.toLowerCase();
    return tplList.filter((t: any) => t.name?.toLowerCase().includes(q) || t.type?.toLowerCase().includes(q));
  }, [tplList, search]);

  const filteredRet = useMemo(() => {
    if (!search) return retList;
    const q = search.toLowerCase();
    return retList.filter((r: any) => r.name?.toLowerCase().includes(q) || r.dataType?.toLowerCase().includes(q));
  }, [retList, search]);

  // ── Stats computed ──
  const complianceRate = useMemo(() => {
    const total = s?.totalTemplates ?? 0;
    const approved = s?.approvedTemplates ?? 0;
    if (total === 0) return 0;
    return Math.round((approved / total) * 100);
  }, [s]);

  const monthDates = useMemo(() => getMonthDates(auditYear, auditMonth), [auditYear, auditMonth]);
  const monthLabel = new Date(auditYear, auditMonth).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell title="Cumplimiento" description="Plantillas, políticas de retención y evidencia" icon={<ShieldCheck className="h-5 w-5" />}>
    <div className="p-5 space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={<FileText className="h-5 w-5 text-blue-400" />} label="Plantillas" value={s?.totalTemplates ?? 0} color="text-blue-400" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />} label="Aprobadas" value={s?.approvedTemplates ?? 0} color="text-emerald-400" />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-amber-400" />} label="Pendientes" value={s?.pendingTemplates ?? 0} color="text-amber-400" />
        <StatCard icon={<Archive className="h-5 w-5 text-purple-400" />} label="Políticas Retención" value={s?.totalPolicies ?? 0} color="text-purple-400" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Cumplimiento" value={`${complianceRate}%`} color={complianceRate >= 80 ? 'text-emerald-400' : complianceRate >= 50 ? 'text-amber-400' : 'text-red-400'} isText />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-800/50">
          <TabsTrigger value="templates" className="gap-1 text-xs"><FileText className="h-3.5 w-3.5" /> Plantillas</TabsTrigger>
          <TabsTrigger value="retention" className="gap-1 text-xs"><Clock className="h-3.5 w-3.5" /> Retención</TabsTrigger>
          <TabsTrigger value="evidence" className="gap-1 text-xs"><Upload className="h-3.5 w-3.5" /> Evidencia</TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1 text-xs"><CalendarDays className="h-3.5 w-3.5" /> Auditorías</TabsTrigger>
        </TabsList>

        {/* Search + Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm bg-slate-900/50 border-slate-700" />
          </div>
          {tab === 'templates' && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48 h-8 text-xs bg-slate-900/50 border-slate-700"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {Object.entries(templateTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {tab === 'retention' && (
            <Select value={dataTypeFilter} onValueChange={setDataTypeFilter}>
              <SelectTrigger className="w-48 h-8 text-xs bg-slate-900/50 border-slate-700"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {Object.entries(retentionDataTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {(tab === 'templates') && <Button size="sm" className="h-8 gap-1" onClick={openCreateTpl}><Plus className="h-3.5 w-3.5" /> Nueva Plantilla</Button>}
          {(tab === 'retention') && <Button size="sm" className="h-8 gap-1" onClick={openCreateRet}><Plus className="h-3.5 w-3.5" /> Nueva Política</Button>}
        </div>

        {/* ═══ Templates Tab ═══ */}
        <TabsContent value="templates">
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardContent className="p-0">
              {loadingTpl ? <LoadingSkeleton /> : filteredTpl.length === 0 ? (
                <EmptyState icon={<FileText />} title="Sin plantillas" desc="Crea plantillas de cumplimiento para documentar políticas y procedimientos" />
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-700/50 bg-slate-800/50">
                      <th className="p-3 text-left text-xs text-slate-400">Nombre</th>
                      <th className="p-3 text-left text-xs text-slate-400">Tipo</th>
                      <th className="p-3 text-left text-xs text-slate-400">Versión</th>
                      <th className="p-3 text-left text-xs text-slate-400">Estado</th>
                      <th className="p-3 text-left text-xs text-slate-400">Aprobación</th>
                      <th className="p-3 text-left text-xs text-slate-400">Creado</th>
                      <th className="p-3 w-10"></th>
                    </tr></thead>
                    <tbody>
                      {filteredTpl.map((tpl: any) => {
                        const tc = templateTypeColor[tpl.type] || 'bg-slate-500/10 text-slate-400 border-slate-500/30';
                        return (
                          <tr key={tpl.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                            <td className="p-3 font-medium text-white">{tpl.name}</td>
                            <td className="p-3"><Badge className={cn("text-[9px] border", tc)}>{templateTypeLabels[tpl.type] || tpl.type}</Badge></td>
                            <td className="p-3 text-xs text-slate-400">v{tpl.version || 1}</td>
                            <td className="p-3"><Badge className={cn("text-[9px] border", tpl.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30')}>{tpl.isActive ? 'Activa' : 'Inactiva'}</Badge></td>
                            <td className="p-3">{tpl.approvedAt ? <Badge className="text-[9px] border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> {fmtDate(tpl.approvedAt)}</Badge> : <Badge className="text-[9px] border bg-amber-500/10 text-amber-400 border-amber-500/30">Pendiente</Badge>}</td>
                            <td className="p-3 text-xs text-slate-400">{fmtDate(tpl.createdAt || tpl.created_at)}</td>
                            <td className="p-3">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setShowPreview(tpl)}><Eye className="mr-2 h-3 w-3" /> Ver contenido</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEditTpl(tpl)}><Pencil className="mr-2 h-3 w-3" /> Editar</DropdownMenuItem>
                                  {!tpl.approvedAt && <DropdownMenuItem onClick={() => approveTplMut.mutate(tpl.id)}><CheckCircle2 className="mr-2 h-3 w-3" /> Aprobar</DropdownMenuItem>}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ type: 'template', id: tpl.id, label: tpl.name })}><Trash2 className="mr-2 h-3 w-3" /> Eliminar</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Retention Tab ═══ */}
        <TabsContent value="retention">
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardContent className="p-0">
              {loadingRet ? <LoadingSkeleton /> : filteredRet.length === 0 ? (
                <EmptyState icon={<Clock />} title="Sin políticas de retención" desc="Define cuánto tiempo se conservan los datos y qué acción tomar al vencer" />
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-700/50 bg-slate-800/50">
                      <th className="p-3 text-left text-xs text-slate-400">Nombre</th>
                      <th className="p-3 text-left text-xs text-slate-400">Tipo de Dato</th>
                      <th className="p-3 text-left text-xs text-slate-400">Retención</th>
                      <th className="p-3 text-left text-xs text-slate-400">Acción</th>
                      <th className="p-3 text-left text-xs text-slate-400">Estado</th>
                      <th className="p-3 text-left text-xs text-slate-400">Última Ejecución</th>
                      <th className="p-3 w-10"></th>
                    </tr></thead>
                    <tbody>
                      {filteredRet.map((r: any) => (
                        <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="p-3 font-medium text-white">{r.name}</td>
                          <td className="p-3"><Badge variant="outline" className="text-[9px]">{retentionDataTypeLabels[r.dataType] || r.dataType}</Badge></td>
                          <td className="p-3 text-xs text-white font-mono">{r.retentionDays} días</td>
                          <td className="p-3"><Badge className={cn("text-[9px] border", actionColors[r.action] || '')}>{actionLabels[r.action] || r.action}</Badge></td>
                          <td className="p-3"><Badge className={cn("text-[9px] border", r.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/10 text-slate-400 border-slate-500/30')}>{r.isActive ? 'Activa' : 'Inactiva'}</Badge></td>
                          <td className="p-3 text-xs text-slate-400">{r.lastExecutedAt ? fmtDate(r.lastExecutedAt) : 'Nunca'}</td>
                          <td className="p-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditRet(r)}><Pencil className="mr-2 h-3 w-3" /> Editar</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ type: 'retention', id: r.id, label: r.name })}><Trash2 className="mr-2 h-3 w-3" /> Eliminar</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Evidence Tab ═══ */}
        <TabsContent value="evidence" className="space-y-4">
          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5"><Upload className="h-4 w-4 text-blue-400" /> Subir Evidencia</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select value={evidenceTemplate} onValueChange={setEvidenceTemplate}>
                  <SelectTrigger className="h-8 text-xs bg-slate-900/50 border-slate-700"><SelectValue placeholder="Plantilla asociada (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ninguna</SelectItem>
                    {tplList.map((t: any) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input placeholder="Notas de la evidencia..." value={evidenceNotes} onChange={e => setEvidenceNotes(e.target.value)} className="h-8 text-xs bg-slate-900/50 border-slate-700" />
                <div>
                  <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple className="hidden" onChange={e => handleEvidenceUpload(e.target.files)} />
                  <Button size="sm" className="h-8 w-full gap-1 text-xs" onClick={() => fileInputRef.current?.click()} disabled={evidenceUploading}>
                    {evidenceUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Subir archivo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {evidenceItems.length === 0 ? (
            <EmptyState icon={<Upload />} title="Sin evidencia" desc="Sube archivos como evidencia de cumplimiento (PDF, imágenes, documentos)" />
          ) : (
            <Card className="bg-slate-800/30 border-slate-700/40">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-700/50 bg-slate-800/50">
                    <th className="p-3 text-left text-xs text-slate-400">Archivo</th>
                    <th className="p-3 text-left text-xs text-slate-400">Fecha</th>
                    <th className="p-3 text-left text-xs text-slate-400">Operador</th>
                    <th className="p-3 text-left text-xs text-slate-400">Plantilla</th>
                    <th className="p-3 text-left text-xs text-slate-400">Notas</th>
                    <th className="p-3 w-10"></th>
                  </tr></thead>
                  <tbody>
                    {evidenceItems.map(item => {
                      const ext = item.fileName.split('.').pop()?.toLowerCase() || '';
                      const FileIcon = ['jpg', 'jpeg', 'png'].includes(ext) ? FileImage : File;
                      return (
                        <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="p-3 flex items-center gap-2"><FileIcon className="h-4 w-4 text-slate-400" /><span className="text-white text-xs truncate max-w-[200px]">{item.fileName}</span></td>
                          <td className="p-3 text-xs text-slate-400">{fmtDate(item.uploadDate)}</td>
                          <td className="p-3 text-xs text-slate-300">{item.uploader}</td>
                          <td className="p-3 text-xs text-slate-400">{item.linkedTemplate || '—'}</td>
                          <td className="p-3 text-xs text-slate-500 truncate max-w-[150px]">{item.notes || '—'}</td>
                          <td className="p-3">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast.info('La evidencia se almacena como referencia. Descargue el archivo original del sistema de archivos.')} title="Info">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ Audit Calendar Tab ═══ */}
        <TabsContent value="calendar" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { if (auditMonth === 0) { setAuditMonth(11); setAuditYear(y => y - 1); } else setAuditMonth(m => m - 1); }}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-medium text-white min-w-[180px] text-center capitalize">{monthLabel}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { if (auditMonth === 11) { setAuditMonth(0); setAuditYear(y => y + 1); } else setAuditMonth(m => m + 1); }}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <Button size="sm" className="gap-1" onClick={() => { setAuditForm({ ...defaultAuditForm }); setShowAuditDialog(true); }}><Plus className="h-3.5 w-3.5" /> Programar Auditoría</Button>
          </div>

          <Card className="bg-slate-800/30 border-slate-700/40">
            <CardContent className="p-0">
              <div className="grid grid-cols-7">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                  <div key={d} className="p-2 text-center text-[10px] font-medium text-slate-500 border-b border-slate-700/50">{d}</div>
                ))}
                {monthDates.flat().map((date, i) => {
                  if (!date) return <div key={`empty-${i}`} className="p-1.5 min-h-[60px] border-b border-r border-slate-800/30 bg-slate-900/20" />;
                  const dateStr = date.toISOString().slice(0, 10);
                  const dayAudits = audits.filter(a => a.date === dateStr);
                  const isToday = dateStr === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={dateStr} className={cn("p-1.5 min-h-[60px] border-b border-r border-slate-800/30 hover:bg-slate-800/40", isToday && "bg-blue-500/5")}>
                      <span className={cn("text-[10px]", isToday ? "text-blue-400 font-bold" : "text-slate-500")}>{date.getDate()}</span>
                      {dayAudits.map(a => {
                        const sc = auditStatusConfig[a.status];
                        return (
                          <div key={a.id} className={cn("mt-0.5 px-1 py-0.5 rounded text-[8px] truncate cursor-pointer border", sc.color)} onClick={() => toggleAuditComplete(a.id)} title={`${a.templateName} — ${a.auditor}`}>
                            {a.templateName.length > 12 ? a.templateName.slice(0, 12) + '…' : a.templateName}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming audits */}
          {audits.filter(a => a.status !== 'completed').length > 0 && (
            <Card className="bg-slate-800/30 border-slate-700/40">
              <CardContent className="p-3 space-y-2">
                <h3 className="text-xs font-semibold text-white flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-blue-400" /> Auditorías Pendientes</h3>
                {audits.filter(a => a.status !== 'completed').map(a => {
                  const sc = auditStatusConfig[a.status];
                  return (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-md bg-slate-900/40">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className={cn("text-[9px] border shrink-0", sc.color)}>{sc.label}</Badge>
                        <div className="min-w-0">
                          <p className="text-xs text-white truncate">{a.templateName}</p>
                          <p className="text-[10px] text-slate-500">{fmtDate(a.date)} — {a.auditor}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleAuditComplete(a.id)} title="Completar"><CheckCircle2 className="h-3 w-3 text-emerald-400" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => deleteAudit(a.id)} title="Eliminar"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ Dialogs ═══ */}

      {/* Template Dialog */}
      <Dialog open={showTplDialog} onOpenChange={o => { if (!o) closeTplDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingTpl ? 'Editar Plantilla' : 'Nueva Plantilla'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Nombre *</Label><Input value={tplForm.name} onChange={e => setTplForm(f => ({ ...f, name: e.target.value }))} placeholder="Política de privacidad v1" className="bg-slate-900 border-slate-700" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Tipo</Label>
                <Select value={tplForm.type} onValueChange={v => setTplForm(f => ({ ...f, type: v }))}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(templateTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex items-end gap-2"><Label className="text-xs text-slate-400">Activa</Label><Switch checked={tplForm.isActive} onCheckedChange={c => setTplForm(f => ({ ...f, isActive: c }))} className="h-4 w-8" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Contenido *</Label><Textarea value={tplForm.content} onChange={e => setTplForm(f => ({ ...f, content: e.target.value }))} placeholder="Texto completo de la plantilla..." rows={8} className="bg-slate-900 border-slate-700 font-mono text-xs" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTplDialog}>Cancelar</Button>
            <Button onClick={handleTplSubmit} disabled={!tplForm.name || !tplForm.content || createTplMut.isPending || updateTplMut.isPending} className="gap-1">
              {(createTplMut.isPending || updateTplMut.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingTpl ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retention Dialog */}
      <Dialog open={showRetDialog} onOpenChange={o => { if (!o) closeRetDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editingRet ? 'Editar Política' : 'Nueva Política de Retención'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Nombre *</Label><Input value={retForm.name} onChange={e => setRetForm(f => ({ ...f, name: e.target.value }))} placeholder="Retención de video 90 días" className="bg-slate-900 border-slate-700" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Tipo de Dato</Label>
                <Select value={retForm.dataType} onValueChange={v => setRetForm(f => ({ ...f, dataType: v }))}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(retentionDataTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Días de Retención</Label><Input type="number" min={1} value={retForm.retentionDays} onChange={e => setRetForm(f => ({ ...f, retentionDays: parseInt(e.target.value) || 1 }))} className="bg-slate-900 border-slate-700" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Acción al Vencer</Label>
                <Select value={retForm.action} onValueChange={v => setRetForm(f => ({ ...f, action: v }))}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(actionLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex items-end gap-2"><Label className="text-xs text-slate-400">Activa</Label><Switch checked={retForm.isActive} onCheckedChange={c => setRetForm(f => ({ ...f, isActive: c }))} className="h-4 w-8" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRetDialog}>Cancelar</Button>
            <Button onClick={handleRetSubmit} disabled={!retForm.name || createRetMut.isPending || updateRetMut.isPending} className="gap-1">
              {(createRetMut.isPending || updateRetMut.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingRet ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content Preview */}
      <Dialog open={!!showPreview} onOpenChange={o => { if (!o) setShowPreview(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader><DialogTitle>{showPreview?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Badge className={cn("text-[9px] border", templateTypeColor[showPreview?.type] || '')}>{templateTypeLabels[showPreview?.type] || showPreview?.type}</Badge>
              <Badge variant="outline" className="text-[9px]">v{showPreview?.version || 1}</Badge>
            </div>
            <div className="p-4 rounded-md bg-slate-900/50 border border-slate-700 overflow-auto max-h-[50vh]">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">{showPreview?.content || 'Sin contenido'}</pre>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowPreview(null)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Dialog */}
      <Dialog open={showAuditDialog} onOpenChange={setShowAuditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Programar Auditoría</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Fecha *</Label><Input type="date" value={auditForm.date} onChange={e => setAuditForm(f => ({ ...f, date: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Plantilla *</Label>
              <Select value={auditForm.templateName} onValueChange={v => setAuditForm(f => ({ ...f, templateName: v }))}><SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="Seleccionar plantilla..." /></SelectTrigger>
                <SelectContent>{tplList.map((t: any) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Auditor *</Label><Input value={auditForm.auditor} onChange={e => setAuditForm(f => ({ ...f, auditor: e.target.value }))} placeholder="Nombre del auditor" className="bg-slate-900 border-slate-700" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuditDialog(false)}>Cancelar</Button>
            <Button onClick={saveAudit} disabled={!auditForm.date || !auditForm.templateName || !auditForm.auditor}>Programar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {deleteTarget?.type === 'template' ? 'Plantilla' : 'Política'}</AlertDialogTitle>
            <AlertDialogDescription>¿Eliminar <span className="font-medium text-white">"{deleteTarget?.label}"</span>? Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => {
              if (!deleteTarget) return;
              if (deleteTarget.type === 'template') deleteTplMut.mutate(deleteTarget.id);
              else deleteRetMut.mutate(deleteTarget.id);
            }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PageShell>
  );
}

// ══════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════

function StatCard({ icon, label, value, color, isText }: { icon: React.ReactNode; label: string; value: number | string; color: string; isText?: boolean }) {
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
    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
      <div className="opacity-20 mb-3 [&>svg]:h-12 [&>svg]:w-12">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs mt-1">{desc}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
}
