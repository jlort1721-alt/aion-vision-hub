import { useState, useMemo } from 'react';
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
  FileText, DollarSign, Plus, CheckCircle, Receipt, Search, MoreHorizontal,
  Pencil, Trash2, AlertTriangle, TrendingUp, Paperclip, Upload, Download, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { contractsApi, invoicesApi } from '@/services/contracts-api';
import { evidenceApi } from '@/services/evidence-api';

const fmt = (v: string | number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(v));

const contractStatusColor: Record<string, string> = {
  draft: 'secondary',
  active: 'default',
  suspended: 'outline',
  terminated: 'destructive',
  expired: 'secondary',
};

const invoiceStatusColor: Record<string, string> = {
  draft: 'secondary',
  sent: 'default',
  paid: 'default',
  overdue: 'destructive',
  cancelled: 'secondary',
  credited: 'outline',
};

const defaultContractForm = {
  contractNumber: '',
  clientName: '',
  clientDocument: '',
  clientEmail: '',
  clientPhone: '',
  type: 'monthly' as string,
  status: 'draft' as string,
  startDate: '',
  endDate: '',
  monthlyAmount: '',
  currency: 'COP',
  paymentTerms: 'net_30' as string,
  autoRenew: false,
  notes: '',
  services: [] as string[],
};

const defaultInvoiceForm = {
  invoiceNumber: '',
  contractId: '',
  status: 'draft' as string,
  issueDate: '',
  dueDate: '',
  subtotal: '',
  taxRate: '19',
  currency: 'COP',
  notes: '',
  lineItems: [] as { description: string; quantity: number; unitPrice: number }[],
};

