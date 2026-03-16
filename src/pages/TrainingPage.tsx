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
import { GraduationCap, Plus, Award, AlertTriangle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { trainingProgramsApi, certificationsApi, trainingStatsApi } from '@/services/training-api';

const statusColor: Record<string, string> = { enrolled: 'secondary', in_progress: 'default', completed: 'default', failed: 'destructive', expired: 'outline' };

export default function TrainingPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState('programs');
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [progForm, setProgForm] = useState<Record<string, any>>({ category: 'security', durationHours: 8, isRequired: false, passingScore: 70, validityMonths: 12 });
  const [enrollForm, setEnrollForm] = useState<Record<string, any>>({});

  const { data: programs } = useQuery({ queryKey: ['training-programs'], queryFn: () => trainingProgramsApi.list() });
  const { data: certs } = useQuery({ queryKey: ['certifications'], queryFn: () => certificationsApi.list() });
  const { data: expiring } = useQuery({ queryKey: ['expiring-certs'], queryFn: () => certificationsApi.getExpiring(30) });
  const { data: stats } = useQuery({ queryKey: ['training-stats'], queryFn: () => trainingStatsApi.get() });

  const createProgram = useMutation({
    mutationFn: (data: Record<string, unknown>) => trainingProgramsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training-programs'] }); qc.invalidateQueries({ queryKey: ['training-stats'] }); setShowCreateProgram(false); toast.success('Program created'); },
  });

  const enrollUser = useMutation({
    mutationFn: (data: { programId: string; userId: string; userName: string }) => certificationsApi.enroll(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certifications'] }); qc.invalidateQueries({ queryKey: ['training-stats'] }); setShowEnroll(false); toast.success('User enrolled'); },
  });

  const completeCert = useMutation({
    mutationFn: ({ id, score }: { id: string; score: number }) => certificationsApi.complete(id, { score }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['certifications'] }); qc.invalidateQueries({ queryKey: ['training-stats'] }); qc.invalidateQueries({ queryKey: ['expiring-certs'] }); toast.success('Certification completed'); },
  });

  const s = stats?.data;

  return (
    <div className="p-6 space-y-6">
      <div><h1 className="text-2xl font-bold">Training & Certifications</h1><p className="text-sm text-muted-foreground">Manage training programs, enrollments, and certifications</p></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Programs</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{s?.totalPrograms ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Certifications</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{s?.totalCertifications ?? 0}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Compliance Rate</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-500">{s?.complianceRate ?? 0}%</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Expiring (30d)</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-orange-500">{expiring?.data?.length ?? 0}</div></CardContent></Card>
      </div>

      {(expiring?.data?.length ?? 0) > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-500" />Expiring Certifications</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {(expiring?.data || []).slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.userName}</span>
                  <span className="text-xs text-muted-foreground">Expires: {new Date(c.expiresAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList><TabsTrigger value="programs"><GraduationCap className="h-4 w-4 mr-1" />Programs</TabsTrigger><TabsTrigger value="certifications"><Award className="h-4 w-4 mr-1" />Certifications</TabsTrigger></TabsList>
          <div className="flex gap-2">
            <Dialog open={showCreateProgram} onOpenChange={setShowCreateProgram}><DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Program</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>New Training Program</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <Input placeholder="Program Name *" value={progForm.name || ''} onChange={e => setProgForm({ ...progForm, name: e.target.value })} />
                  <Input placeholder="Description" value={progForm.description || ''} onChange={e => setProgForm({ ...progForm, description: e.target.value })} />
                  <Select value={progForm.category} onValueChange={v => setProgForm({ ...progForm, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="security">Security</SelectItem><SelectItem value="safety">Safety</SelectItem><SelectItem value="compliance">Compliance</SelectItem><SelectItem value="technology">Technology</SelectItem><SelectItem value="first_aid">First Aid</SelectItem><SelectItem value="leadership">Leadership</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
                  <Input type="number" placeholder="Duration (hours)" value={progForm.durationHours || 8} onChange={e => setProgForm({ ...progForm, durationHours: parseInt(e.target.value) || 8 })} />
                  <Input type="number" placeholder="Passing Score (%)" value={progForm.passingScore || 70} onChange={e => setProgForm({ ...progForm, passingScore: parseInt(e.target.value) || 70 })} />
                  <Input type="number" placeholder="Validity (months)" value={progForm.validityMonths || 12} onChange={e => setProgForm({ ...progForm, validityMonths: parseInt(e.target.value) || 12 })} />
                  <Button onClick={() => createProgram.mutate(progForm)} disabled={!progForm.name}>Create Program</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showEnroll} onOpenChange={setShowEnroll}><DialogTrigger asChild><Button size="sm" variant="outline"><Users className="h-4 w-4 mr-1" />Enroll</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Enroll User</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <Select value={enrollForm.programId || ''} onValueChange={v => setEnrollForm({ ...enrollForm, programId: v })}><SelectTrigger><SelectValue placeholder="Select Program *" /></SelectTrigger><SelectContent>{(programs?.data || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
                  <Input placeholder="User ID *" value={enrollForm.userId || ''} onChange={e => setEnrollForm({ ...enrollForm, userId: e.target.value })} />
                  <Input placeholder="User Name *" value={enrollForm.userName || ''} onChange={e => setEnrollForm({ ...enrollForm, userName: e.target.value })} />
                  <Button onClick={() => enrollUser.mutate(enrollForm as any)} disabled={!enrollForm.programId || !enrollForm.userId || !enrollForm.userName}>Enroll</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <TabsContent value="programs">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="p-3 text-left">Name</th><th className="p-3 text-left">Category</th><th className="p-3 text-left">Duration</th><th className="p-3 text-left">Pass Score</th><th className="p-3 text-left">Validity</th><th className="p-3 text-left">Required</th><th className="p-3 text-left">Status</th></tr></thead>
              <tbody>
                {(programs?.data || []).map((p: any) => (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3"><Badge variant="outline">{p.category}</Badge></td>
                    <td className="p-3 text-xs">{p.durationHours}h</td>
                    <td className="p-3 text-xs">{p.passingScore}%</td>
                    <td className="p-3 text-xs">{p.validityMonths} months</td>
                    <td className="p-3"><Badge variant={p.isRequired ? 'destructive' : 'secondary'}>{p.isRequired ? 'Required' : 'Optional'}</Badge></td>
                    <td className="p-3"><Badge variant={p.isActive ? 'default' : 'secondary'}>{p.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  </tr>
                ))}
                {(!programs?.data?.length) && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No programs found</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="certifications">
          <Card><CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="p-3 text-left">User</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Score</th><th className="p-3 text-left">Completed</th><th className="p-3 text-left">Expires</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {(certs?.data || []).map((c: any) => (
                  <tr key={c.id} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{c.userName}</td>
                    <td className="p-3"><Badge variant={statusColor[c.status] as any}>{c.status}</Badge></td>
                    <td className="p-3 text-xs">{c.score != null ? `${c.score}%` : '-'}</td>
                    <td className="p-3 text-xs">{c.completedAt ? new Date(c.completedAt).toLocaleDateString() : '-'}</td>
                    <td className="p-3 text-xs">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '-'}</td>
                    <td className="p-3 text-center">
                      {(c.status === 'enrolled' || c.status === 'in_progress') && (
                        <Button size="sm" variant="ghost" onClick={() => { const score = prompt('Enter score (0-100):'); if (score) completeCert.mutate({ id: c.id, score: parseInt(score) }); }}>Complete</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!certs?.data?.length) && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No certifications found</td></tr>}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
