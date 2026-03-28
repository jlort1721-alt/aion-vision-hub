import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/contexts/I18nContext';
import { useSections, useDatabaseRecords, useDatabaseRecordMutations } from '@/hooks/use-module-data';
import {
  Database, Search, Plus, Download, Users, Car,
  Building2, Home, MapPin, Eye, Pencil, Trash2,
  MoreHorizontal, FileText, Phone, Mail,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ── Constants ────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

// ── Component ────────────────────────────────────────────────

export default function DatabasePage() {
  const { t } = useI18n();
  const { data: sections = [] } = useSections();
  const { data: records = [], isLoading } = useDatabaseRecords();
  const { create, update, remove } = useDatabaseRecordMutations();

  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'residente', section_id: '', unit: '', phone: '', email: '', notes: '' });
  const [editForm, setEditForm] = useState({ id: '', title: '', category: 'residente', section_id: '', unit: '', phone: '', email: '', notes: '' });
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const getSectionName = (id: string) => sections.find((s: any) => s.id === id)?.name || '—';

  // Filtered records
  const filtered = useMemo(() => {
    return records.filter((r: any) => {
      if (search && !r.title?.toLowerCase().includes(search.toLowerCase())) return false;
      if (sectionFilter !== 'all' && r.section_id !== sectionFilter) return false;
      if (activeTab !== 'all' && r.category !== activeTab) return false;
      return true;
    });
  }, [records, search, sectionFilter, activeTab]);

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRecords = filtered.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize,
  );
  const startIndex = (safeCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(safeCurrentPage * pageSize, filtered.length);

  // Reset to page 1 when filters change
  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleSectionFilterChange = (val: string) => {
    setSectionFilter(val);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setCurrentPage(1);
  };

  const selected = selectedRecord ? records.find((r: any) => r.id === selectedRecord) : null;

  const handleAdd = () => {
    if (!form.title.trim()) return;
    create.mutate({
      title: form.title, category: form.category,
      section_id: form.section_id || undefined,
      content: { unit: form.unit, phone: form.phone, email: form.email, notes: form.notes },
    });
    setAddOpen(false);
    setForm({ title: '', category: 'residente', section_id: '', unit: '', phone: '', email: '', notes: '' });
  };

  const openEdit = (record: any) => {
    setEditForm({
      id: record.id,
      title: record.title || '',
      category: record.category || 'residente',
      section_id: record.section_id || '',
      unit: record.content?.unit || '',
      phone: record.content?.phone || '',
      email: record.content?.email || '',
      notes: record.content?.notes || '',
    });
    setEditOpen(true);
  };

  const handleEdit = () => {
    if (!editForm.title.trim()) return;
    update.mutate({
      id: editForm.id,
      title: editForm.title, category: editForm.category,
      section_id: editForm.section_id || undefined,
      content: { unit: editForm.unit, phone: editForm.phone, email: editForm.email, notes: editForm.notes },
    });
    setEditOpen(false);
  };

  const handleExport = () => {
    const headers = ['Name', 'Category', 'Section', 'Unit', 'Phone', 'Email', 'Status', 'Created'];
    const rows = filtered.map((r: any) => [
      `"${(r.title || '').replace(/"/g, '""')}"`,
      `"${(r.category || '').replace(/"/g, '""')}"`,
      `"${(getSectionName(r.section_id) || '').replace(/"/g, '""')}"`,
      `"${(r.content?.unit || '').replace(/"/g, '""')}"`,
      `"${(r.content?.phone || '').replace(/"/g, '""')}"`,
      `"${(r.content?.email || '').replace(/"/g, '""')}"`,
      `"${(r.status || '').replace(/"/g, '""')}"`,
      `"${new Date(r.created_at).toLocaleDateString()}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `clave_database_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <div className={cn("flex-1 flex flex-col border-r", selected && "max-w-[60%]")}>
        <div className="px-4 py-3 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2"><Database className="h-5 w-5 text-primary" /> {t('database.title')}</h1>
              <p className="text-xs text-muted-foreground">{t('database.subtitle')}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}><Download className="mr-1 h-3 w-3" /> {t('common.export')}</Button>
              <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-3 w-3" /> {t('database.add_record')}</Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Card className="p-2"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">{t('database.total_records')}</p><p className="text-lg font-bold">{records.length}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><Home className="h-4 w-4 text-success" /><div><p className="text-xs text-muted-foreground">{t('database.residents')}</p><p className="text-lg font-bold">{records.filter((r: any) => r.category === 'residente').length}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /><div><p className="text-xs text-muted-foreground">{t('database.commercial')}</p><p className="text-lg font-bold">{records.filter((r: any) => r.category === 'comercio').length}</p></div></div></Card>
            <Card className="p-2"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-warning" /><div><p className="text-xs text-muted-foreground">{t('database.sections')}</p><p className="text-lg font-bold">{sections.length}</p></div></div></Card>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <div className="px-4 pt-2 border-b">
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs">{t('common.all')}</TabsTrigger>
              <TabsTrigger value="residente" className="text-xs"><Home className="mr-1 h-3 w-3" /> {t('database.residents')}</TabsTrigger>
              <TabsTrigger value="comercio" className="text-xs"><Building2 className="mr-1 h-3 w-3" /> {t('database.commercial')}</TabsTrigger>
              <TabsTrigger value="proveedor" className="text-xs"><Users className="mr-1 h-3 w-3" /> {t('database.providers')}</TabsTrigger>
              <TabsTrigger value="empresa" className="text-xs"><Building2 className="mr-1 h-3 w-3" /> {t('database.companies')}</TabsTrigger>
            </TabsList>
          </div>

          <div className="px-4 py-2 border-b flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t('database.search')} value={search} onChange={e => handleSearchChange(e.target.value)} className="pl-8 h-8 text-sm" />
            </div>
            <Select value={sectionFilter} onValueChange={handleSectionFilterChange}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder={t('database.all_sections')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('database.all_sections')}</SelectItem>
                {sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Database className="h-12 w-12 mb-2 opacity-20" />
                <p className="text-sm">{records.length === 0 ? 'No records yet' : 'No results match your filters'}</p>
                {records.length === 0 && <Button variant="outline" size="sm" className="mt-2" onClick={() => setAddOpen(true)}><Plus className="mr-1 h-3 w-3" /> {t('database.add_record')}</Button>}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('database.section')}</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead>{t('common.date')}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record: any) => (
                    <TableRow key={record.id} className={cn("cursor-pointer", selectedRecord === record.id && "bg-muted/50")} onClick={() => setSelectedRecord(record.id)}>
                      <TableCell className="font-medium text-sm">{record.title}</TableCell>
                      <TableCell className="text-xs">{getSectionName(record.section_id)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{record.category}</Badge></TableCell>
                      <TableCell><Badge variant={record.status === 'active' ? 'default' : 'secondary'} className="text-[10px] capitalize">{record.status}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{new Date(record.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedRecord(record.id)}><Eye className="mr-2 h-3 w-3" /> {t('common.view')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(record)}><Pencil className="mr-2 h-3 w-3" /> {t('common.edit')}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteRecordId(record.id)}><Trash2 className="mr-2 h-3 w-3" /> {t('common.delete')}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination Controls */}
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {startIndex}-{endIndex} of {filtered.length} records
                </span>
                <span className="text-border">|</span>
                <span>{sections.length} {t('database.sections').toLowerCase()}</span>
              </div>

              <div className="flex items-center gap-2">
                {/* Page size selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Rows:</span>
                  <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="h-7 w-[65px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Page indicator */}
                <span className="text-xs text-muted-foreground mx-1">
                  Page {safeCurrentPage} of {totalPages}
                </span>

                {/* Navigation buttons */}
                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(1)}
                    disabled={safeCurrentPage <= 1}
                  >
                    <ChevronsLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safeCurrentPage >= totalPages}
                  >
                    <ChevronsRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Tabs>
      </div>

      {selected && (
        <div className="w-[40%] overflow-auto p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div><h2 className="font-bold">{selected.title}</h2><p className="text-sm text-muted-foreground">{getSectionName(selected.section_id)}</p></div>
            <Badge variant={selected.status === 'active' ? 'default' : 'secondary'} className="capitalize">{selected.status}</Badge>
          </div>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{t('database.contact_info')}</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {selected.content?.unit && <div className="flex justify-between"><span className="text-muted-foreground">Unit</span><span>{selected.content.unit}</span></div>}
              {selected.content?.phone && <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</span><span>{selected.content.phone}</span></div>}
              {selected.content?.email && <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span><span>{selected.content.email}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="capitalize">{selected.category}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="text-xs font-mono">{new Date(selected.created_at).toLocaleDateString()}</span></div>
            </CardContent>
          </Card>
          {selected.content?.notes && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t('database.observations')}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">{selected.content.notes}</CardContent>
            </Card>
          )}
          {selected.tags?.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Tags</CardTitle></CardHeader>
              <CardContent><div className="flex flex-wrap gap-1">{selected.tags.map((tag: string) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div></CardContent>
            </Card>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => openEdit(selected)}><Pencil className="mr-1 h-3 w-3" /> {t('common.edit')}</Button>
            <Button variant="outline" className="flex-1" onClick={handleExport}><Download className="mr-1 h-3 w-3" /> {t('common.export')}</Button>
            <Button variant="outline" className="text-destructive" onClick={() => setDeleteRecordId(selected.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('database.add_record')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{t('common.name')} *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Unit</Label><Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} type="email" /></div>
              <div className="space-y-1"><Label>{t('common.type')}</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residente">{t('database.residents')}</SelectItem>
                    <SelectItem value="comercio">{t('database.commercial')}</SelectItem>
                    <SelectItem value="proveedor">{t('database.providers')}</SelectItem>
                    <SelectItem value="empresa">{t('database.companies')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>{t('database.section')}</Label>
              <Select value={form.section_id} onValueChange={v => setForm(p => ({ ...p, section_id: v }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button className="w-full" onClick={handleAdd} disabled={!form.title.trim() || create.isPending}>{t('common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('common.edit')} — {editForm.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>{t('common.name')} *</Label><Input value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Unit</Label><Input value={editForm.unit} onChange={e => setEditForm(p => ({ ...p, unit: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Email</Label><Input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} type="email" /></div>
              <div className="space-y-1"><Label>{t('common.type')}</Label>
                <Select value={editForm.category} onValueChange={v => setEditForm(p => ({ ...p, category: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residente">{t('database.residents')}</SelectItem>
                    <SelectItem value="comercio">{t('database.commercial')}</SelectItem>
                    <SelectItem value="proveedor">{t('database.providers')}</SelectItem>
                    <SelectItem value="empresa">{t('database.companies')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>{t('database.section')}</Label>
              <Select value={editForm.section_id} onValueChange={v => setEditForm(p => ({ ...p, section_id: v }))}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{sections.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Notes</Label><Textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button className="w-full" onClick={handleEdit} disabled={!editForm.title.trim() || update.isPending}>{t('common.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Record Confirmation ─── */}
      <AlertDialog open={!!deleteRecordId} onOpenChange={open => { if (!open) setDeleteRecordId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteRecordId) {
                  remove.mutate(deleteRecordId);
                  if (selectedRecord === deleteRecordId) setSelectedRecord(null);
                  setDeleteRecordId(null);
                }
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
