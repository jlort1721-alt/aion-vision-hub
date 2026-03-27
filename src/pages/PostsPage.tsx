import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useToast } from '@/hooks/use-toast';
import { useSites, useDevices } from '@/hooks/use-supabase-data';
import {
  Building2, Shield, UserX, AlertTriangle, Video, DoorOpen, Phone, ScrollText,
  Plus, Search, MoreVertical, CheckCircle2, XCircle, AlertCircle, User,
  Clock, Cpu, Radio, Camera, Pencil, Trash2, Eye, MapPin, Layers,
} from 'lucide-react';

// ── Types ──

interface PostConfig {
  floor?: string;
  zone?: string;
  gateDeviceId?: string;
  intercomDeviceId?: string;
  lprCameraId?: string;
  devices?: string[];
}

interface Post {
  id: string;
  tenant_id: string;
  site_id: string | null;
  name: string;
  type: string;
  description: string | null;
  order_index: number;
  is_active: boolean;
  config: PostConfig;
  created_at: string;
  updated_at: string;
}

interface ShiftAssignment {
  id: string;
  user_id: string;
  shift_id: string;
  status: string;
  date: string;
  check_in_at: string | null;
  notes: string | null;
}

// ── Component ──

export default function PostsPage() {
  const { isAuthenticated, profile } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSiteId, setFormSiteId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formZone, setFormZone] = useState('');
  const [formGateDeviceId, setFormGateDeviceId] = useState('');
  const [formIntercomDeviceId, setFormIntercomDeviceId] = useState('');
  const [formLprCameraId, setFormLprCameraId] = useState('');
  const [formDevices, setFormDevices] = useState<string[]>([]);

  // ── Data fetching ──

  const { data: sites = [], isLoading: loadingSites } = useSites();
  const { data: devices = [], isLoading: loadingDevices } = useDevices();

  const { data: posts = [], isLoading: loadingPosts } = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const response = await apiClient.get<any>('/database-records', { category: 'post' });
      return (Array.isArray(response.data) ? response.data : []) as Post[];
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: shiftAssignments = [] } = useQuery({
    queryKey: ['shift-assignments-today'],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const response = await apiClient.get<any>('/shifts/assignments', { date: today, status: 'scheduled,checked_in' });
      return (Array.isArray(response.data) ? response.data : []) as unknown as ShiftAssignment[];
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const response = await apiClient.get<any>('/users');
      return (Array.isArray(response.data) ? response.data : []).map((u: any) => ({ id: u.id, full_name: u.fullName || u.full_name, email: u.email }));
    },
    enabled: isAuthenticated,
  });

  const { data: accessLogs = [] } = useQuery({
    queryKey: ['access-logs-recent', selectedPost?.id],
    queryFn: async () => {
      if (!selectedPost) return [];
      const response = await apiClient.get<any>('/access-control/logs', { section_id: selectedPost.id, limit: '10' });
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: isAuthenticated && !!selectedPost,
  });

  const { data: automationRules = [] } = useQuery({
    queryKey: ['automation-rules-post', selectedPost?.id],
    queryFn: async () => {
      if (!selectedPost) return [];
      const response = await apiClient.get<any>('/automation/rules', { sectionId: selectedPost.id });
      return Array.isArray(response.data) ? response.data : [];
    },
    enabled: isAuthenticated && !!selectedPost,
  });

  // ── Mutations ──

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response: any = await apiClient.post('/database-records', { ...payload, category: 'post' });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({ title: 'Puesto creado exitosamente' });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: 'Error al crear puesto', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) => {
      const response: any = await apiClient.patch(`/database-records/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({ title: 'Puesto actualizado exitosamente' });
      setDialogOpen(false);
      setEditingPost(null);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: 'Error al actualizar puesto', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/database-records/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({ title: 'Puesto eliminado' });
      setDeleteTarget(null);
      if (selectedPost) {
        setSelectedPost(null);
        setSheetOpen(false);
      }
    },
    onError: (err: any) => {
      toast({ title: 'Error al eliminar puesto', description: err.message, variant: 'destructive' });
    },
  });

  // ── Helpers ──

  function resetForm() {
    setFormName('');
    setFormSiteId('');
    setFormDescription('');
    setFormFloor('');
    setFormZone('');
    setFormGateDeviceId('');
    setFormIntercomDeviceId('');
    setFormLprCameraId('');
    setFormDevices([]);
  }

  function openCreate() {
    setEditingPost(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(post: Post) {
    setEditingPost(post);
    setFormName(post.name);
    setFormSiteId(post.site_id || '');
    setFormDescription(post.description || '');
    setFormFloor(post.config?.floor || '');
    setFormZone(post.config?.zone || '');
    setFormGateDeviceId(post.config?.gateDeviceId || '');
    setFormIntercomDeviceId(post.config?.intercomDeviceId || '');
    setFormLprCameraId(post.config?.lprCameraId || '');
    setFormDevices(post.config?.devices || []);
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!formName.trim()) {
      toast({ title: 'El nombre es requerido', variant: 'destructive' });
      return;
    }
    const config: PostConfig = {
      floor: formFloor || undefined,
      zone: formZone || undefined,
      gateDeviceId: formGateDeviceId || undefined,
      intercomDeviceId: formIntercomDeviceId || undefined,
      lprCameraId: formLprCameraId || undefined,
      devices: formDevices.length > 0 ? formDevices : undefined,
    };
    const payload: any = {
      name: formName.trim(),
      type: 'post',
      site_id: formSiteId || null,
      description: formDescription.trim() || null,
      config,
      tenant_id: profile?.tenant_id,
    };
    if (editingPost) {
      updateMutation.mutate({ id: editingPost.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function openDetail(post: Post) {
    setSelectedPost(post);
    setSheetOpen(true);
  }

  const getPostStatus = useCallback((post: Post): 'activo' | 'sin_operador' | 'fuera_de_servicio' => {
    if (!post.is_active) return 'fuera_de_servicio';
    // Check if any shift assignment references this post's site
    const hasOperator = shiftAssignments.some(sa => sa.status === 'checked_in');
    // Simple heuristic: if post is active but no checked-in guard in the tenant, mark yellow
    return hasOperator ? 'activo' : 'sin_operador';
  }, [shiftAssignments]);

  function getStatusBadge(status: string) {
    switch (status) {
      case 'activo':
        return <Badge className="bg-success/20 text-success border-success/30">Activo</Badge>;
      case 'sin_operador':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Sin Operador</Badge>;
      case 'fuera_de_servicio':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Fuera de Servicio</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  }

  function getGuardName(userId: string) {
    const p = profiles.find((pr: any) => pr.id === userId);
    return p ? (p as any).full_name || (p as any).email : userId.slice(0, 8);
  }

  function getSiteName(siteId: string | null) {
    if (!siteId) return 'Sin sitio';
    const s = sites.find((s: any) => s.id === siteId);
    return s ? (s as any).name : siteId.slice(0, 8);
  }

  function getDeviceName(deviceId: string) {
    const d = devices.find((d: any) => d.id === deviceId);
    return d ? (d as any).name : deviceId.slice(0, 8);
  }

  function getPostDevices(post: Post) {
    const ids = post.config?.devices || [];
    return devices.filter((d: any) => ids.includes(d.id));
  }

  function toggleDeviceSelection(deviceId: string) {
    setFormDevices(prev =>
      prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]
    );
  }

  // ── Computed ──

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const matchSearch = !search || post.name.toLowerCase().includes(search.toLowerCase()) ||
        (post.description && post.description.toLowerCase().includes(search.toLowerCase()));
      const matchSite = siteFilter === 'all' || post.site_id === siteFilter;
      const matchStatus = statusFilter === 'all' || getPostStatus(post) === statusFilter;
      return matchSearch && matchSite && matchStatus;
    });
  }, [posts, search, siteFilter, statusFilter, getPostStatus]);

  const totalPosts = posts.length;
  const activePosts = posts.filter(p => p.is_active).length;
  const mannedPosts = posts.filter(p => getPostStatus(p) === 'activo').length;
  const unmannedPosts = posts.filter(p => getPostStatus(p) === 'sin_operador').length;
  const outOfServicePosts = posts.filter(p => getPostStatus(p) === 'fuera_de_servicio').length;

  const loading = loadingPosts || loadingSites || loadingDevices;

  // ── Render ──

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('posts.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('posts.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> {t('posts.add_post')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-12" /></div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('posts.total_posts')}</p>
                  <p className="text-2xl font-bold mt-1">{totalPosts}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{activePosts} activos</p>
                </div>
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-12" /></div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('posts.manned_posts')}</p>
                  <p className="text-2xl font-bold mt-1">{mannedPosts}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('posts.with_operator')}</p>
                </div>
                <Shield className="h-5 w-5 text-success" />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-12" /></div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('posts.unmanned_posts')}</p>
                  <p className="text-2xl font-bold mt-1">{unmannedPosts}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('posts.need_operator')}</p>
                </div>
                <UserX className="h-5 w-5 text-warning" />
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-12" /></div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('posts.out_of_service')}</p>
                  <p className="text-2xl font-bold mt-1">{outOfServicePosts}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('posts.inactive_posts')}</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('posts.search_placeholder')}
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('posts.all_sites')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('posts.all_sites')}</SelectItem>
            {sites.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('posts.all_status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('posts.all_status')}</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="sin_operador">Sin Operador</SelectItem>
            <SelectItem value="fuera_de_servicio">Fuera de Servicio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Post Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-3"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-32" /><Skeleton className="h-8 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center text-muted-foreground">
            <Building2 className="h-10 w-10 mb-3" />
            <p className="text-sm">{totalPosts === 0 ? t('posts.no_posts') : t('posts.no_match')}</p>
            {totalPosts === 0 && (
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> {t('posts.add_first')}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPosts.map(post => {
            const status = getPostStatus(post);
            const postDevices = getPostDevices(post);
            const cameraCount = postDevices.filter((d: any) => d.type === 'camera' || d.type === 'lpr').length;
            const intercomCount = postDevices.filter((d: any) => d.type === 'intercom').length;
            const accessCount = postDevices.filter((d: any) => d.type === 'access_panel' || d.type === 'access_control').length;
            const relayCount = postDevices.filter((d: any) => d.type === 'relay' || d.type === 'domotics').length;

            return (
              <Card
                key={post.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => openDetail(post)}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{post.name}</h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {getSiteName(post.site_id)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(status)}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(post); }}>
                            <Pencil className="mr-2 h-4 w-4" /> {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={e => { e.stopPropagation(); setDeleteTarget(post); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Zone/Floor */}
                  {(post.config?.zone || post.config?.floor) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {post.config.zone && <span>Zona: {post.config.zone}</span>}
                      {post.config.zone && post.config.floor && <span> | </span>}
                      {post.config.floor && <span>Piso: {post.config.floor}</span>}
                    </p>
                  )}

                  {/* Connected devices summary */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {cameraCount > 0 && (
                      <span className="flex items-center gap-1"><Camera className="h-3.5 w-3.5" /> {cameraCount}</span>
                    )}
                    {intercomCount > 0 && (
                      <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {intercomCount}</span>
                    )}
                    {accessCount > 0 && (
                      <span className="flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" /> {accessCount}</span>
                    )}
                    {relayCount > 0 && (
                      <span className="flex items-center gap-1"><Radio className="h-3.5 w-3.5" /> {relayCount}</span>
                    )}
                    {postDevices.length === 0 && (
                      <span className="text-muted-foreground/50">{t('posts.no_devices')}</span>
                    )}
                  </div>

                  {/* Quick actions */}
                  <div className="flex gap-1.5 pt-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={e => { e.stopPropagation(); openDetail(post); }}>
                      <Video className="mr-1 h-3 w-3" /> {t('posts.view_cameras')}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={e => { e.stopPropagation(); openDetail(post); }}>
                      <DoorOpen className="mr-1 h-3 w-3" /> {t('posts.open_gate')}
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); openDetail(post); }}>
                      <Phone className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={e => { e.stopPropagation(); openDetail(post); }}>
                      <ScrollText className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Detail Sheet (right sidebar) ── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedPost && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" /> {selectedPost.name}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Post Info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('posts.post_info')}</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('posts.site_label')}:</span>
                      <p className="font-medium">{getSiteName(selectedPost.site_id)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('posts.zone_label')}:</span>
                      <p className="font-medium">{selectedPost.config?.zone || '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('posts.floor_label')}:</span>
                      <p className="font-medium">{selectedPost.config?.floor || '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('common.status')}:</span>
                      <div className="mt-0.5">{getStatusBadge(getPostStatus(selectedPost))}</div>
                    </div>
                  </div>
                  {selectedPost.description && (
                    <p className="text-sm text-muted-foreground">{selectedPost.description}</p>
                  )}
                </div>

                {/* Current Assignment */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('posts.current_assignment')}</h4>
                  {shiftAssignments.filter(sa => sa.status === 'checked_in').length > 0 ? (
                    shiftAssignments.filter(sa => sa.status === 'checked_in').slice(0, 3).map(sa => (
                      <div key={sa.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                        <User className="h-4 w-4 text-success" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{getGuardName(sa.user_id)}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {sa.check_in_at ? `Desde ${new Date(sa.check_in_at).toLocaleTimeString('es')}` : 'Programado'}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">{sa.status === 'checked_in' ? 'En turno' : 'Programado'}</Badge>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-md bg-warning/10 border border-warning/20">
                      <UserX className="h-4 w-4 text-warning" />
                      <p className="text-sm text-warning">{t('posts.no_operator_assigned')}</p>
                    </div>
                  )}
                </div>

                {/* Devices List */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('posts.connected_devices')}</h4>
                  {getPostDevices(selectedPost).length > 0 ? (
                    <div className="space-y-2">
                      {getPostDevices(selectedPost).map((device: any) => (
                        <div key={device.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                          {device.type === 'camera' || device.type === 'lpr' ? <Camera className="h-4 w-4 text-primary" /> :
                           device.type === 'intercom' ? <Phone className="h-4 w-4 text-purple-400" /> :
                           device.type === 'access_panel' || device.type === 'access_control' ? <DoorOpen className="h-4 w-4 text-orange-400" /> :
                           <Cpu className="h-4 w-4 text-muted-foreground" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{device.name}</p>
                            <p className="text-xs text-muted-foreground">{device.type} {device.ip_address ? `| ${device.ip_address}` : ''}</p>
                          </div>
                          {device.status === 'online' ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('posts.no_devices')}</p>
                  )}

                  {/* Special devices */}
                  {selectedPost.config?.gateDeviceId && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                      <DoorOpen className="h-3.5 w-3.5" />
                      <span>{t('posts.gate_device')}: {getDeviceName(selectedPost.config.gateDeviceId)}</span>
                    </div>
                  )}
                  {selectedPost.config?.intercomDeviceId && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      <span>{t('posts.intercom_device')}: {getDeviceName(selectedPost.config.intercomDeviceId)}</span>
                    </div>
                  )}
                  {selectedPost.config?.lprCameraId && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Camera className="h-3.5 w-3.5" />
                      <span>{t('posts.lpr_camera')}: {getDeviceName(selectedPost.config.lprCameraId)}</span>
                    </div>
                  )}
                </div>

                {/* Recent Activity */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('posts.recent_activity')}</h4>
                  {accessLogs.length > 0 ? (
                    <div className="space-y-1.5">
                      {accessLogs.map((log: any) => (
                        <div key={log.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 text-sm">
                          <ScrollText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="truncate">{log.person_name || log.description || 'Acceso registrado'}</p>
                            <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString('es')}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">{log.direction || log.method || '—'}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('posts.no_recent_activity')}</p>
                  )}
                </div>

                {/* Automation Rules */}
                {automationRules.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t('posts.automation_rules')}</h4>
                    <div className="space-y-1.5">
                      {automationRules.map((rule: any) => (
                        <div key={rule.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                          <Cpu className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm">{rule.name}</span>
                          <Badge variant={rule.is_active ? 'default' : 'secondary'} className="ml-auto text-[10px]">
                            {rule.is_active ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => { openEdit(selectedPost); setSheetOpen(false); }}>
                    <Pencil className="mr-2 h-4 w-4" /> {t('common.edit')}
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => { setDeleteTarget(selectedPost); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Puesto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar el puesto <strong>"{deleteTarget?.name}"</strong>? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPost ? t('posts.edit_post') : t('posts.create_post')}
            </DialogTitle>
            <DialogDescription>
              {editingPost ? t('posts.edit_post_desc') : t('posts.create_post_desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>{t('posts.name_label')} *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Porteria Principal" />
            </div>

            {/* Site */}
            <div className="space-y-2">
              <Label>{t('posts.site_label')}</Label>
              <Select value={formSiteId} onValueChange={setFormSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('posts.select_site')} />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Zone */}
            <div className="space-y-2">
              <Label>{t('posts.zone_label')}</Label>
              <Input value={formZone} onChange={e => setFormZone(e.target.value)} placeholder="Zona Norte" />
            </div>

            {/* Floor */}
            <div className="space-y-2">
              <Label>{t('posts.floor_label')}</Label>
              <Input value={formFloor} onChange={e => setFormFloor(e.target.value)} placeholder="1" />
            </div>

            {/* Description */}
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('common.description')}</Label>
              <Textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder={t('posts.description_placeholder')}
                rows={2}
              />
            </div>

            {/* Gate Device */}
            <div className="space-y-2">
              <Label>{t('posts.gate_device')}</Label>
              <Select value={formGateDeviceId} onValueChange={setFormGateDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('posts.select_device')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— {t('posts.none')} —</SelectItem>
                  {devices.filter((d: any) => d.type === 'relay' || d.type === 'domotics' || d.type === 'access_control').map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Intercom Device */}
            <div className="space-y-2">
              <Label>{t('posts.intercom_device')}</Label>
              <Select value={formIntercomDeviceId} onValueChange={setFormIntercomDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('posts.select_device')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— {t('posts.none')} —</SelectItem>
                  {devices.filter((d: any) => d.type === 'intercom').map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* LPR Camera */}
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('posts.lpr_camera')}</Label>
              <Select value={formLprCameraId} onValueChange={setFormLprCameraId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('posts.select_device')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— {t('posts.none')} —</SelectItem>
                  {devices.filter((d: any) => d.type === 'camera' || d.type === 'lpr').map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Device Assignments (multi-select) */}
            <div className="space-y-2 sm:col-span-2">
              <Label>{t('posts.assigned_devices')} ({formDevices.length})</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-1.5">
                {devices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">{t('posts.no_devices_available')}</p>
                ) : (
                  devices.map((d: any) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-3 p-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={formDevices.includes(d.id)}
                        onChange={() => toggleDeviceSelection(d.id)}
                        className="rounded border-input"
                      />
                      <span className="flex-1 truncate">{d.name}</span>
                      <Badge variant="outline" className="text-[10px]">{d.type}</Badge>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? t('common.loading') : (editingPost ? t('common.save') : t('common.create'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
