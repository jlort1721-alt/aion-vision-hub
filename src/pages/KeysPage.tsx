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
import { KeyRound, Plus, ArrowRightLeft, History } from 'lucide-react';
import { toast } from 'sonner';
import { keysApi, keyLogsApi } from '@/services/keys-api';

const statusColor: Record<string, string> = { available: 'default', assigned: 'secondary', lost: 'destructive', retired: 'outline' };
const actionColor: Record<string, string> = { assigned: 'default', returned: 'default', reported_lost: 'destructive', transferred: 'outline', retired: 'secondary' };

export default function KeysPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState('inventory');
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState<string | null>(null);
  const [holder, setHolder] = useState('');
  const [form, setForm] = useState<Record<string, any>>({ keyType: 'access', copies: 1 });

  const { data: keys } = useQuery({ queryKey: ['keys'], queryFn: () => keysApi.list() });
  const { data: logs } = useQuery({ queryKey: ['key-logs'], queryFn: () => keyLogsApi.list() });
  const { data: stats } = useQuery({ queryKey: ['key-stats'], queryFn: () => keysApi.getStats() });

  const createKey = useMutation({
    mutationFn: (data: Record<string, unknown>) => keysApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keys'] }); qc.invalidateQueries({ queryKey: ['key-stats'] }); setShowCreate(false); toast.success('Key created'); },
  });

  const assignKey = useMutation({
    mutationFn: ({ id, toHolder }: { id: string; toHolder: string }) => keysApi.assign(id, { toHolder }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keys'] }); qc.invalidateQueries({ queryKey: ['key-logs'] }); qc.invalidateQueries({ queryKey: ['key-stats'] }); setShowAssign(null); setHolder(''); toast.success('Key assigned'); },
  });

  const returnKey = useMutation({
    mutationFn: (id: string) => keysApi.returnKey(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keys'] }); qc.invalidateQueries({ queryKey: ['key-logs'] }); qc.invalidateQueries({ queryKey: ['key-stats'] }); toast.success('Key returned'); },
  });

  const s = stats?.data;

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold">Key Management</h1><p className="text-sm text-muted-foreground">Track physical keys, assignments, and audit trail</p></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Keys</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{s?.total ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">{s?.available ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Assigned</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-500">{s?.assigned ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Lost</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-500">{s?.lost ?? 0}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList><TabsTrigger value="inventory"><KeyRound className="h-4 w-4 mr-1" />Inventory</TabsTrigger><TabsTrigger value="logs"><History className="h-4 w-4 mr-1" />Activity Log</TabsTrigger></TabsList>
          <Dialog open={showCreate} onOpenChange={setShowCreate}><DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Key</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Add New Key</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <Input placeholder="Key Code *" value={form.keyCode || ''} onChange={e => setForm({ ...form, keyCode: e.target.value })} />
                <Input placeholder="Label *" value={form.label || ''} onChange={e => setForm({ ...form, label: e.target.value })} />
                <Input placeholder="Location" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} />
                <Select value={form.keyType} onValueChange={v => setForm({ ...form, keyType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="master">Master</SelectItem><SelectItem value="access">Access</SelectItem><SelectItem value="cabinet">Cabinet</SelectItem><SelectItem value="vehicle">Vehicle</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
                <Input type="number" placeholder="Copies" value={form.copies || 1} onChange={e => setForm({ ...form, copies: parseInt(e.target.value) || 1 })} />
                <Button onClick={() => createKey.mutate(form)} disabled={!form.keyCode || !form.label}>Add Key</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="inventory">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="p-3 text-left">Code</th><th className="p-3 text-left">Label</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Holder</th><th className="p-3 text-left">Location</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {(keys?.data || []).map((k: any) => (
                  <tr key={k.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{k.keyCode}</td>
                    <td className="p-3">{k.label}</td>
                    <td className="p-3"><Badge variant="outline">{k.keyType}</Badge></td>
                    <td className="p-3"><Badge variant={statusColor[k.status] as any}>{k.status}</Badge></td>
                    <td className="p-3">{k.currentHolder || '-'}</td>
                    <td className="p-3 text-xs">{k.location || '-'}</td>
                    <td className="p-3 text-center space-x-1">
                      {k.status === 'available' && (
                        <Dialog open={showAssign === k.id} onOpenChange={(o) => { setShowAssign(o ? k.id : null); setHolder(''); }}>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><ArrowRightLeft className="h-3 w-3 mr-1" />Assign</Button></DialogTrigger>
                          <DialogContent><DialogHeader><DialogTitle>Assign Key: {k.keyCode}</DialogTitle></DialogHeader>
                            <div className="grid gap-3"><Input placeholder="Assign to *" value={holder} onChange={e => setHolder(e.target.value)} /><Button onClick={() => assignKey.mutate({ id: k.id, toHolder: holder })} disabled={!holder}>Assign</Button></div>
                          </DialogContent>
                        </Dialog>
                      )}
                      {k.status === 'assigned' && <Button size="sm" variant="ghost" onClick={() => returnKey.mutate(k.id)}>Return</Button>}
                    </td>
                  </tr>
                ))}
                {(!keys?.data?.length) && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No keys found</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="p-3 text-left">Action</th><th className="p-3 text-left">From</th><th className="p-3 text-left">To</th><th className="p-3 text-left">Notes</th><th className="p-3 text-left">Date</th></tr></thead>
              <tbody>
                {(logs?.data || []).map((l: any) => (
                  <tr key={l.id} className="border-b hover:bg-muted/30">
                    <td className="p-3"><Badge variant={actionColor[l.action] as any}>{l.action}</Badge></td>
                    <td className="p-3">{l.fromHolder || '-'}</td>
                    <td className="p-3">{l.toHolder || '-'}</td>
                    <td className="p-3 text-xs">{l.notes || '-'}</td>
                    <td className="p-3 text-xs">{new Date(l.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {(!logs?.data?.length) && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No activity logs</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
