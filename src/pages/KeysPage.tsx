import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  KeyRound, Plus, ArrowRightLeft, History, Search, MoreHorizontal,
  Pencil, Trash2, RotateCcw, AlertTriangle, MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { keysApi, keyLogsApi } from '@/services/keys-api';

const statusColor: Record<string, string> = {
  available: 'default',
  assigned: 'secondary',
  lost: 'destructive',
  retired: 'outline',
};

const statusTextColor: Record<string, string> = {
  available: 'text-success',
  assigned: 'text-primary',
  lost: 'text-destructive',
  retired: 'text-gray-500',
};

const actionColor: Record<string, string> = {
  assigned: 'default',
  returned: 'default',
  reported_lost: 'destructive',
  transferred: 'outline',
  retired: 'secondary',
  created: 'secondary',
};

const defaultKeyForm = {
  keyCode: '',
  label: '',
  description: '',
  keyType: 'access' as string,
  location: '',
  copies: 1,
  notes: '',
};

export default function KeysPage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  // UI state
  const [tab, setTab] = useState('inventory');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Dialogs
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [editingKey, setEditingKey] = useState<any>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnTarget, setReturnTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  // Forms
  const [keyForm, setKeyForm] = useState({ ...defaultKeyForm });
  const [assignHolder, setAssignHolder] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  // Queries
  const { data: keys, isLoading: loadingKeys } = useQuery({
    queryKey: ['keys', statusFilter, typeFilter],
    queryFn: () => keysApi.list({
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(typeFilter !== 'all' && { keyType: typeFilter }),
    }),
  });

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ['key-logs'],
    queryFn: () => keyLogsApi.list(),
  });

  const { data: stats } = useQuery({
    queryKey: ['key-stats'],
    queryFn: () => keysApi.getStats(),
  });

  // Mutations
  const createKey = useMutation({
    mutationFn: (data: Record<string, unknown>) => keysApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keys'] });
      qc.invalidateQueries({ queryKey: ['key-stats'] });
      closeKeyDialog();
      toast.success('Key created successfully');
    },
    onError: (err: Error) => toast.error(`Failed to create key: ${err.message}`),
  });

  const updateKey = useMutation({
    mutationFn: ({ id, ...data }: any) => keysApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keys'] });
      qc.invalidateQueries({ queryKey: ['key-stats'] });
      closeKeyDialog();
      toast.success('Key updated successfully');
    },
    onError: (err: Error) => toast.error(`Failed to update key: ${err.message}`),
  });

  const deleteKey = useMutation({
    mutationFn: (id: string) => keysApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keys'] });
      qc.invalidateQueries({ queryKey: ['key-stats'] });
      setDeleteTarget(null);
      toast.success('Key deleted');
    },
    onError: (err: Error) => toast.error(`Failed to delete key: ${err.message}`),
  });

  const assignKey = useMutation({
    mutationFn: ({ id, toHolder, notes }: { id: string; toHolder: string; notes?: string }) =>
      keysApi.assign(id, { toHolder, notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keys'] });
      qc.invalidateQueries({ queryKey: ['key-logs'] });
      qc.invalidateQueries({ queryKey: ['key-stats'] });
      closeAssignDialog();
      toast.success('Key assigned successfully');
    },
    onError: (err: Error) => toast.error(`Failed to assign key: ${err.message}`),
  });

  const returnKey = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      keysApi.returnKey(id, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keys'] });
      qc.invalidateQueries({ queryKey: ['key-logs'] });
      qc.invalidateQueries({ queryKey: ['key-stats'] });
      closeReturnDialog();
      toast.success('Key returned successfully');
    },
    onError: (err: Error) => toast.error(`Failed to return key: ${err.message}`),
  });

  const reportLost = useMutation({
    mutationFn: (id: string) => keysApi.update(id, { status: 'lost' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['keys'] });
      qc.invalidateQueries({ queryKey: ['key-stats'] });
      toast.success('Key reported as lost');
    },
    onError: (err: Error) => toast.error(`Failed to report key: ${err.message}`),
  });

  // Dialog helpers
  const openCreateKey = () => {
    setEditingKey(null);
    setKeyForm({ ...defaultKeyForm });
    setShowKeyDialog(true);
  };

  const openEditKey = (k: any) => {
    setEditingKey(k);
    setKeyForm({
      keyCode: k.keyCode || '',
      label: k.label || '',
      description: k.description || '',
      keyType: k.keyType || 'access',
      location: k.location || '',
      copies: k.copies || 1,
      notes: k.notes || '',
    });
    setShowKeyDialog(true);
  };

  const closeKeyDialog = () => {
    setShowKeyDialog(false);
    setEditingKey(null);
    setKeyForm({ ...defaultKeyForm });
  };

  const openAssignDialog = (k: any) => {
    setAssignTarget(k);
    setAssignHolder('');
    setAssignNotes('');
    setShowAssignDialog(true);
  };

  const closeAssignDialog = () => {
    setShowAssignDialog(false);
    setAssignTarget(null);
    setAssignHolder('');
    setAssignNotes('');
  };

  const openReturnDialog = (k: any) => {
    setReturnTarget(k);
    setReturnNotes('');
    setShowReturnDialog(true);
  };

  const closeReturnDialog = () => {
    setShowReturnDialog(false);
    setReturnTarget(null);
    setReturnNotes('');
  };

  const handleKeySubmit = () => {
    if (editingKey) {
      updateKey.mutate({ id: editingKey.id, ...keyForm });
    } else {
      createKey.mutate(keyForm);
    }
  };

  // Filtering
  const filteredKeys = (keys?.data || []).filter((k: any) => {
    if (search) {
      const s = search.toLowerCase();
      return (
        k.keyCode?.toLowerCase().includes(s) ||
        k.label?.toLowerCase().includes(s) ||
        k.location?.toLowerCase().includes(s) ||
        k.currentHolder?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const filteredLogs = (logs?.data || []).filter((l: any) => {
    if (search) {
      const s = search.toLowerCase();
      return (
        l.fromHolder?.toLowerCase().includes(s) ||
        l.toHolder?.toLowerCase().includes(s) ||
        l.notes?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const s = stats?.data;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <KeyRound className="h-6 w-6" />
            Key Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Track physical keys, assignments, and audit trail
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <KeyRound className="h-4 w-4" />Total Keys
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.total ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered in system</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{s?.available ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready to assign</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{s?.assigned ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently held</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />Lost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{s?.lost ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Reported missing</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="inventory">
              <KeyRound className="h-4 w-4 mr-1" />Inventory
            </TabsTrigger>
            <TabsTrigger value="logs">
              <History className="h-4 w-4 mr-1" />Activity Log
            </TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={openCreateKey}>
            <Plus className="h-4 w-4 mr-1" />Add Key
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search keys, holders, locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          {tab === 'inventory' && (
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="master">Master</SelectItem>
                  <SelectItem value="access">Access</SelectItem>
                  <SelectItem value="cabinet">Cabinet</SelectItem>
                  <SelectItem value="vehicle">Vehicle</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {/* Inventory Tab */}
        <TabsContent value="inventory">
          <Card>
            <CardContent className="p-0">
              {loadingKeys ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredKeys.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <KeyRound className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {(keys?.data || []).length === 0
                      ? 'No keys registered yet'
                      : 'No keys match your filters'}
                  </p>
                  {(keys?.data || []).length === 0 && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={openCreateKey}>
                      <Plus className="mr-1 h-3 w-3" />Add your first key
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Code</th>
                      <th className="p-3 text-left font-medium">Label</th>
                      <th className="p-3 text-left font-medium">Type</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Holder</th>
                      <th className="p-3 text-left font-medium">Location</th>
                      <th className="p-3 text-left font-medium">Copies</th>
                      <th className="p-3 w-10">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredKeys.map((k: any) => (
                      <tr key={k.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-xs font-bold">{k.keyCode}</td>
                        <td className="p-3">
                          <div className="font-medium">{k.label}</div>
                          {k.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {k.description}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize">{k.keyType}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={statusColor[k.status] as any} className="capitalize">
                            {k.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {k.currentHolder ? (
                            <span className="font-medium">{k.currentHolder}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 text-xs">
                          {k.location ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {k.location}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 text-center text-xs">{k.copies ?? 1}</td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditKey(k)}>
                                <Pencil className="mr-2 h-3 w-3" />Edit
                              </DropdownMenuItem>
                              {k.status === 'available' && (
                                <DropdownMenuItem onClick={() => openAssignDialog(k)}>
                                  <ArrowRightLeft className="mr-2 h-3 w-3" />Assign
                                </DropdownMenuItem>
                              )}
                              {k.status === 'assigned' && (
                                <>
                                  <DropdownMenuItem onClick={() => openReturnDialog(k)}>
                                    <RotateCcw className="mr-2 h-3 w-3" />Return
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-warning"
                                    onClick={() => reportLost.mutate(k.id)}
                                  >
                                    <AlertTriangle className="mr-2 h-3 w-3" />Report Lost
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTarget(k)}
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
            {filteredKeys.length} key(s) shown
          </div>
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardContent className="p-0">
              {loadingLogs ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <History className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No activity logs yet</p>
                  <p className="text-xs mt-1">Logs will appear when keys are assigned or returned</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Key</th>
                      <th className="p-3 text-left font-medium">Action</th>
                      <th className="p-3 text-left font-medium">From</th>
                      <th className="p-3 text-left font-medium">To</th>
                      <th className="p-3 text-left font-medium">Notes</th>
                      <th className="p-3 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((l: any) => (
                      <tr key={l.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-xs">{l.keyCode || '-'}</td>
                        <td className="p-3">
                          <Badge variant={actionColor[l.action] as any} className="capitalize">
                            {l.action?.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="p-3">{l.fromHolder || '-'}</td>
                        <td className="p-3">{l.toHolder || '-'}</td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">
                          {l.notes || '-'}
                        </td>
                        <td className="p-3 text-xs">
                          {new Date(l.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <div className="text-xs text-muted-foreground mt-2">
            {filteredLogs.length} log entry(ies) shown
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Key Dialog */}
      <Dialog open={showKeyDialog} onOpenChange={(o) => { if (!o) closeKeyDialog(); else setShowKeyDialog(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingKey ? 'Edit Key' : 'Add New Key'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Key Code *</Label>
                <Input
                  value={keyForm.keyCode}
                  onChange={(e) => setKeyForm({ ...keyForm, keyCode: e.target.value })}
                  placeholder="KEY-001"
                />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={keyForm.keyType}
                  onValueChange={(v) => setKeyForm({ ...keyForm, keyType: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="master">Master</SelectItem>
                    <SelectItem value="access">Access</SelectItem>
                    <SelectItem value="cabinet">Cabinet</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Label *</Label>
              <Input
                value={keyForm.label}
                onChange={(e) => setKeyForm({ ...keyForm, label: e.target.value })}
                placeholder="Key description / name"
              />
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <textarea
                className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={keyForm.description}
                onChange={(e) => setKeyForm({ ...keyForm, description: e.target.value })}
                placeholder="Additional details..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Location</Label>
                <Input
                  value={keyForm.location}
                  onChange={(e) => setKeyForm({ ...keyForm, location: e.target.value })}
                  placeholder="Building / Room"
                />
              </div>
              <div className="space-y-1">
                <Label>Copies</Label>
                <Input
                  type="number"
                  min={1}
                  value={keyForm.copies}
                  onChange={(e) => setKeyForm({ ...keyForm, copies: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeKeyDialog}>Cancel</Button>
            <Button
              onClick={handleKeySubmit}
              disabled={
                !keyForm.keyCode ||
                !keyForm.label ||
                createKey.isPending ||
                updateKey.isPending
              }
            >
              {createKey.isPending || updateKey.isPending
                ? 'Saving...'
                : editingKey
                ? 'Update Key'
                : 'Add Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Key Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={(o) => { if (!o) closeAssignDialog(); else setShowAssignDialog(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign Key: {assignTarget?.keyCode}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="p-3 rounded-md bg-muted/50 text-sm">
              <span className="font-medium">{assignTarget?.label}</span>
              {assignTarget?.location && (
                <span className="text-muted-foreground"> - {assignTarget.location}</span>
              )}
            </div>
            <div className="space-y-1">
              <Label>Assign to *</Label>
              <Input
                value={assignHolder}
                onChange={(e) => setAssignHolder(e.target.value)}
                placeholder="Person name or ID"
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={assignNotes}
                onChange={(e) => setAssignNotes(e.target.value)}
                placeholder="Reason for assignment..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAssignDialog}>Cancel</Button>
            <Button
              onClick={() =>
                assignKey.mutate({
                  id: assignTarget.id,
                  toHolder: assignHolder,
                  notes: assignNotes || undefined,
                })
              }
              disabled={!assignHolder || assignKey.isPending}
            >
              {assignKey.isPending ? 'Assigning...' : 'Assign Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Key Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={(o) => { if (!o) closeReturnDialog(); else setShowReturnDialog(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Return Key: {returnTarget?.keyCode}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="p-3 rounded-md bg-muted/50 text-sm">
              <div>
                <span className="font-medium">{returnTarget?.label}</span>
              </div>
              <div className="text-muted-foreground mt-1">
                Currently held by: <span className="font-medium text-foreground">{returnTarget?.currentHolder}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Condition / Notes</Label>
              <textarea
                className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Key condition, notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeReturnDialog}>Cancel</Button>
            <Button
              onClick={() =>
                returnKey.mutate({
                  id: returnTarget.id,
                  notes: returnNotes || undefined,
                })
              }
              disabled={returnKey.isPending}
            >
              {returnKey.isPending ? 'Processing...' : 'Return Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete key "{deleteTarget?.keyCode} - {deleteTarget?.label}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteKey.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
