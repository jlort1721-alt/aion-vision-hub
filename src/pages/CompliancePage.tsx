import { useState, useMemo, useCallback, useEffect } from 'react';
import ErrorState from '@/components/ui/ErrorState';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ShieldCheck, Plus, FileText, Clock, CheckCircle, Search,
  MoreHorizontal, Pencil, Trash2, Eye, AlertTriangle, TrendingUp,
  Upload, Download, CalendarDays, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  complianceTemplatesApi, retentionPoliciesApi, complianceStatsApi,
} from '@/services/compliance-api';
import { evidenceApi } from '@/services/evidence-api';

const templateTypeLabels: Record<string, string> = {
  habeas_data: 'Habeas Data',
  consent_form: 'Consent Form',
  privacy_policy: 'Privacy Policy',
  data_retention: 'Data Retention',
  incident_report: 'Incident Report',
  data_breach_notification: 'Data Breach Notification',
};

const retentionDataTypeLabels: Record<string, string> = {
  video_footage: 'Video Footage',
  event_logs: 'Event Logs',
  access_logs: 'Access Logs',
  visitor_records: 'Visitor Records',
  audit_logs: 'Audit Logs',
  personal_data: 'Personal Data',
};

const actionLabels: Record<string, string> = {
  delete: 'Delete',
  archive: 'Archive',
  anonymize: 'Anonymize',
};

const defaultTemplateForm = {
  name: '',
  type: 'privacy_policy' as string,
  content: '',
  version: 1,
  isActive: true,
};

const defaultRetentionForm = {
  name: '',
  dataType: 'video_footage' as string,
  retentionDays: 365,
  action: 'delete' as string,
  isActive: true,
};

// ── Audit types and helpers ───────────────────────────────
interface AuditSchedule {
  id: string;
  date: string;
  templateName: string;
  auditor: string;
  status: 'scheduled' | 'completed' | 'overdue';
}

interface EvidenceItem {
  id: string;
  fileName: string;
  uploadDate: string;
  uploader: string;
  linkedTemplate: string;
  notes: string;
}

const AUDIT_STORAGE_KEY = 'aion_compliance_audits';
const EVIDENCE_ITEMS_KEY = 'aion_compliance_evidence_items';

function loadAudits(): AuditSchedule[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAudits(audits: AuditSchedule[]) {
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(audits));
}

