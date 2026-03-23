import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/contexts/I18nContext';
import { useSections, useAccessPeople, useAccessPeopleMutations, useAccessVehicles, useAccessLogs } from '@/hooks/use-module-data';
import {
  UserCheck, Users, Car, Search, Plus, FileText, Download,
  Shield, Clock, Pencil, Trash2, MoreHorizontal, Eye, Key, Camera, ScanLine, CarFront, CheckCircle2, AlertCircle
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function AccessControlPage() {
  const { t } = useI18n();
  const { data: sections = [] } = useSections();
  const { data: people = [], isLoading } = useAccessPeople();
  const { data: vehicles = [] } = useAccessVehicles();
  const { data: logs = [] } = useAccessLogs();
  const { create, remove } = useAccessPeopleMutations();

  const [activeTab, setActiveTab] = useState('residents');
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ full_name: '', type: 'resident', section_id: '', unit: '', phone: '', document_id: '', notes: '' });

  const getSectionName = (id: string) => sections.find((s: any) => s.id === id)?.name || '—';

  const filtered = people.filter((p: any) => {
    if (search && !p.full_name?.toLowerCase().includes(search.toLowerCase()) && !p.unit?.toLowerCase().includes(search.toLowerCase())) return false;
    if (sectionFilter !== 'all' && p.section_id !== sectionFilter) return false;
    if (typeFilter !== 'all' && p.type !== typeFilter) return false;
    return true;
  });

  const selected = selectedPerson ? people.find((p: any) => p.id === selectedPerson) : null;
  const personVehicles = selected ? vehicles.filter((v: any) => v.person_id === selected.id) : [];

  const handleAdd = () => {
    if (!form.full_name.trim()) return;
    create.mutate({
      full_name: form.full_name, type: form.type,
      section_id: form.section_id || undefined, unit: form.unit || undefined,
      phone: form.phone || undefined, document_id: form.document_id || undefined,
      notes: form.notes || undefined,
    });
    setAddOpen(false);
    setForm({ full_name: '', type: 'resident', section_id: '', unit: '', phone: '', document_id: '', notes: '' });
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className={cn("flex-1 flex flex-col border-r", selected && "max-w-[60%]")}>
        <div className="px-4 py-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> {t('access.title')}</h1>
              <p className="text-xs text-muted-foreground">{t('access.subtitle')}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.info('Export requires selecting a report type in the Reports tab')}><Download className="mr-1 h-3 w-3" /> {t('common.export')}</Button>
              <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-3 w-3" /> {t('access.add_person')}</Button>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Card className="p-2"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">{t('access.total_people')}</p><p className="text-lg font-bold">{people.length}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-green-500" /><div><p className="text-xs text-muted-foreground">{t('access.residents')}</p><p className="text-lg font-bold">{people.filter((p: any) => p.type === 'resident').length}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><Car className="h-4 w-4 text-blue-500" /><div><p className="text-xs text-muted-foreground">{t('access.vehicles')}</p><p className="text-lg font-bold">{vehicles.length}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><Clock className="h-4 w-4 text-warning" /><div><p className="text-xs text-muted-foreground">{t('access.today_accesses')}</p><p className="text-lg font-bold">{logs.length}</p></div></div></Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-4 pt-2 border-b">
            <TabsList className="h-8">
              <TabsTrigger value="residents" className="text-xs"><Users className="mr-1 h-3 w-3" /> {t('access.people')}</TabsTrigger>
              <TabsTrigger value="logs" className="text-xs"><Clock className="mr-1 h-3 w-3" /> {t('access.access_log')}</TabsTrigger>
              <TabsTrigger value="vehicles" className="text-xs"><Car className="mr-1 h-3 w-3" /> {t('access.vehicles')}</TabsTrigger>
              <TabsTrigger value="lpr_scanner" className="text-xs text-primary data-[state=active]:bg-primary/20"><ScanLine className="mr-1 h-3 w-3" /> LPR Vision</TabsTrigger>
              <TabsTrigger value="reports" className="text-xs"><FileText className="mr-1 h-3 w-3" /> {t('reports.title')}</TabsTrigger>
              <TabsTrigger value="credentials" className="text-xs"><Key className="mr-1 h-3 w-3" /> {t('access.credentials')}</TabsTrigger>
            </TabsList>
          </div>

          <div className="px-4 py-2 border-b flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('access.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder={t('access.all_sections')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('access.all_sections')}</SelectItem>
                {sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                <SelectItem value="resident">{t('access.residents')}</SelectItem>
                <SelectItem value="visitor">{t('access.visitors')}</SelectItem>
                <SelectItem value="staff">{t('access.staff')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="residents" className="flex-1 overflow-auto m-0">
            {isLoading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Users className="h-12 w-12 mb-2 opacity-20" />
                <p className="text-sm">{people.length === 0 ? 'No people registered yet' : 'No results match your filters'}</p>
                {people.length === 0 && <Button variant="outline" size="sm" className="mt-2" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-3 w-3" /> {t('access.add_person')}</Button>}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('access.section')}</TableHead>
                    <TableHead>{t('access.unit')}</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((person: any) => (
                    <TableRow key={person.id} className={cn("cursor-pointer", selectedPerson === person.id && "bg-muted/50")} onClick={() => setSelectedPerson(person.id)}>
                      <TableCell className="font-medium text-sm">{person.full_name}</TableCell>
                      <TableCell className="text-xs">{getSectionName(person.section_id)}</TableCell>
                      <TableCell className="text-xs">{person.unit || '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{person.type}</Badge></TableCell>
                      <TableCell><Badge variant={person.status === 'active' ? 'default' : 'secondary'} className="text-[10px] capitalize">{person.status}</Badge></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedPerson(person.id)}><Eye className="mr-2 h-3 w-3" /> {t('common.view')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info('Edit functionality — select the person and use the Edit button in the detail panel')}><Pencil className="mr-2 h-3 w-3" /> {t('common.edit')}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete?')) remove.mutate(person.id); }}><Trash2 className="mr-2 h-3 w-3" /> {t('common.delete')}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="logs" className="flex-1 overflow-auto m-0">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><Clock className="h-12 w-12 mb-2 opacity-20" /><p className="text-sm">No access logs yet</p></div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>{t('access.time')}</TableHead><TableHead>{t('access.direction')}</TableHead><TableHead>{t('access.method')}</TableHead><TableHead>{t('access.section')}</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono">{new Date(log.created_at).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={log.direction === 'in' ? 'default' : 'secondary'} className="text-[10px]">{log.direction === 'in' ? '→ Entry' : '← Exit'}</Badge></TableCell>
                      <TableCell className="text-xs">{log.method}</TableCell>
                      <TableCell className="text-xs">{getSectionName(log.section_id)}</TableCell>
                      <TableCell className="text-xs">{log.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="vehicles" className="flex-1 overflow-auto m-0">
            {vehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><Car className="h-12 w-12 mb-2 opacity-20" /><p className="text-sm">No vehicles registered</p></div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>{t('access.plate')}</TableHead><TableHead>Brand</TableHead><TableHead>Color</TableHead><TableHead>{t('common.type')}</TableHead><TableHead>{t('common.status')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {vehicles.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono font-bold text-sm">{v.plate}</TableCell>
                      <TableCell className="text-xs">{v.brand || '—'} {v.model || ''}</TableCell>
                      <TableCell className="text-xs">{v.color || '—'}</TableCell>
                      <TableCell className="text-xs capitalize">{v.type}</TableCell>
                      <TableCell><Badge variant={v.status === 'active' ? 'default' : 'secondary'} className="text-[10px] capitalize">{v.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="lpr_scanner" className="flex-1 overflow-auto m-0 p-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
               {/* Camera Feed Context */}
               <Card className="flex flex-col border-primary/20 shadow-[0_0_15px_rgba(0,180,216,0.05)] overflow-hidden">
                 <CardHeader className="py-3 px-4 bg-background/50 border-b flex flex-row items-center justify-between">
                   <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                     <Camera className="h-4 w-4" /> Entry Lane: Cam-LPR-01
                   </CardTitle>
                   <div className="flex items-center gap-2">
                     <span className="relative flex h-2 w-2">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                     </span>
                     <span className="text-[10px] text-muted-foreground font-mono">LIVE / OCR ACTIVE</span>
                   </div>
                 </CardHeader>
                 <CardContent className="p-0 flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-[300px]">
                   <ScanLine className="absolute h-full w-full text-primary/20 animate-pulse pointer-events-none p-12" />
                   <div className="w-[80%] h-[60%] border-2 border-dashed border-primary/50 relative">
                     <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary -translate-x-1 -translate-y-1"></div>
                     <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary translate-x-1 -translate-y-1"></div>
                     <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary -translate-x-1 translate-y-1"></div>
                     <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary translate-x-1 translate-y-1"></div>
                   </div>
                   <div className="absolute bottom-4 left-4 right-4 flex justify-between tracking-widest font-mono text-[9px] text-primary/70">
                     <span>OPTICAL RECOGNITION...</span>
                     <span>98.8% CONFIDENCE TARGET</span>
                   </div>
                 </CardContent>
               </Card>

               {/* OCR Extracted Plates Logic */}
               <Card className="flex flex-col max-h-[500px]">
                 <CardHeader className="py-3 px-4 border-b bg-muted/20">
                    <CardTitle className="text-xs font-bold flex items-center gap-2">
                      <CarFront className="h-4 w-4 text-muted-foreground" /> OCR Plate Buffer
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="p-4 overflow-y-auto space-y-3">
                   {/* MOCK PLATE 1 */}
                   <div className="flex items-center justify-between p-3 rounded-lg border border-success/30 bg-success/5">
                     <div className="flex gap-4 items-center">
                       <div className="h-10 w-24 bg-white rounded border-2 border-black flex items-center justify-center">
                         <span className="text-black font-extrabold font-mono tracking-widest">AZE-891</span>
                       </div>
                       <div>
                         <p className="text-sm font-bold text-success flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> AUTHORIZED</p>
                         <p className="text-[10px] text-muted-foreground">Resident: Carlos Mendoza • Tower B</p>
                       </div>
                     </div>
                     <span className="text-xs text-muted-foreground font-mono">14 sec ago</span>
                   </div>
                   {/* MOCK PLATE 2 */}
                   <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5 relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse" />
                     <div className="flex gap-4 items-center">
                       <div className="h-10 w-24 bg-yellow-400 rounded border-2 border-black flex items-center justify-center">
                         <span className="text-black font-extrabold font-mono tracking-widest">KTR-92F</span>
                       </div>
                       <div>
                         <p className="text-sm font-bold text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" /> UNKNOWN</p>
                         <p className="text-[10px] text-muted-foreground">No records in DB</p>
                       </div>
                     </div>
                     <Button size="sm" variant="destructive" className="h-7 text-[10px]">Open Gate</Button>
                   </div>
                   {/* MOCK PLATE 3 */}
                   <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/10 opacity-60">
                     <div className="flex gap-4 items-center">
                       <div className="h-10 w-24 bg-white rounded border-2 border-black flex items-center justify-center">
                         <span className="text-black font-extrabold font-mono tracking-widest">GZP-019</span>
                       </div>
                       <div>
                         <p className="text-sm font-bold text-muted-foreground">AUTHORIZED</p>
                         <p className="text-[10px] text-muted-foreground">Staff: Maintenance</p>
                       </div>
                     </div>
                     <span className="text-xs text-muted-foreground font-mono">5 mins ago</span>
                   </div>
                 </CardContent>
               </Card>
             </div>
          </TabsContent>

          <TabsContent value="reports" className="flex-1 overflow-auto m-0 p-4">
            <div className="grid grid-cols-2 gap-4">
              {['daily', 'weekly', 'biweekly', 'monthly'].map(period => (
                <Card key={period}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{t(`access.${period}_report`)}</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-3">{t(`access.${period}_report_desc`)}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => toast.success(`${period} CSV report generation started`)}><Download className="mr-1 h-3 w-3" /> CSV</Button>
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => toast.success(`${period} Excel report generation started`)}><FileText className="mr-1 h-3 w-3" /> Excel</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="credentials" className="flex-1 overflow-auto m-0 p-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Key className="h-4 w-4" /> {t('access.credentials')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Manage access credentials: keycards, RFID tags, PIN codes, and biometric enrollment for registered people.</p>
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Supported Methods</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>RFID / NFC cards (HID, EM4100)</li>
                    <li>PIN codes</li>
                    <li>QR / Barcode</li>
                    <li>Biometric (fingerprint, facial recognition)</li>
                  </ul>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info('Credential management requires access control hardware integration in Settings > Integrations')}>Configure</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {selected && (
        <div className="w-[40%] overflow-auto p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div><h2 className="font-bold">{selected.full_name}</h2><p className="text-sm text-muted-foreground">{selected.unit || '—'} • {getSectionName(selected.section_id)}</p></div>
            <Badge variant={selected.status === 'active' ? 'default' : 'secondary'} className="capitalize">{selected.status}</Badge>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('access.contact')}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t('access.phone')}</span><span>{selected.phone || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{selected.email || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Document</span><span>{selected.document_id || '—'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t('common.type')}</span><span className="capitalize">{selected.type}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('access.vehicles')} ({personVehicles.length})</CardTitle></CardHeader>
            <CardContent>
              {personVehicles.length > 0 ? (
                <div className="flex flex-wrap gap-1">{personVehicles.map((v: any) => <Badge key={v.id} variant="outline" className="font-mono">{v.plate}</Badge>)}</div>
              ) : <p className="text-xs text-muted-foreground">{t('access.no_vehicles')}</p>}
            </CardContent>
          </Card>
          {selected.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{selected.notes}</CardContent>
            </Card>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setForm({ full_name: selected.full_name, type: selected.type, section_id: selected.section_id || '', unit: selected.unit || '', phone: selected.phone || '', document_id: selected.document_id || '', notes: selected.notes || '' }); setAddOpen(true); }}><Pencil className="mr-1 h-3 w-3" /> {t('common.edit')}</Button>
            <Button variant="outline" className="text-destructive" onClick={() => { if (confirm('Delete?')) { remove.mutate(selected.id); setSelectedPerson(null); } }}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('access.add_person')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{t('common.name')} *</Label><Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Full name" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{t('access.unit')}</Label><Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="Apt/House" /></div>
              <div className="space-y-1"><Label>{t('access.phone')}</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>{t('common.type')}</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resident">{t('access.residents')}</SelectItem>
                    <SelectItem value="visitor">{t('access.visitors')}</SelectItem>
                    <SelectItem value="staff">{t('access.staff')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>{t('access.section')}</Label>
                <Select value={form.section_id} onValueChange={v => setForm(p => ({ ...p, section_id: v }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Document ID</Label><Input value={form.document_id} onChange={e => setForm(p => ({ ...p, document_id: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button className="w-full" onClick={handleAdd} disabled={!form.full_name.trim() || create.isPending}>{t('common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
