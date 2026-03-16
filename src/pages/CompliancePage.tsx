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
import { ShieldCheck, Plus, FileText, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { complianceTemplatesApi, retentionPoliciesApi, complianceStatsApi } from '@/services/compliance-api';

export default function CompliancePage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState('templates');
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showCreateRetention, setShowCreateRetention] = useState(false);
  const [tplForm, setTplForm] = useState<Record<string, any>>({ type: 'privacy_policy', isActive: true });
  const [retForm, setRetForm] = useState<Record<string, any>>({ dataType: 'video', action: 'delete', retentionDays: 365, isActive: true });

  const { data: templates } = useQuery({ queryKey: ['compliance-templates'], queryFn: () => complianceTemplatesApi.list() });
  const { data: policies } = useQuery({ queryKey: ['retention-policies'], queryFn: () => retentionPoliciesApi.list() });
  const { data: stats } = useQuery({ queryKey: ['compliance-stats'], queryFn: () => complianceStatsApi.get() });

  const createTemplate = useMutation({
    mutationFn: (data: Record<string, unknown>) => complianceTemplatesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-templates'] }); qc.invalidateQueries({ queryKey: ['compliance-stats'] }); setShowCreateTemplate(false); toast.success('Template created'); },
  });

  const approveTemplate = useMutation({
    mutationFn: (id: string) => complianceTemplatesApi.approve(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compliance-templates'] }); qc.invalidateQueries({ queryKey: ['compliance-stats'] }); toast.success('Template approved'); },
  });

  const createRetention = useMutation({
    mutationFn: (data: Record<string, unknown>) => retentionPoliciesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['retention-policies'] }); qc.invalidateQueries({ queryKey: ['compliance-stats'] }); setShowCreateRetention(false); toast.success('Retention policy created'); },
  });

  const s = stats?.data;

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold">Compliance (Ley 1581)</h1><p className="text-sm text-muted-foreground">Data protection policies, templates, and retention management</p></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Templates</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{s?.totalTemplates ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">{s?.approvedTemplates ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Retention Policies</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{s?.totalPolicies ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active Policies</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-500">{s?.activePolicies ?? 0}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList><TabsTrigger value="templates"><FileText className="h-4 w-4 mr-1" />Templates</TabsTrigger><TabsTrigger value="retention"><Clock className="h-4 w-4 mr-1" />Retention Policies</TabsTrigger></TabsList>
          <div className="flex gap-2">
            <Dialog open={showCreateTemplate} onOpenChange={setShowCreateTemplate}><DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Template</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>New Compliance Template</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <Input placeholder="Name *" value={tplForm.name || ''} onChange={e => setTplForm({ ...tplForm, name: e.target.value })} />
                  <Select value={tplForm.type} onValueChange={v => setTplForm({ ...tplForm, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="privacy_policy">Privacy Policy</SelectItem><SelectItem value="data_processing">Data Processing</SelectItem><SelectItem value="consent_form">Consent Form</SelectItem><SelectItem value="incident_response">Incident Response</SelectItem><SelectItem value="retention_policy">Retention Policy</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
                  <textarea className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Template content *" value={tplForm.content || ''} onChange={e => setTplForm({ ...tplForm, content: e.target.value })} />
                  <Button onClick={() => createTemplate.mutate(tplForm)} disabled={!tplForm.name || !tplForm.content}>Create Template</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showCreateRetention} onOpenChange={setShowCreateRetention}><DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />New Policy</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>New Retention Policy</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <Input placeholder="Policy Name *" value={retForm.name || ''} onChange={e => setRetForm({ ...retForm, name: e.target.value })} />
                  <Select value={retForm.dataType} onValueChange={v => setRetForm({ ...retForm, dataType: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="video">Video</SelectItem><SelectItem value="images">Images</SelectItem><SelectItem value="access_logs">Access Logs</SelectItem><SelectItem value="visitor_data">Visitor Data</SelectItem><SelectItem value="incident_reports">Incident Reports</SelectItem><SelectItem value="personal_data">Personal Data</SelectItem></SelectContent></Select>
                  <Input type="number" placeholder="Retention Days *" value={retForm.retentionDays || 365} onChange={e => setRetForm({ ...retForm, retentionDays: parseInt(e.target.value) || 365 })} />
                  <Select value={retForm.action} onValueChange={v => setRetForm({ ...retForm, action: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="delete">Delete</SelectItem><SelectItem value="archive">Archive</SelectItem><SelectItem value="anonymize">Anonymize</SelectItem></SelectContent></Select>
                  <Button onClick={() => createRetention.mutate(retForm)} disabled={!retForm.name}>Create Policy</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsContent value="templates">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="p-3 text-left">Name</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Version</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Approved</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {(templates?.data || []).map((tpl: any) => (
                  <tr key={tpl.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{tpl.name}</td>
                    <td className="p-3"><Badge variant="outline">{tpl.type}</Badge></td>
                    <td className="p-3 text-xs">v{tpl.version}</td>
                    <td className="p-3"><Badge variant={tpl.isActive ? 'default' : 'secondary'}>{tpl.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="p-3 text-xs">{tpl.approvedAt ? new Date(tpl.approvedAt).toLocaleDateString() : '-'}</td>
                    <td className="p-3 text-center">
                      {!tpl.approvedAt && <Button size="sm" variant="ghost" onClick={() => approveTemplate.mutate(tpl.id)}><CheckCircle className="h-3 w-3 mr-1" />Approve</Button>}
                    </td>
                  </tr>
                ))}
                {(!templates?.data?.length) && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No templates found</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="retention">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="p-3 text-left">Name</th><th className="p-3 text-left">Data Type</th><th className="p-3 text-left">Retention</th><th className="p-3 text-left">Action</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Last Executed</th></tr></thead>
              <tbody>
                {(policies?.data || []).map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3"><Badge variant="outline">{p.dataType}</Badge></td>
                    <td className="p-3 text-xs">{p.retentionDays} days</td>
                    <td className="p-3"><Badge variant={p.action === 'delete' ? 'destructive' : 'secondary'}>{p.action}</Badge></td>
                    <td className="p-3"><Badge variant={p.isActive ? 'default' : 'secondary'}>{p.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="p-3 text-xs">{p.lastExecutedAt ? new Date(p.lastExecutedAt).toLocaleDateString() : 'Never'}</td>
                  </tr>
                ))}
                {(!policies?.data?.length) && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No retention policies found</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
