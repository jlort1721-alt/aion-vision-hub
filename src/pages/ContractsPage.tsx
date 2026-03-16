import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/contexts/I18nContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, DollarSign, Plus, CheckCircle, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { contractsApi, invoicesApi } from '@/services/contracts-api';

const fmt = (v: string | number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(v));

const statusColor: Record<string, string> = {
  draft: 'secondary', active: 'default', suspended: 'outline', terminated: 'destructive', expired: 'secondary',
  sent: 'default', paid: 'default', overdue: 'destructive', cancelled: 'secondary', credited: 'outline',
};

export default function ContractsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState('contracts');
  const [showCreate, setShowCreate] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({ type: 'monthly', status: 'draft', currency: 'COP', paymentTerms: 'net_30', services: [] });
  const [invForm, setInvForm] = useState<Record<string, any>>({ status: 'draft', currency: 'COP', taxRate: '19', lineItems: [] });

  const { data: contracts } = useQuery({ queryKey: ['contracts'], queryFn: () => contractsApi.list() });
  const { data: invoiceData } = useQuery({ queryKey: ['invoices'], queryFn: () => invoicesApi.list() });
  const { data: stats } = useQuery({ queryKey: ['contract-stats'], queryFn: () => contractsApi.getStats() });
  const { data: invStats } = useQuery({ queryKey: ['invoice-stats'], queryFn: () => invoicesApi.getStats() });

  const createContract = useMutation({
    mutationFn: (data: Record<string, unknown>) => contractsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); qc.invalidateQueries({ queryKey: ['contract-stats'] }); setShowCreate(false); toast.success('Contract created'); },
  });

  const createInvoice = useMutation({
    mutationFn: (data: Record<string, unknown>) => invoicesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['invoice-stats'] }); setShowInvoice(false); toast.success('Invoice created'); },
  });

  const markPaid = useMutation({
    mutationFn: ({ id, ...data }: any) => invoicesApi.markPaid(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['invoice-stats'] }); toast.success('Invoice marked as paid'); },
  });

  const s = stats?.data;
  const is = invStats?.data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contracts & Billing</h1>
          <p className="text-sm text-muted-foreground">Manage contracts, invoices, and billing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Contracts</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{s?.active ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(s?.monthlyRevenue ?? 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pending Invoices</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{(is?.sent ?? 0) + (is?.overdue ?? 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmt(is?.collected ?? 0)}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList><TabsTrigger value="contracts"><FileText className="h-4 w-4 mr-1" />Contracts</TabsTrigger><TabsTrigger value="invoices"><Receipt className="h-4 w-4 mr-1" />Invoices</TabsTrigger></TabsList>
          <div className="flex gap-2">
            <Dialog open={showCreate} onOpenChange={setShowCreate}><DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Contract</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>New Contract</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <Input placeholder="Contract Number *" value={form.contractNumber || ''} onChange={e => setForm({ ...form, contractNumber: e.target.value })} />
                  <Input placeholder="Client Name *" value={form.clientName || ''} onChange={e => setForm({ ...form, clientName: e.target.value })} />
                  <Input placeholder="Client Email" value={form.clientEmail || ''} onChange={e => setForm({ ...form, clientEmail: e.target.value })} />
                  <Input placeholder="Client Phone" value={form.clientPhone || ''} onChange={e => setForm({ ...form, clientPhone: e.target.value })} />
                  <Input type="date" placeholder="Start Date *" value={form.startDate || ''} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                  <Input type="date" placeholder="End Date" value={form.endDate || ''} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                  <Input type="number" placeholder="Monthly Amount" value={form.monthlyAmount || ''} onChange={e => setForm({ ...form, monthlyAmount: e.target.value })} />
                  <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="annual">Annual</SelectItem><SelectItem value="one_time">One Time</SelectItem><SelectItem value="project">Project</SelectItem></SelectContent></Select>
                  <Button onClick={() => createContract.mutate(form)} disabled={!form.contractNumber || !form.clientName || !form.startDate}>Create Contract</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showInvoice} onOpenChange={setShowInvoice}><DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />New Invoice</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <Input placeholder="Invoice Number *" value={invForm.invoiceNumber || ''} onChange={e => setInvForm({ ...invForm, invoiceNumber: e.target.value })} />
                  <Input type="date" placeholder="Issue Date *" value={invForm.issueDate || ''} onChange={e => setInvForm({ ...invForm, issueDate: e.target.value })} />
                  <Input type="date" placeholder="Due Date *" value={invForm.dueDate || ''} onChange={e => setInvForm({ ...invForm, dueDate: e.target.value })} />
                  <Input type="number" placeholder="Subtotal" value={invForm.subtotal || ''} onChange={e => setInvForm({ ...invForm, subtotal: e.target.value })} />
                  <Input type="number" placeholder="Tax Rate (%)" value={invForm.taxRate || '19'} onChange={e => setInvForm({ ...invForm, taxRate: e.target.value })} />
                  <Button onClick={() => createInvoice.mutate(invForm)} disabled={!invForm.invoiceNumber || !invForm.issueDate || !invForm.dueDate}>Create Invoice</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsContent value="contracts">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="p-3 text-left">#</th><th className="p-3 text-left">Client</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Status</th><th className="p-3 text-right">Monthly</th><th className="p-3 text-left">Start</th><th className="p-3 text-left">End</th></tr></thead>
              <tbody>
                {(contracts?.data || []).map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{c.contractNumber}</td>
                    <td className="p-3">{c.clientName}</td>
                    <td className="p-3"><Badge variant="outline">{c.type}</Badge></td>
                    <td className="p-3"><Badge variant={statusColor[c.status] as any}>{c.status}</Badge></td>
                    <td className="p-3 text-right font-mono">{fmt(c.monthlyAmount)}</td>
                    <td className="p-3 text-xs">{c.startDate}</td>
                    <td className="p-3 text-xs">{c.endDate || '-'}</td>
                  </tr>
                ))}
                {(!contracts?.data?.length) && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No contracts found</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="p-3 text-left">#</th><th className="p-3 text-left">Status</th><th className="p-3 text-right">Total</th><th className="p-3 text-left">Issue</th><th className="p-3 text-left">Due</th><th className="p-3 text-left">Paid</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {(invoiceData?.data || []).map((inv: any) => (
                  <tr key={inv.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="p-3"><Badge variant={statusColor[inv.status] as any}>{inv.status}</Badge></td>
                    <td className="p-3 text-right font-mono">{fmt(inv.totalAmount)}</td>
                    <td className="p-3 text-xs">{inv.issueDate}</td>
                    <td className="p-3 text-xs">{inv.dueDate}</td>
                    <td className="p-3 text-xs">{inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : '-'}</td>
                    <td className="p-3 text-center">
                      {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                        <Button size="sm" variant="ghost" onClick={() => markPaid.mutate({ id: inv.id, paymentMethod: 'transfer', paidAmount: inv.totalAmount })}><CheckCircle className="h-3 w-3 mr-1" />Pay</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!invoiceData?.data?.length) && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No invoices found</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