export default function ContractsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();

  // UI state
  const [tab, setTab] = useState('contracts');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [invStatusFilter, setInvStatusFilter] = useState('all');

  // Dialogs
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [editingContract, setEditingContract] = useState<any>(null);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'contract' | 'invoice'; id: string; label: string } | null>(null);

  // Forms
  const [contractForm, setContractForm] = useState({ ...defaultContractForm });
  const [invoiceForm, setInvoiceForm] = useState({ ...defaultInvoiceForm });

  // Attachments state
  const [attachments, setAttachments] = useState<{ name: string; size: number; uploadedAt: string; url?: string }[]>([]);
  const [showExpiringDetails, setShowExpiringDetails] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Queries
  const { data: contracts, isLoading: loadingContracts, isError, error, refetch } = useQuery({
    queryKey: ['contracts', statusFilter, typeFilter],
    queryFn: () => contractsApi.list({
      ...(statusFilter !== 'all' && { status: statusFilter }),
    }),
  });

  const { data: invoiceData, isLoading: loadingInvoices } = useQuery({
    queryKey: ['invoices', invStatusFilter],
    queryFn: () => invoicesApi.list({
      ...(invStatusFilter !== 'all' && { status: invStatusFilter }),
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['contract-stats'],
    queryFn: () => contractsApi.getStats(),
  });

  const { data: invStats } = useQuery({
    queryKey: ['invoice-stats'],
    queryFn: () => invoicesApi.getStats(),
  });

  // Mutations
  const createContract = useMutation({
    mutationFn: (data: Record<string, unknown>) => contractsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['contract-stats'] });
      closeContractDialog();
      toast.success('Contrato creado exitosamente');
    },
    onError: (err: Error) => toast.error(`Error al crear contrato: ${err.message}`),
  });

  const updateContract = useMutation({
    mutationFn: ({ id, ...data }: any) => contractsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['contract-stats'] });
      closeContractDialog();
      toast.success('Contrato actualizado');
    },
    onError: (err: Error) => toast.error(`Error al actualizar contrato: ${err.message}`),
  });

  const deleteContract = useMutation({
    mutationFn: (id: string) => contractsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] });
      qc.invalidateQueries({ queryKey: ['contract-stats'] });
      setDeleteTarget(null);
      toast.success('Contrato eliminado');
    },
    onError: (err: Error) => toast.error(`Error al eliminar contrato: ${err.message}`),
  });

  const createInvoice = useMutation({
    mutationFn: (data: Record<string, unknown>) => invoicesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice-stats'] });
      closeInvoiceDialog();
      toast.success('Factura creada exitosamente');
    },
    onError: (err: Error) => toast.error(`Error al crear factura: ${err.message}`),
  });

  const updateInvoice = useMutation({
    mutationFn: ({ id, ...data }: any) => invoicesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice-stats'] });
      closeInvoiceDialog();
      toast.success('Factura actualizada');
    },
    onError: (err: Error) => toast.error(`Error al actualizar factura: ${err.message}`),
  });

  const deleteInvoice = useMutation({
    mutationFn: (id: string) => invoicesApi.update(id, { status: 'cancelled' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice-stats'] });
      setDeleteTarget(null);
      toast.success('Factura cancelada');
    },
    onError: (err: Error) => toast.error(`Error al cancelar factura: ${err.message}`),
  });

  const markPaid = useMutation({
    mutationFn: ({ id, ...data }: any) => invoicesApi.markPaid(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice-stats'] });
      toast.success('Factura marcada como pagada');
    },
    onError: (err: Error) => toast.error(`Error al marcar como pagada: ${err.message}`),
  });

  // Dialog helpers
  const openCreateContract = () => {
    setEditingContract(null);
    setContractForm({ ...defaultContractForm });
    setShowContractDialog(true);
  };

  const openEditContract = (c: any) => {
    setEditingContract(c);
    setContractForm({
      contractNumber: c.contractNumber || '',
      clientName: c.clientName || '',
      clientDocument: c.clientDocument || '',
      clientEmail: c.clientEmail || '',
      clientPhone: c.clientPhone || '',
      type: c.type || 'monthly',
      status: c.status || 'draft',
      startDate: c.startDate || '',
      endDate: c.endDate || '',
      monthlyAmount: c.monthlyAmount || '',
      currency: c.currency || 'COP',
      paymentTerms: c.paymentTerms || 'net_30',
      autoRenew: c.autoRenew || false,
      notes: c.notes || '',
      services: c.services || [],
    });
    setShowContractDialog(true);
  };

  const closeContractDialog = () => {
    setShowContractDialog(false);
    setEditingContract(null);
    setContractForm({ ...defaultContractForm });
  };

  const openCreateInvoice = () => {
    setEditingInvoice(null);
    setInvoiceForm({ ...defaultInvoiceForm });
    setShowInvoiceDialog(true);
  };

  const openEditInvoice = (inv: any) => {
    setEditingInvoice(inv);
    setInvoiceForm({
      invoiceNumber: inv.invoiceNumber || '',
      contractId: inv.contractId || '',
      status: inv.status || 'draft',
      issueDate: inv.issueDate || '',
      dueDate: inv.dueDate || '',
      subtotal: inv.subtotal || '',
      taxRate: inv.taxRate || '19',
      currency: inv.currency || 'COP',
      notes: inv.notes || '',
      lineItems: inv.lineItems || [],
    });
    setShowInvoiceDialog(true);
  };

  const closeInvoiceDialog = () => {
    setShowInvoiceDialog(false);
    setEditingInvoice(null);
    setInvoiceForm({ ...defaultInvoiceForm });
  };

  const handleContractSubmit = () => {
    if (editingContract) {
      updateContract.mutate({ id: editingContract.id, ...contractForm });
    } else {
      createContract.mutate(contractForm);
    }
  };

  const handleInvoiceSubmit = () => {
    if (editingInvoice) {
      updateInvoice.mutate({ id: editingInvoice.id, ...invoiceForm });
    } else {
      createInvoice.mutate(invoiceForm);
    }
  };

  // Filtering
  const filteredContracts = (contracts?.data || []).filter((c: any) => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        c.contractNumber?.toLowerCase().includes(s) ||
        c.clientName?.toLowerCase().includes(s) ||
        c.clientEmail?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const filteredInvoices = (invoiceData?.data || []).filter((inv: any) => {
    if (search) {
      const s = search.toLowerCase();
      return inv.invoiceNumber?.toLowerCase().includes(s);
    }
    return true;
  });

  const s = stats?.data as Record<string, unknown> | undefined;
  const is_ = invStats?.data as Record<string, unknown> | undefined;

  // ── Expiry alert computation ──────────────────────────────
  const expiringContracts = useMemo(() => {
    const allContracts = contracts?.data || [];
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return allContracts.filter((c: any) => {
      if (!c.endDate) return false;
      const endDate = new Date(c.endDate);
      return endDate >= now && endDate <= thirtyDaysFromNow;
    });
  }, [contracts?.data]);

  // ── Attachment upload handler ─────────────────────────────
  const handleAttachmentUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const newAttachments: typeof attachments = [];
    for (const file of Array.from(files)) {
      try {
        await evidenceApi.create({
          incident_id: editingContract?.id || 'contract-attachment',
          type: 'document',
          file_name: file.name,
          mime_type: file.type,
          description: `Contract attachment: ${file.name}`,
        });
        newAttachments.push({
          name: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });
      } catch {
        toast.error(`Error al subir ${file.name}`);
      }
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    setUploading(false);
    if (newAttachments.length > 0) {
      toast.success(`${newAttachments.length} archivo(s) adjuntado(s)`);
    }
  };

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Contratos y Facturación
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestione contratos, facturas y cobros
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />Contratos Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.active ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {s?.total ?? 0} contratos en total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />Ingreso Mensual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(s?.monthlyRevenue ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Valor recurrente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />Facturas Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {(is_?.sent ?? 0) + (is_?.overdue ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {is_?.overdue ?? 0} vencidas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-success" />Total Recaudado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{fmt(is_?.collected ?? 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Facturas pagadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Expiring soon warning — computed from live data */}
      {expiringContracts.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                {expiringContracts.length} contrato(s) vencen en los próximos 30 días
              </span>
              <Button
                variant="link"
                size="sm"
                className="text-warning p-0 h-auto"
                onClick={() => setShowExpiringDetails(true)}
              >
                Ver detalles
              </Button>
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Expiring Contracts Detail Dialog */}
      <Dialog open={showExpiringDetails} onOpenChange={setShowExpiringDetails}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Contratos por Vencer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {expiringContracts.map((c: any) => {
              const daysLeft = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <div key={c.id} className="p-3 rounded-md border flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{c.contractNumber} - {c.clientName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Vence: {new Date(c.endDate).toLocaleDateString('es-CO')}
                    </div>
                  </div>
                  <Badge variant={daysLeft <= 7 ? 'destructive' : 'secondary'} className="text-xs">
                    {daysLeft} día(s)
                  </Badge>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="contracts">
              <FileText className="h-4 w-4 mr-1" />Contratos
            </TabsTrigger>
            <TabsTrigger value="invoices">
              <Receipt className="h-4 w-4 mr-1" />Facturas
            </TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            {tab === 'contracts' && (
              <Button size="sm" onClick={openCreateContract}>
                <Plus className="h-4 w-4 mr-1" />Nuevo Contrato
              </Button>
            )}
            {tab === 'invoices' && (
              <Button size="sm" onClick={openCreateInvoice}>
                <Plus className="h-4 w-4 mr-1" />Nueva Factura
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={tab === 'contracts' ? 'Buscar contratos...' : 'Buscar facturas...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          {tab === 'contracts' && (
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo Estado</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="suspended">Suspendido</SelectItem>
                  <SelectItem value="terminated">Terminado</SelectItem>
                  <SelectItem value="expired">Vencido</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Tipos</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                  <SelectItem value="one_time">Único</SelectItem>
                  <SelectItem value="project">Proyecto</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          {tab === 'invoices' && (
            <Select value={invStatusFilter} onValueChange={setInvStatusFilter}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo Estado</SelectItem>
                <SelectItem value="draft">Borrador</SelectItem>
                <SelectItem value="sent">Enviada</SelectItem>
                <SelectItem value="paid">Pagada</SelectItem>
                <SelectItem value="overdue">Vencida</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Contracts Tab */}
        <TabsContent value="contracts">
          <Card>
            <CardContent className="p-0">
              {loadingContracts ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredContracts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {(contracts?.data || []).length === 0
                      ? 'No contracts yet'
                      : 'No contracts match your filters'}
                  </p>
                  {(contracts?.data || []).length === 0 && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={openCreateContract}>
                      <Plus className="mr-1 h-3 w-3" />Create your first contract
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">#</th>
                      <th className="p-3 text-left font-medium">Client</th>
                      <th className="p-3 text-left font-medium">Type</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-right font-medium">Monthly</th>
                      <th className="p-3 text-left font-medium">Start</th>
                      <th className="p-3 text-left font-medium">End</th>
                      <th className="p-3 text-left font-medium">Auto-Renew</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContracts.map((c: any) => (
                      <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-xs">{c.contractNumber}</td>
                        <td className="p-3">
                          <div className="font-medium">{c.clientName}</div>
                          {c.clientEmail && (
                            <div className="text-xs text-muted-foreground">{c.clientEmail}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize">{c.type?.replace('_', ' ')}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant={contractStatusColor[c.status] as "default" | "secondary" | "destructive" | "outline"} className="capitalize">
                            {c.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-mono">{fmt(c.monthlyAmount)}</td>
                        <td className="p-3 text-xs">{c.startDate}</td>
                        <td className="p-3 text-xs">{c.endDate || '-'}</td>
                        <td className="p-3 text-center">
                          {c.autoRenew ? (
                            <Badge variant="default" className="text-[10px]">Yes</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">No</span>
                          )}
                        </td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditContract(c)}>
                                <Pencil className="mr-2 h-3 w-3" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: 'contract',
                                    id: c.id,
                                    label: c.contractNumber,
                                  })
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
            {filteredContracts.length} contract(s) shown
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <Card>
            <CardContent className="p-0">
              {loadingInvoices ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Receipt className="h-12 w-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">
                    {(invoiceData?.data || []).length === 0
                      ? 'No invoices yet'
                      : 'No invoices match your filters'}
                  </p>
                  {(invoiceData?.data || []).length === 0 && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={openCreateInvoice}>
                      <Plus className="mr-1 h-3 w-3" />Create your first invoice
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">#</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-right font-medium">Total</th>
                      <th className="p-3 text-left font-medium">Issue Date</th>
                      <th className="p-3 text-left font-medium">Due Date</th>
                      <th className="p-3 text-left font-medium">Paid</th>
                      <th className="p-3 w-10">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv: any) => (
                      <tr key={inv.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-mono text-xs">{inv.invoiceNumber}</td>
                        <td className="p-3">
                          <Badge
                            variant={invoiceStatusColor[inv.status] as "default" | "secondary" | "destructive" | "outline"}
                            className="capitalize"
                          >
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-mono">{fmt(inv.totalAmount)}</td>
                        <td className="p-3 text-xs">{inv.issueDate}</td>
                        <td className="p-3 text-xs">{inv.dueDate}</td>
                        <td className="p-3 text-xs">
                          {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditInvoice(inv)}>
                                <Pencil className="mr-2 h-3 w-3" />Edit
                              </DropdownMenuItem>
                              {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    markPaid.mutate({
                                      id: inv.id,
                                      paymentMethod: 'transfer',
                                      paidAmount: String(inv.totalAmount),
                                    })
                                  }
                                >
                                  <CheckCircle className="mr-2 h-3 w-3" />Mark as Paid
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {inv.status !== 'cancelled' && (
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: 'invoice',
                                      id: inv.id,
                                      label: inv.invoiceNumber,
                                    })
                                  }
                                >
                                  <Trash2 className="mr-2 h-3 w-3" />Cancel
                                </DropdownMenuItem>
                              )}
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
            {filteredInvoices.length} invoice(s) shown
          </div>
        </TabsContent>
      </Tabs>

      {/* Contract Create/Edit Dialog */}
      <Dialog open={showContractDialog} onOpenChange={(o) => { if (!o) closeContractDialog(); else setShowContractDialog(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContract ? 'Edit Contract' : 'Nuevo Contrato'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Contract Number *</Label>
                <Input
                  value={contractForm.contractNumber}
                  onChange={(e) => setContractForm({ ...contractForm, contractNumber: e.target.value })}
                  placeholder="CTR-001"
                />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={contractForm.type}
                  onValueChange={(v) => setContractForm({ ...contractForm, type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="one_time">One Time</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Client Name *</Label>
              <Input
                value={contractForm.clientName}
                onChange={(e) => setContractForm({ ...contractForm, clientName: e.target.value })}
                placeholder="Nombre del cliente o empresa"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Client Email</Label>
                <Input
                  type="email"
                  value={contractForm.clientEmail}
                  onChange={(e) => setContractForm({ ...contractForm, clientEmail: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-1">
                <Label>Client Phone</Label>
                <Input
                  value={contractForm.clientPhone}
                  onChange={(e) => setContractForm({ ...contractForm, clientPhone: e.target.value })}
                  placeholder="+57 300 ..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={contractForm.startDate}
                  onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={contractForm.endDate}
                  onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Monthly Amount</Label>
                <Input
                  type="number"
                  value={contractForm.monthlyAmount}
                  onChange={(e) => setContractForm({ ...contractForm, monthlyAmount: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label>Currency</Label>
                <Select
                  value={contractForm.currency}
                  onValueChange={(v) => setContractForm({ ...contractForm, currency: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COP">COP</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Payment Terms</Label>
                <Select
                  value={contractForm.paymentTerms}
                  onValueChange={(v) => setContractForm({ ...contractForm, paymentTerms: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="net_15">Net 15</SelectItem>
                    <SelectItem value="net_30">Net 30</SelectItem>
                    <SelectItem value="net_60">Net 60</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingContract && (
                <div className="space-y-1">
                  <Label>Status</Label>
                  <Select
                    value={contractForm.status}
                    onValueChange={(v) => setContractForm({ ...contractForm, status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={contractForm.autoRenew}
                onCheckedChange={(v) => setContractForm({ ...contractForm, autoRenew: v })}
              />
              <Label>Auto-renew</Label>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={contractForm.notes}
                onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>

            {/* Attachments Section */}
            <div className="space-y-2 border-t pt-3">
              <Label className="flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" /> Attachments
              </Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-md p-4 text-center">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  id="contract-file-upload"
                  onChange={(e) => handleAttachmentUpload(e.target.files)}
                />
                <label
                  htmlFor="contract-file-upload"
                  className="cursor-pointer flex flex-col items-center gap-1"
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {uploading ? 'Uploading...' : 'Click to upload files'}
                  </span>
                </label>
              </div>
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map((att, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{att.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(att.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {att.url && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                            <a href={att.url} download={att.name}>
                              <Download className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeContractDialog}>Cancel</Button>
            <Button
              onClick={handleContractSubmit}
              disabled={
                !contractForm.contractNumber ||
                !contractForm.clientName ||
                !contractForm.startDate ||
                createContract.isPending ||
                updateContract.isPending
              }
            >
              {createContract.isPending || updateContract.isPending
                ? 'Saving...'
                : editingContract
                ? 'Update Contract'
                : 'Create Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Create/Edit Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={(o) => { if (!o) closeInvoiceDialog(); else setShowInvoiceDialog(true); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInvoice ? 'Edit Invoice' : 'Nueva Factura'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Invoice Number *</Label>
              <Input
                value={invoiceForm.invoiceNumber}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value })}
                placeholder="INV-001"
              />
            </div>

            {editingInvoice && (
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={invoiceForm.status}
                  onValueChange={(v) => setInvoiceForm({ ...invoiceForm, status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="credited">Credited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Issue Date *</Label>
                <Input
                  type="date"
                  value={invoiceForm.issueDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Subtotal</Label>
                <Input
                  type="number"
                  value={invoiceForm.subtotal}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, subtotal: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label>Tax Rate (%)</Label>
                <Input
                  type="number"
                  value={invoiceForm.taxRate}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, taxRate: e.target.value })}
                  placeholder="19"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={invoiceForm.notes}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeInvoiceDialog}>Cancel</Button>
            <Button
              onClick={handleInvoiceSubmit}
              disabled={
                !invoiceForm.invoiceNumber ||
                !invoiceForm.issueDate ||
                !invoiceForm.dueDate ||
                createInvoice.isPending ||
                updateInvoice.isPending
              }
            >
              {createInvoice.isPending || updateInvoice.isPending
                ? 'Saving...'
                : editingInvoice
                ? 'Update Invoice'
                : 'Create Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.type === 'contract' ? 'Delete Contract' : 'Cancel Invoice'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'contract'
                ? `Are you sure you want to delete contract "${deleteTarget?.label}"? This action cannot be undone.`
                : `Are you sure you want to cancel invoice "${deleteTarget?.label}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget?.type === 'contract') {
                  deleteContract.mutate(deleteTarget.id);
                } else if (deleteTarget) {
                  deleteInvoice.mutate(deleteTarget.id);
                }
              }}
            >
              {deleteTarget?.type === 'contract' ? 'Delete' : 'Cancel Invoice'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