function loadEvidenceItems(): EvidenceItem[] {
  try {
    const raw = localStorage.getItem(EVIDENCE_ITEMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveEvidenceItems(items: EvidenceItem[]) {
  localStorage.setItem(EVIDENCE_ITEMS_KEY, JSON.stringify(items));
}

function getMonthDates(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Mon = 0
  const weeks: (Date | null)[][] = [];
  let current = 0;
  for (let w = 0; current <= lastDay.getDate(); w++) {
    const week: (Date | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const dayNum = w * 7 + d - startPad + 1;
      if (dayNum < 1 || dayNum > lastDay.getDate()) {
        week.push(null);
      } else {
        week.push(new Date(year, month, dayNum));
        current = dayNum;
      }
    }
    weeks.push(week);
    if (current >= lastDay.getDate()) break;
  }
  return weeks;
}

const auditStatusColor: Record<string, string> = {
  scheduled: 'default',
  completed: 'default',
  overdue: 'destructive',
};

const defaultAuditForm = {
  date: '',
  templateName: '',
  auditor: '',
};

export default function CompliancePage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  // UI state
  const [tab, setTab] = useState('templates');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dataTypeFilter, setDataTypeFilter] = useState('all');

  // Dialogs
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [showRetentionDialog, setShowRetentionDialog] = useState(false);
  const [editingRetention, setEditingRetention] = useState<any>(null);
  const [showContentPreview, setShowContentPreview] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'template' | 'retention'; id: string; label: string } | null>(null);

  // Forms
  const [tplForm, setTplForm] = useState({ ...defaultTemplateForm });
  const [retForm, setRetForm] = useState({ ...defaultRetentionForm });

  // Evidence state
  const [evidenceItems, setEvidenceItems] = useState<EvidenceItem[]>(() => loadEvidenceItems());
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [evidenceTemplate, setEvidenceTemplate] = useState('');

  // Audit calendar state
  const [audits, setAudits] = useState<AuditSchedule[]>(() => loadAudits());
  const [auditMonth, setAuditMonth] = useState(new Date().getMonth());
  const [auditYear, setAuditYear] = useState(new Date().getFullYear());
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [auditForm, setAuditForm] = useState({ ...defaultAuditForm });

  // Sync audits overdue status
  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    let changed = false;
    const updated = audits.map(a => {
      if (a.status === 'scheduled' && new Date(a.date) < now) {
        changed = true;
        return { ...a, status: 'overdue' as const };
      }
      return a;
    });
    if (changed) {
      setAudits(updated);
      saveAudits(updated);
    }
  }, [audits]);

  // Queries
  const { data: templates, isLoading: loadingTemplates, isError, error, refetch } = useQuery({
    queryKey: ['compliance-templates', typeFilter],
    queryFn: () => complianceTemplatesApi.list({
      ...(typeFilter !== 'all' && { type: typeFilter }),
    }),
  });

  const { data: policies, isLoading: loadingPolicies } = useQuery({
    queryKey: ['retention-policies', dataTypeFilter],
    queryFn: () => retentionPoliciesApi.list({
      ...(dataTypeFilter !== 'all' && { dataType: dataTypeFilter }),
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['compliance-stats'],
    queryFn: () => complianceStatsApi.get(),
  });

  // Mutations
  const createTemplate = useMutation({
    mutationFn: (data: Record<string, unknown>) => complianceTemplatesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-templates'] });
      qc.invalidateQueries({ queryKey: ['compliance-stats'] });
      closeTemplateDialog();
      toast.success('Template created successfully');
    },
    onError: (err: Error) => toast.error(`Failed to create template: ${err.message}`),
  });

  const updateTemplate = useMutation({
    mutationFn: ({ id, ...data }: any) => complianceTemplatesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-templates'] });
      qc.invalidateQueries({ queryKey: ['compliance-stats'] });
      closeTemplateDialog();
      toast.success('Template updated successfully');
    },
    onError: (err: Error) => toast.error(`Failed to update template: ${err.message}`),
  });

  const approveTemplate = useMutation({
    mutationFn: (id: string) => complianceTemplatesApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-templates'] });
      qc.invalidateQueries({ queryKey: ['compliance-stats'] });
      toast.success('Template approved');
    },
    onError: (err: Error) => toast.error(`Failed to approve template: ${err.message}`),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => complianceTemplatesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['compliance-templates'] });
      qc.invalidateQueries({ queryKey: ['compliance-stats'] });
      setDeleteTarget(null);
      toast.success('Template deleted');
    },
    onError: (err: Error) => toast.error(`Failed to delete template: ${err.message}`),
  });

  const createRetention = useMutation({
    mutationFn: (data: Record<string, unknown>) => retentionPoliciesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retention-policies'] });
      qc.invalidateQueries({ queryKey: ['compliance-stats'] });
      closeRetentionDialog();
      toast.success('Retention policy created successfully');
    },
    onError: (err: Error) => toast.error(`Failed to create policy: ${err.message}`),
  });

  const updateRetention = useMutation({
    mutationFn: ({ id, ...data }: any) => retentionPoliciesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retention-policies'] });
      qc.invalidateQueries({ queryKey: ['compliance-stats'] });
      closeRetentionDialog();
      toast.success('Retention policy updated successfully');
    },
    onError: (err: Error) => toast.error(`Failed to update policy: ${err.message}`),
  });

  const deleteRetention = useMutation({
    mutationFn: (id: string) => retentionPoliciesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retention-policies'] });
      qc.invalidateQueries({ queryKey: ['compliance-stats'] });
      setDeleteTarget(null);
      toast.success('Retention policy deleted');
    },
    onError: (err: Error) => toast.error(`Failed to delete policy: ${err.message}`),
  });

  // Dialog helpers
  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTplForm({ ...defaultTemplateForm });
    setShowTemplateDialog(true);
  };

  const openEditTemplate = (tpl: any) => {
    setEditingTemplate(tpl);
    setTplForm({
      name: tpl.name || '',
      type: tpl.type || 'privacy_policy',
      content: tpl.content || '',
      version: tpl.version || 1,
      isActive: tpl.isActive ?? true,
    });
    setShowTemplateDialog(true);
  };

  const closeTemplateDialog = () => {
    setShowTemplateDialog(false);
    setEditingTemplate(null);
    setTplForm({ ...defaultTemplateForm });
  };

  const openCreateRetention = () => {
    setEditingRetention(null);
    setRetForm({ ...defaultRetentionForm });
    setShowRetentionDialog(true);
  };

  const openEditRetention = (pol: any) => {
    setEditingRetention(pol);
    setRetForm({
      name: pol.name || '',
      dataType: pol.dataType || 'video_footage',
      retentionDays: pol.retentionDays || 365,
      action: pol.action || 'delete',
      isActive: pol.isActive ?? true,
    });
    setShowRetentionDialog(true);
  };

  const closeRetentionDialog = () => {
    setShowRetentionDialog(false);
    setEditingRetention(null);
    setRetForm({ ...defaultRetentionForm });
  };

  const handleTemplateSubmit = () => {
    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, ...tplForm });
    } else {
      createTemplate.mutate(tplForm);
    }
  };

  const handleRetentionSubmit = () => {
    if (editingRetention) {
      updateRetention.mutate({ id: editingRetention.id, ...retForm });
    } else {
      createRetention.mutate(retForm);
    }
  };

  // ── Evidence upload handler ───────────────────────────────
  const handleEvidenceUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setEvidenceUploading(true);
    for (const file of Array.from(files)) {
      try {
        await evidenceApi.create({
          incident_id: 'compliance-evidence',
          type: 'document',
          file_name: file.name,
          mime_type: file.type,
          description: evidenceNotes || `Compliance evidence: ${file.name}`,
        });
        const item: EvidenceItem = {
          id: crypto.randomUUID(),
          fileName: file.name,
          uploadDate: new Date().toISOString(),
          uploader: 'Current User',
          linkedTemplate: evidenceTemplate,
          notes: evidenceNotes,
        };
        setEvidenceItems(prev => {
          const updated = [item, ...prev];
          saveEvidenceItems(updated);
          return updated;
        });
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setEvidenceUploading(false);
    setEvidenceNotes('');
    toast.success('Evidence uploaded successfully');
  };

  // ── Audit schedule handlers ───────────────────────────────
  const handleCreateAudit = () => {
    if (!auditForm.date || !auditForm.templateName || !auditForm.auditor) return;
    const newAudit: AuditSchedule = {
      id: crypto.randomUUID(),
      date: auditForm.date,
      templateName: auditForm.templateName,
      auditor: auditForm.auditor,
      status: 'scheduled',
    };
    const updated = [...audits, newAudit];
    setAudits(updated);
    saveAudits(updated);
    setShowAuditDialog(false);
    setAuditForm({ ...defaultAuditForm });
    toast.success('Audit scheduled');
  };

  const toggleAuditComplete = (id: string) => {
    const updated = audits.map(a =>
      a.id === id ? { ...a, status: (a.status === 'completed' ? 'scheduled' : 'completed') as AuditSchedule['status'] } : a
    );
    setAudits(updated);
    saveAudits(updated);
  };

  const deleteAudit = (id: string) => {
    const updated = audits.filter(a => a.id !== id);
    setAudits(updated);
    saveAudits(updated);
    toast.success('Audit removed');
  };

  const monthWeeks = useMemo(() => getMonthDates(auditYear, auditMonth), [auditYear, auditMonth]);

  const auditsByDate = useMemo(() => {
    const map = new Map<string, AuditSchedule[]>();
    for (const a of audits) {
      const key = a.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [audits]);

  // Filtering
  const filteredTemplates = (templates?.data || []).filter((tpl: any) => {
    if (search) {
      const s = search.toLowerCase();
      return (
        tpl.name?.toLowerCase().includes(s) ||
        tpl.type?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const filteredPolicies = (policies?.data || []).filter((p: any) => {
    if (search) {
      const s = search.toLowerCase();
      return (
        p.name?.toLowerCase().includes(s) ||
        p.dataType?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const s = stats?.data;

  // Calculate compliance rate
  const complianceRate =
    s && s.totalTemplates > 0
      ? Math.round((s.approvedTemplates / s.totalTemplates) * 100)
      : 0;

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6" />
            Compliance (Ley 1581)
          </h1>
          <p className="text-sm text-muted-foreground">
            Data protection policies, templates, and retention management
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />Compliance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${complianceRate >= 80 ? 'text-success' : complianceRate >= 50 ? 'text-warning' : 'text-destructive'}`}>
              {complianceRate}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {s?.approvedTemplates ?? 0} of {s?.totalTemplates ?? 0} approved
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />Total Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.totalTemplates ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {s?.approvedTemplates ?? 0} approved
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />Retention Policies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.totalPolicies ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Data governance rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />Active Policies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{s?.activePolicies ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently enforced</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending review warning */}
      {s && s.totalTemplates > 0 && s.approvedTemplates < s.totalTemplates && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {s.totalTemplates - s.approvedTemplates} template(s) pending review/approval
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="templates">
              <FileText className="h-4 w-4 mr-1" />Templates
            </TabsTrigger>
            <TabsTrigger value="retention">
              <Clock className="h-4 w-4 mr-1" />Retention Policies
            </TabsTrigger>
            <TabsTrigger value="evidence">
              <Upload className="h-4 w-4 mr-1" />Evidence
            </TabsTrigger>
            <TabsTrigger value="audit-calendar">
              <CalendarDays className="h-4 w-4 mr-1" />Audit Calendar
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {tab === 'templates' && (
              <Button size="sm" onClick={openCreateTemplate}>
                <Plus className="h-4 w-4 mr-1" />New Template
              </Button>
            )}
            {tab === 'retention' && (
              <Button size="sm" onClick={openCreateRetention}>
                <Plus className="h-4 w-4 mr-1" />New Policy
              </Button>
            )}
            {tab === 'audit-calendar' && (
              <Button size="sm" onClick={() => setShowAuditDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />Schedule Audit
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tab === 'templates' ? 'Search templates...' : 'Search policies...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          {tab === 'templates' && (
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="habeas_data">Habeas Data</SelectItem>
                <SelectItem value="consent_form">Consent Form</SelectItem>
                <SelectItem value="privacy_policy">Privacy Policy</SelectItem>
                <SelectItem value="data_retention">Data Retention</SelectItem>
                <SelectItem value="incident_report">Incident Report</SelectItem>
                <SelectItem value="data_breach_notification">Data Breach</SelectItem>
              </SelectContent>
            </Select>
          )}
          {tab === 'retention' && (
            <Select value={dataTypeFilter} onValueChange={setDataTypeFilter}>
              <SelectTrigger className="w-44 h-9">
                <SelectValue placeholder="Data Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Data Types</SelectItem>
                <SelectItem value="video_footage">Video Footage</SelectItem>
                <SelectItem value="event_logs">Event Logs</SelectItem>
                <SelectItem value="access_logs">Access Logs</SelectItem>
                <SelectItem value="visitor_records">Visitor Records</SelectItem>
                <SelectItem value="audit_logs">Audit Logs</SelectItem>
                <SelectItem value="personal_data">Personal Data</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardContent className="p-0">
              {loadingTemplates ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {(templates?.data || []).length === 0
                      ? 'No compliance templates yet'
                      : 'No templates match your filters'}
                  </p>
                  {(templates?.data || []).length === 0 && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={openCreateTemplate}>
                      <Plus className="mr-1 h-3 w-3" />Create your first template
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Name</th>
                      <th className="p-3 text-left font-medium">Type</th>
                      <th className="p-3 text-left font-medium">Version</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Approved</th>
                      <th className="p-3 text-left font-medium">Created</th>
                      <th className="p-3 w-10">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTemplates.map((tpl: any) => (
                      <tr key={tpl.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="font-medium">{tpl.name}</div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">
                            {templateTypeLabels[tpl.type] || tpl.type}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs font-mono">v{tpl.version}</td>
                        <td className="p-3">
                          <Badge variant={tpl.isActive ? 'default' : 'secondary'}>
                            {tpl.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">
                          {tpl.approvedAt ? (
                            <span className="flex items-center gap-1 text-success">
                              <CheckCircle className="h-3 w-3" />
                              {new Date(tpl.approvedAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-warning border-warning">
                              Pending
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-xs">
                          {tpl.createdAt ? new Date(tpl.createdAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setShowContentPreview(tpl)}>
                                <Eye className="mr-2 h-3 w-3" />View Content
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditTemplate(tpl)}>
                                <Pencil className="mr-2 h-3 w-3" />Edit
                              </DropdownMenuItem>
                              {!tpl.approvedAt && (
                                <DropdownMenuItem onClick={() => approveTemplate.mutate(tpl.id)}>
                                  <CheckCircle className="mr-2 h-3 w-3" />Approve
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  setDeleteTarget({ type: 'template', id: tpl.id, label: tpl.name })
                                }
                              >
                                <Trash2 className="mr-2 h-3 w-3" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <div className="text-xs text-muted-foreground mt-2">
            {filteredTemplates.length} template(s) shown
          </div>
        </TabsContent>

        {/* Retention Policies Tab */}
        <TabsContent value="retention">
          <Card>
            <CardContent className="p-0">
              {loadingPolicies ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredPolicies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Clock className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {(policies?.data || []).length === 0
                      ? 'No retention policies yet'
                      : 'No policies match your filters'}
                  </p>
                  {(policies?.data || []).length === 0 && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={openCreateRetention}>
                      <Plus className="mr-1 h-3 w-3" />Create your first policy
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Name</th>
                      <th className="p-3 text-left font-medium">Data Type</th>
                      <th className="p-3 text-left font-medium">Retention</th>
                      <th className="p-3 text-left font-medium">Action</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Last Executed</th>
                      <th className="p-3 w-10">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPolicies.map((p: any) => (
                      <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3">
                          <Badge variant="outline">
                            {retentionDataTypeLabels[p.dataType] || p.dataType}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">
                          <span className="font-mono font-bold">{p.retentionDays}</span> days
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={p.action === 'delete' ? 'destructive' : p.action === 'archive' ? 'secondary' : 'outline'}
                          >
                            {actionLabels[p.action] || p.action}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={p.isActive ? 'default' : 'secondary'}>
                            {p.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">
                          {p.lastExecutedAt
                            ? new Date(p.lastExecutedAt).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditRetention(p)}>
                                <Pencil className="mr-2 h-3 w-3" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  setDeleteTarget({ type: 'retention', id: p.id, label: p.name })
                                }
                              >
                                <Trash2 className="mr-2 h-3 w-3" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <div className="text-xs text-muted-foreground mt-2">
            {filteredPolicies.length} policy(ies) shown
          </div>
        </TabsContent>

        {/* ── Evidence Tab ────────────────────────────────── */}
        <TabsContent value="evidence">
          <div className="space-y-4">
            {/* Upload area */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Upload Evidence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Linked Template</Label>
                    <Select value={evidenceTemplate} onValueChange={setEvidenceTemplate}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select template..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {(templates?.data || []).map((tpl: any) => (
                          <SelectItem key={tpl.id} value={tpl.name}>{tpl.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Input
                      value={evidenceNotes}
                      onChange={(e) => setEvidenceNotes(e.target.value)}
                      placeholder="Description..."
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-md p-6 text-center">
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    id="evidence-upload"
                    onChange={(e) => handleEvidenceUpload(e.target.files)}
                  />
                  <label htmlFor="evidence-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    {evidenceUploading ? (
                      <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {evidenceUploading ? 'Uploading...' : 'Click to upload evidence files (PDF, images, documents)'}
                    </span>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Evidence list */}
            <Card>
              <CardContent className="p-0">
                {evidenceItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-3 opacity-20" />
                    <p className="text-sm font-medium">No evidence uploaded yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Upload files to build your compliance evidence library</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">File Name</th>
                        <th className="p-3 text-left font-medium">Upload Date</th>
                        <th className="p-3 text-left font-medium">Uploader</th>
                        <th className="p-3 text-left font-medium">Template</th>
                        <th className="p-3 text-left font-medium">Notes</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidenceItems.map((item) => (
                        <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{item.fileName}</span>
                            </div>
                          </td>
                          <td className="p-3 text-xs">
                            {new Date(item.uploadDate).toLocaleDateString('es-CO')}
                          </td>
                          <td className="p-3 text-xs">{item.uploader}</td>
                          <td className="p-3">
                            {item.linkedTemplate ? (
                              <Badge variant="outline" className="text-xs">{item.linkedTemplate}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground truncate max-w-[150px]">
                            {item.notes || '-'}
                          </td>
                          <td className="p-3">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Download">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
            <div className="text-xs text-muted-foreground">
              {evidenceItems.length} evidence item(s)
            </div>
          </div>
        </TabsContent>

        {/* ── Audit Calendar Tab ──────────────────────────── */}
        <TabsContent value="audit-calendar">
          <div className="space-y-4">
            {/* Month navigation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (auditMonth === 0) { setAuditMonth(11); setAuditYear(y => y - 1); }
                    else setAuditMonth(m => m - 1);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[160px] text-center capitalize">
                  {new Date(auditYear, auditMonth).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (auditMonth === 11) { setAuditMonth(0); setAuditYear(y => y + 1); }
                    else setAuditMonth(m => m + 1);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Scheduled</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Completed</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Overdue</span>
              </div>
            </div>

            {/* Calendar grid */}
            <Card>
              <CardContent className="p-0">
                <div className="grid grid-cols-7">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                    <div key={d} className="p-2 border-b bg-muted/50 text-center text-xs font-medium">
                      {d}
                    </div>
                  ))}
                  {monthWeeks.map((week, wi) =>
                    week.map((date, di) => {
                      const dateStr = date ? date.toISOString().slice(0, 10) : '';
                      const dayAudits = dateStr ? (auditsByDate.get(dateStr) || []) : [];
                      const isToday = date && date.toDateString() === new Date().toDateString();
                      return (
                        <div
                          key={`${wi}-${di}`}
                          className={`min-h-[80px] p-1 border-b border-r ${
                            !date ? 'bg-muted/20' : isToday ? 'bg-primary/5' : ''
                          }`}
                        >
                          {date && (
                            <>
                              <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                                {date.getDate()}
                              </div>
                              <div className="space-y-0.5">
                                {dayAudits.map(a => (
                                  <div
                                    key={a.id}
                                    className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer ${
                                      a.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                      a.status === 'overdue' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                                      'bg-primary/10 text-primary'
                                    }`}
                                    title={`${a.templateName} - ${a.auditor}`}
                                    onClick={() => toggleAuditComplete(a.id)}
                                  >
                                    {a.templateName}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Audit list */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Upcoming Audits</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {audits.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <CalendarDays className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-sm">No audits scheduled</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Date</th>
                        <th className="p-3 text-left font-medium">Template</th>
                        <th className="p-3 text-left font-medium">Auditor</th>
                        <th className="p-3 text-left font-medium">Status</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...audits].sort((a, b) => a.date.localeCompare(b.date)).map(a => (
                        <tr key={a.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3 text-xs">{new Date(a.date).toLocaleDateString('es-CO')}</td>
                          <td className="p-3 font-medium">{a.templateName}</td>
                          <td className="p-3 text-xs">{a.auditor}</td>
                          <td className="p-3">
                            <Badge
                              variant={auditStatusColor[a.status] as any}
                              className={`capitalize text-xs ${a.status === 'completed' ? 'bg-green-500' : ''}`}
                            >
                              {a.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => toggleAuditComplete(a.id)}>
                                  <CheckCircle className="mr-2 h-3 w-3" />
                                  {a.status === 'completed' ? 'Mark as Scheduled' : 'Mark as Completed'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => deleteAudit(a.id)}>
                                  <Trash2 className="mr-2 h-3 w-3" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Schedule Audit Dialog */}
      <Dialog open={showAuditDialog} onOpenChange={setShowAuditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Audit</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input
                type="date"
                value={auditForm.date}
                onChange={(e) => setAuditForm({ ...auditForm, date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Template *</Label>
              <Select value={auditForm.templateName} onValueChange={(v) => setAuditForm({ ...auditForm, templateName: v })}>
                <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
                <SelectContent>
                  {(templates?.data || []).map((tpl: any) => (
                    <SelectItem key={tpl.id} value={tpl.name}>{tpl.name}</SelectItem>
                  ))}
                  {/* Allow manual entry via the input below if no templates exist */}
                </SelectContent>
              </Select>
              {(templates?.data || []).length === 0 && (
                <Input
                  placeholder="Enter template name manually"
                  value={auditForm.templateName}
                  onChange={(e) => setAuditForm({ ...auditForm, templateName: e.target.value })}
                  className="mt-1"
                />
              )}
            </div>
            <div className="space-y-1">
              <Label>Assigned Auditor *</Label>
              <Input
                value={auditForm.auditor}
                onChange={(e) => setAuditForm({ ...auditForm, auditor: e.target.value })}
                placeholder="Auditor name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuditDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreateAudit}
              disabled={!auditForm.date || !auditForm.templateName || !auditForm.auditor}
            >
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Create/Edit Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={(o) => { if (!o) closeTemplateDialog(); else setShowTemplateDialog(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'New Compliance Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input
                value={tplForm.name}
                onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })}
                placeholder="Template name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={tplForm.type}
                  onValueChange={(v) => setTplForm({ ...tplForm, type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="habeas_data">Habeas Data</SelectItem>
                    <SelectItem value="consent_form">Consent Form</SelectItem>
                    <SelectItem value="privacy_policy">Privacy Policy</SelectItem>
                    <SelectItem value="data_retention">Data Retention</SelectItem>
                    <SelectItem value="incident_report">Incident Report</SelectItem>
                    <SelectItem value="data_breach_notification">Data Breach</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Version</Label>
                <Input
                  type="number"
                  min={1}
                  value={tplForm.version}
                  onChange={(e) => setTplForm({ ...tplForm, version: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Template Content *</Label>
              <textarea
                className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                value={tplForm.content}
                onChange={(e) => setTplForm({ ...tplForm, content: e.target.value })}
                placeholder="Enter compliance template content..."
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={tplForm.isActive}
                onCheckedChange={(v) => setTplForm({ ...tplForm, isActive: v })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTemplateDialog}>Cancel</Button>
            <Button
              onClick={handleTemplateSubmit}
              disabled={
                !tplForm.name ||
                !tplForm.content ||
                createTemplate.isPending ||
                updateTemplate.isPending
              }
            >
              {createTemplate.isPending || updateTemplate.isPending
                ? 'Saving...'
                : editingTemplate
                ? 'Update Template'
                : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Content Preview */}
      <Dialog open={!!showContentPreview} onOpenChange={(o) => { if (!o) setShowContentPreview(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{showContentPreview?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {templateTypeLabels[showContentPreview?.type] || showContentPreview?.type}
              </Badge>
              <span className="text-xs text-muted-foreground">v{showContentPreview?.version}</span>
              {showContentPreview?.approvedAt && (
                <Badge variant="default" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />Approved
                </Badge>
              )}
            </div>
            <div className="p-4 rounded-md bg-muted/50 font-mono text-sm whitespace-pre-wrap">
              {showContentPreview?.content || 'No content available'}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Retention Policy Create/Edit Dialog */}
      <Dialog open={showRetentionDialog} onOpenChange={(o) => { if (!o) closeRetentionDialog(); else setShowRetentionDialog(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRetention ? 'Edit Retention Policy' : 'New Retention Policy'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Policy Name *</Label>
              <Input
                value={retForm.name}
                onChange={(e) => setRetForm({ ...retForm, name: e.target.value })}
                placeholder="Policy name"
              />
            </div>

            <div className="space-y-1">
              <Label>Data Type</Label>
              <Select
                value={retForm.dataType}
                onValueChange={(v) => setRetForm({ ...retForm, dataType: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video_footage">Video Footage</SelectItem>
                  <SelectItem value="event_logs">Event Logs</SelectItem>
                  <SelectItem value="access_logs">Access Logs</SelectItem>
                  <SelectItem value="visitor_records">Visitor Records</SelectItem>
                  <SelectItem value="audit_logs">Audit Logs</SelectItem>
                  <SelectItem value="personal_data">Personal Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Retention Days *</Label>
                <Input
                  type="number"
                  min={1}
                  value={retForm.retentionDays}
                  onChange={(e) => setRetForm({ ...retForm, retentionDays: parseInt(e.target.value) || 365 })}
                />
              </div>
              <div className="space-y-1">
                <Label>Action After Expiry</Label>
                <Select
                  value={retForm.action}
                  onValueChange={(v) => setRetForm({ ...retForm, action: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="archive">Archive</SelectItem>
                    <SelectItem value="anonymize">Anonymize</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={retForm.isActive}
                onCheckedChange={(v) => setRetForm({ ...retForm, isActive: v })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRetentionDialog}>Cancel</Button>
            <Button
              onClick={handleRetentionSubmit}
              disabled={
                !retForm.name ||
                createRetention.isPending ||
                updateRetention.isPending
              }
            >
              {createRetention.isPending || updateRetention.isPending
                ? 'Saving...'
                : editingRetention
                ? 'Update Policy'
                : 'Create Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.type === 'template' ? 'Template' : 'Retention Policy'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.label}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget?.type === 'template') {
                  deleteTemplate.mutate(deleteTarget.id);
                } else if (deleteTarget) {
                  deleteRetention.mutate(deleteTarget.id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
