import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ErrorState from '@/components/ui/ErrorState';
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
  GraduationCap, Plus, Award, AlertTriangle, Users, Search,
  MoreHorizontal, Pencil, Trash2, CheckCircle, TrendingUp, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  trainingProgramsApi, certificationsApi, trainingStatsApi,
} from '@/services/training-api';

const certStatusColor: Record<string, string> = {
  enrolled: 'secondary',
  in_progress: 'default',
  completed: 'default',
  failed: 'destructive',
  expired: 'outline',
};

const categoryLabels: Record<string, string> = {
  safety: 'Safety',
  technology: 'Technology',
  compliance: 'Compliance',
  first_aid: 'First Aid',
  emergency: 'Emergency',
  firearms: 'Firearms',
  customer_service: 'Customer Service',
  security: 'Security',
  leadership: 'Leadership',
  other: 'Other',
};

const defaultProgramForm = {
  name: '',
  description: '',
  category: 'security' as string,
  durationHours: 8,
  isRequired: false,
  validityMonths: 12,
  passingScore: 70,
  isActive: true,
};

const defaultEnrollForm = {
  programId: '',
  userId: '',
  userName: '',
};

const defaultCompleteForm = {
  score: 0,
  notes: '',
};

export default function TrainingPage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  // UI state
  const [tab, setTab] = useState('programs');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [certStatusFilter, setCertStatusFilter] = useState('all');

  // Dialogs
  const [showProgramDialog, setShowProgramDialog] = useState(false);
  const [editingProgram, setEditingProgram] = useState<any>(null);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completingCert, setCompletingCert] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Forms
  const [progForm, setProgForm] = useState({ ...defaultProgramForm });
  const [enrollForm, setEnrollForm] = useState({ ...defaultEnrollForm });
  const [completeForm, setCompleteForm] = useState({ ...defaultCompleteForm });

  // Queries
  const { data: programs, isLoading: loadingPrograms, isError, error, refetch } = useQuery({
    queryKey: ['training-programs', categoryFilter],
    queryFn: () => trainingProgramsApi.list({
      ...(categoryFilter !== 'all' && { category: categoryFilter }),
    }),
  });

  const { data: certs, isLoading: loadingCerts } = useQuery({
    queryKey: ['certifications', certStatusFilter],
    queryFn: () => certificationsApi.list({
      ...(certStatusFilter !== 'all' && { status: certStatusFilter }),
    }),
  });

  const { data: expiring } = useQuery({
    queryKey: ['expiring-certs'],
    queryFn: () => certificationsApi.getExpiring(30),
  });

  const { data: stats } = useQuery({
    queryKey: ['training-stats'],
    queryFn: () => trainingStatsApi.get(),
  });

  // Mutations
  const createProgram = useMutation({
    mutationFn: (data: Record<string, unknown>) => trainingProgramsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-programs'] });
      qc.invalidateQueries({ queryKey: ['training-stats'] });
      closeProgramDialog();
      toast.success('Program created successfully');
    },
    onError: (err: Error) => toast.error(`Failed to create program: ${err.message}`),
  });

  const updateProgram = useMutation({
    mutationFn: ({ id, ...data }: any) => trainingProgramsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-programs'] });
      qc.invalidateQueries({ queryKey: ['training-stats'] });
      closeProgramDialog();
      toast.success('Program updated successfully');
    },
    onError: (err: Error) => toast.error(`Failed to update program: ${err.message}`),
  });

  const deleteProgram = useMutation({
    mutationFn: (id: string) => trainingProgramsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['training-programs'] });
      qc.invalidateQueries({ queryKey: ['training-stats'] });
      setDeleteTarget(null);
      toast.success('Program deleted');
    },
    onError: (err: Error) => toast.error(`Failed to delete program: ${err.message}`),
  });

  const enrollUser = useMutation({
    mutationFn: (data: { programId: string; userId: string; userName: string }) =>
      certificationsApi.enroll(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certifications'] });
      qc.invalidateQueries({ queryKey: ['training-stats'] });
      closeEnrollDialog();
      toast.success('User enrolled successfully');
    },
    onError: (err: Error) => toast.error(`Failed to enroll user: ${err.message}`),
  });

  const completeCert = useMutation({
    mutationFn: ({ id, score, notes }: { id: string; score: number; notes?: string }) =>
      certificationsApi.complete(id, { score, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certifications'] });
      qc.invalidateQueries({ queryKey: ['training-stats'] });
      qc.invalidateQueries({ queryKey: ['expiring-certs'] });
      closeCompleteDialog();
      toast.success('Certification completed');
    },
    onError: (err: Error) => toast.error(`Failed to complete certification: ${err.message}`),
  });

  // Dialog helpers
  const openCreateProgram = () => {
    setEditingProgram(null);
    setProgForm({ ...defaultProgramForm });
    setShowProgramDialog(true);
  };

  const openEditProgram = (p: any) => {
    setEditingProgram(p);
    setProgForm({
      name: p.name || '',
      description: p.description || '',
      category: p.category || 'security',
      durationHours: p.durationHours || 8,
      isRequired: p.isRequired ?? false,
      validityMonths: p.validityMonths || 12,
      passingScore: p.passingScore || 70,
      isActive: p.isActive ?? true,
    });
    setShowProgramDialog(true);
  };

  const closeProgramDialog = () => {
    setShowProgramDialog(false);
    setEditingProgram(null);
    setProgForm({ ...defaultProgramForm });
  };

  const openEnrollDialog = () => {
    setEnrollForm({ ...defaultEnrollForm });
    setShowEnrollDialog(true);
  };

  const closeEnrollDialog = () => {
    setShowEnrollDialog(false);
    setEnrollForm({ ...defaultEnrollForm });
  };

  const openCompleteDialog = (cert: any) => {
    setCompletingCert(cert);
    setCompleteForm({ score: 0, notes: '' });
    setShowCompleteDialog(true);
  };

  const closeCompleteDialog = () => {
    setShowCompleteDialog(false);
    setCompletingCert(null);
    setCompleteForm({ ...defaultCompleteForm });
  };

  const handleProgramSubmit = () => {
    if (editingProgram) {
      updateProgram.mutate({ id: editingProgram.id, ...progForm });
    } else {
      createProgram.mutate(progForm);
    }
  };

  // Filtering
  const filteredPrograms = (programs?.data || []).filter((p: any) => {
    if (search) {
      const s = search.toLowerCase();
      return (
        p.name?.toLowerCase().includes(s) ||
        p.description?.toLowerCase().includes(s) ||
        p.category?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const filteredCerts = (certs?.data || []).filter((c: any) => {
    if (search) {
      const s = search.toLowerCase();
      return (
        c.userName?.toLowerCase().includes(s) ||
        c.programName?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const s = stats?.data;
  const expiringCount = expiring?.data?.length ?? 0;

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Training & Certifications
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage training programs, enrollments, and certifications
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />Programs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.totalPrograms ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Training programs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Award className="h-4 w-4" />Certifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.totalCertifications ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Total issued</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />Compliance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(s?.complianceRate ?? 0) >= 80 ? 'text-success' : (s?.complianceRate ?? 0) >= 50 ? 'text-warning' : 'text-destructive'}`}>
              {s?.complianceRate ?? 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Completion rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />Expiring (30d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{expiringCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Need renewal</p>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Certifications Warning */}
      {expiringCount > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Expiring Certifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(expiring?.data || []).slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{c.userName}</span>
                    {c.programName && (
                      <span className="text-muted-foreground ml-2">- {c.programName}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-warning" />
                    <span className="text-xs text-muted-foreground">
                      Expires: {new Date(c.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {expiringCount > 5 && (
                <p className="text-xs text-muted-foreground mt-1">
                  ... and {expiringCount - 5} more
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="programs">
              <GraduationCap className="h-4 w-4 mr-1" />Programs
            </TabsTrigger>
            <TabsTrigger value="certifications">
              <Award className="h-4 w-4 mr-1" />Certifications
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {tab === 'programs' && (
              <Button size="sm" onClick={openCreateProgram}>
                <Plus className="h-4 w-4 mr-1" />New Program
              </Button>
            )}
            {tab === 'certifications' && (
              <Button size="sm" onClick={openEnrollDialog}>
                <Users className="h-4 w-4 mr-1" />Enroll User
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tab === 'programs' ? 'Search programs...' : 'Search certifications...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          {tab === 'programs' && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="safety">Safety</SelectItem>
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="first_aid">First Aid</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="firearms">Firearms</SelectItem>
                <SelectItem value="customer_service">Customer Service</SelectItem>
              </SelectContent>
            </Select>
          )}
          {tab === 'certifications' && (
            <Select value={certStatusFilter} onValueChange={setCertStatusFilter}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="enrolled">Enrolled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Programs Tab */}
        <TabsContent value="programs">
          <Card>
            <CardContent className="p-0">
              {loadingPrograms ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredPrograms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {(programs?.data || []).length === 0
                      ? 'No training programs yet'
                      : 'No programs match your filters'}
                  </p>
                  {(programs?.data || []).length === 0 && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={openCreateProgram}>
                      <Plus className="mr-1 h-3 w-3" />Create your first program
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Name</th>
                      <th className="p-3 text-left font-medium">Category</th>
                      <th className="p-3 text-left font-medium">Duration</th>
                      <th className="p-3 text-left font-medium">Pass Score</th>
                      <th className="p-3 text-left font-medium">Validity</th>
                      <th className="p-3 text-left font-medium">Required</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 w-10">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrograms.map((p: any) => (
                      <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <div className="font-medium">{p.name}</div>
                          {p.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                              {p.description}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize">
                            {categoryLabels[p.category] || p.category}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">
                          <span className="font-mono font-bold">{p.durationHours}</span>h
                        </td>
                        <td className="p-3 text-xs">
                          <span className="font-mono">{p.passingScore}%</span>
                        </td>
                        <td className="p-3 text-xs">
                          {p.validityMonths} months
                        </td>
                        <td className="p-3">
                          <Badge variant={p.isRequired ? 'destructive' : 'secondary'}>
                            {p.isRequired ? 'Required' : 'Optional'}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={p.isActive ? 'default' : 'secondary'}>
                            {p.isActive ? 'Active' : 'Inactive'}
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
                              <DropdownMenuItem onClick={() => openEditProgram(p)}>
                                <Pencil className="mr-2 h-3 w-3" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEnrollForm({ ...defaultEnrollForm, programId: p.id });
                                  setShowEnrollDialog(true);
                                }}
                              >
                                <Users className="mr-2 h-3 w-3" />Enroll User
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTarget(p)}
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
            {filteredPrograms.length} program(s) shown
          </div>
        </TabsContent>

        {/* Certifications Tab */}
        <TabsContent value="certifications">
          <Card>
            <CardContent className="p-0">
              {loadingCerts ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredCerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Award className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {(certs?.data || []).length === 0
                      ? 'No certifications yet'
                      : 'No certifications match your filters'}
                  </p>
                  {(certs?.data || []).length === 0 && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={openEnrollDialog}>
                      <Plus className="mr-1 h-3 w-3" />Enroll your first user
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">User</th>
                      <th className="p-3 text-left font-medium">Program</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Score</th>
                      <th className="p-3 text-left font-medium">Enrolled</th>
                      <th className="p-3 text-left font-medium">Completed</th>
                      <th className="p-3 text-left font-medium">Expires</th>
                      <th className="p-3 w-10">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCerts.map((c: any) => {
                      const isExpiringSoon =
                        c.expiresAt &&
                        new Date(c.expiresAt) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
                        new Date(c.expiresAt) > new Date();
                      const isExpired =
                        c.expiresAt && new Date(c.expiresAt) <= new Date();

                      return (
                        <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium">{c.userName}</td>
                          <td className="p-3 text-xs">{c.programName || '-'}</td>
                          <td className="p-3">
                            <Badge variant={certStatusColor[c.status] as any} className="capitalize">
                              {c.status?.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs">
                            {c.score != null ? (
                              <span className={`font-mono font-bold ${c.score >= (c.passingScore || 70) ? 'text-success' : 'text-destructive'}`}>
                                {c.score}%
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-3 text-xs">
                            {c.enrolledAt
                              ? new Date(c.enrolledAt).toLocaleDateString()
                              : c.createdAt
                              ? new Date(c.createdAt).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className="p-3 text-xs">
                            {c.completedAt
                              ? new Date(c.completedAt).toLocaleDateString()
                              : '-'}
                          </td>
                          <td className="p-3 text-xs">
                            {c.expiresAt ? (
                              <span
                                className={
                                  isExpired
                                    ? 'text-destructive font-bold'
                                    : isExpiringSoon
                                    ? 'text-warning font-medium'
                                    : ''
                                }
                              >
                                {new Date(c.expiresAt).toLocaleDateString()}
                                {isExpired && ' (Expired)'}
                                {isExpiringSoon && !isExpired && ' (Soon)'}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-3">
                            {(c.status === 'enrolled' || c.status === 'in_progress') && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openCompleteDialog(c)}>
                                    <CheckCircle className="mr-2 h-3 w-3" />Complete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <div className="text-xs text-muted-foreground mt-2">
            {filteredCerts.length} certification(s) shown
          </div>
        </TabsContent>
      </Tabs>

      {/* Program Create/Edit Dialog */}
      <Dialog open={showProgramDialog} onOpenChange={(o) => { if (!o) closeProgramDialog(); else setShowProgramDialog(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProgram ? 'Edit Program' : 'New Training Program'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Program Name *</Label>
              <Input
                value={progForm.name}
                onChange={(e) => setProgForm({ ...progForm, name: e.target.value })}
                placeholder="Program name"
              />
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={progForm.description}
                onChange={(e) => setProgForm({ ...progForm, description: e.target.value })}
                placeholder="Training program description..."
              />
            </div>

            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={progForm.category}
                onValueChange={(v) => setProgForm({ ...progForm, category: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="first_aid">First Aid</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="firearms">Firearms</SelectItem>
                  <SelectItem value="customer_service">Customer Service</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Duration (hours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={progForm.durationHours}
                  onChange={(e) => setProgForm({ ...progForm, durationHours: parseInt(e.target.value) || 8 })}
                />
              </div>
              <div className="space-y-1">
                <Label>Passing Score (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={progForm.passingScore}
                  onChange={(e) => setProgForm({ ...progForm, passingScore: parseInt(e.target.value) || 70 })}
                />
              </div>
              <div className="space-y-1">
                <Label>Validity (months)</Label>
                <Input
                  type="number"
                  min={0}
                  value={progForm.validityMonths}
                  onChange={(e) => setProgForm({ ...progForm, validityMonths: parseInt(e.target.value) || 12 })}
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={progForm.isRequired}
                  onCheckedChange={(v) => setProgForm({ ...progForm, isRequired: v })}
                />
                <Label>Required Training</Label>
              </div>
              {editingProgram && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={progForm.isActive}
                    onCheckedChange={(v) => setProgForm({ ...progForm, isActive: v })}
                  />
                  <Label>Active</Label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeProgramDialog}>Cancel</Button>
            <Button
              onClick={handleProgramSubmit}
              disabled={
                !progForm.name ||
                createProgram.isPending ||
                updateProgram.isPending
              }
            >
              {createProgram.isPending || updateProgram.isPending
                ? 'Saving...'
                : editingProgram
                ? 'Update Program'
                : 'Create Program'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll User Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={(o) => { if (!o) closeEnrollDialog(); else setShowEnrollDialog(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll User in Training Program</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Select Program *</Label>
              <Select
                value={enrollForm.programId}
                onValueChange={(v) => setEnrollForm({ ...enrollForm, programId: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select a program..." /></SelectTrigger>
                <SelectContent>
                  {(programs?.data || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.isRequired && ' (Required)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>User ID *</Label>
              <Input
                value={enrollForm.userId}
                onChange={(e) => setEnrollForm({ ...enrollForm, userId: e.target.value })}
                placeholder="User UUID"
              />
            </div>
            <div className="space-y-1">
              <Label>User Name *</Label>
              <Input
                value={enrollForm.userName}
                onChange={(e) => setEnrollForm({ ...enrollForm, userName: e.target.value })}
                placeholder="Full name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEnrollDialog}>Cancel</Button>
            <Button
              onClick={() =>
                enrollUser.mutate({
                  programId: enrollForm.programId,
                  userId: enrollForm.userId,
                  userName: enrollForm.userName,
                })
              }
              disabled={
                !enrollForm.programId ||
                !enrollForm.userId ||
                !enrollForm.userName ||
                enrollUser.isPending
              }
            >
              {enrollUser.isPending ? 'Enrolling...' : 'Enroll User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Certification Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={(o) => { if (!o) closeCompleteDialog(); else setShowCompleteDialog(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Certification</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {completingCert && (
              <div className="p-3 rounded-md bg-muted/50 text-sm">
                <div className="font-medium">{completingCert.userName}</div>
                {completingCert.programName && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Program: {completingCert.programName}
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label>Score (0-100) *</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={completeForm.score}
                onChange={(e) => setCompleteForm({ ...completeForm, score: parseInt(e.target.value) || 0 })}
                placeholder="Enter score"
              />
              {completingCert?.passingScore && (
                <p className="text-xs text-muted-foreground">
                  Passing score: {completingCert.passingScore}%
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={completeForm.notes}
                onChange={(e) => setCompleteForm({ ...completeForm, notes: e.target.value })}
                placeholder="Evaluation notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCompleteDialog}>Cancel</Button>
            <Button
              onClick={() =>
                completeCert.mutate({
                  id: completingCert.id,
                  score: completeForm.score,
                  notes: completeForm.notes || undefined,
                })
              }
              disabled={completeCert.isPending}
            >
              {completeCert.isPending ? 'Completing...' : 'Complete Certification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Program Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training Program</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete program "{deleteTarget?.name}"?
              This will not remove existing certifications but new enrollments will not be possible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteProgram.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
