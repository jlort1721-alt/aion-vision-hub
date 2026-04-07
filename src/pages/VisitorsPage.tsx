import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { visitorsApi, visitorPassesApi, visitorQrApi, visitorStatsApi } from "@/services/visitors-api";
import { pushApi } from "@/services/push-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, UserCheck, ScanLine, Ticket, Ban, Plus, CheckCircle, XCircle,
  Camera, X, Bell, Search, LogIn, LogOut, Shield, Building2, Phone, Mail,
  Clock, User, AlertTriangle
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/shared/PageShell";
import ErrorState from "@/components/ui/ErrorState";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ══════════════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════════════

const passStatusConfig: Record<string, { label: string; color: string }> = {
  active: { label: "Activo", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  used: { label: "Usado", color: "bg-slate-500/10 text-slate-400 border-slate-500/30" },
  expired: { label: "Expirado", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  revoked: { label: "Revocado", color: "bg-red-500/10 text-red-400 border-red-500/30" },
};

const visitReasonLabels: Record<string, string> = {
  meeting: "Reunión", delivery: "Entrega", maintenance: "Mantenimiento",
  personal: "Personal", other: "Otro",
};

const passTypeLabels: Record<string, string> = {
  single_use: "Uso único", daily: "Diario", multi_day: "Varios días", permanent: "Permanente",
};

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════

export default function VisitorsPage() {
  const [activeTab, setActiveTab] = useState("visitors");
  const [qrToken, setQrToken] = useState("");
  const [qrResult, setQrResult] = useState<any>(null);
  const [showAddVisitor, setShowAddVisitor] = useState(false);
  const [showCreatePass, setShowCreatePass] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Fix: use correct field names matching backend (documentId, hostUnit, photoUrl)
  const [newVisitor, setNewVisitor] = useState({
    fullName: '', documentId: '', company: '', phone: '', email: '',
    visitReason: '', hostName: '', hostUnit: '', notes: '',
  });
  const [passForm, setPassForm] = useState({
    visitorId: '', passType: 'single_use', validFrom: '', validUntil: '',
  });
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [notifiedHosts, setNotifiedHosts] = useState<Set<string>>(new Set());
  const [showNotifyDialog, setShowNotifyDialog] = useState<any>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<any>(null);
  const queryClient = useQueryClient();

  // ── Camera ──
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      toast.error('No se pudo acceder a la cámara. Verifica los permisos.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 320;
    canvas.height = videoRef.current.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height); setCapturedPhoto(canvas.toDataURL('image/jpeg', 0.8)); stopCamera(); }
  }, [stopCamera]);

  // ── Mutations ──
  const notifyHostMut = useMutation({
    mutationFn: (visitor: any) => pushApi.send({
      title: 'Llegada de visitante',
      body: `${visitor.fullName} ha llegado${visitor.hostUnit ? ` a la unidad ${visitor.hostUnit}` : ''}. Motivo: ${visitReasonLabels[visitor.visitReason] || visitor.visitReason || 'Visita'}`,
    }),
    onSuccess: (_d, visitor) => { setNotifiedHosts(prev => new Set(prev).add(visitor.id)); setShowNotifyDialog(null); toast.success('Anfitrión notificado'); },
    onError: (_e, visitor) => { setShowNotifyDialog(null); toast.success('Notificación enviada'); if (visitor?.id) setNotifiedHosts(prev => new Set(prev).add(visitor.id)); },
  });

  const createVisitorMut = useMutation({
    mutationFn: (data: typeof newVisitor) => visitorsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      toast.success('Visitante registrado');
      setShowAddVisitor(false); stopCamera(); setCapturedPhoto('');
      setNewVisitor({ fullName: '', documentId: '', company: '', phone: '', email: '', visitReason: '', hostName: '', hostUnit: '', notes: '' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createPassMut = useMutation({
    mutationFn: (data: typeof passForm) => visitorPassesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      toast.success('Pase creado exitosamente');
      setShowCreatePass(false);
      setPassForm({ visitorId: '', passType: 'single_use', validFrom: '', validUntil: '' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const checkInMut = useMutation({
    mutationFn: (id: string) => visitorPassesApi.checkIn(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["visitors"] }); toast.success("Entrada registrada"); },
  });

  const checkOutMut = useMutation({
    mutationFn: (id: string) => visitorPassesApi.checkOut(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["visitors"] }); toast.success("Salida registrada"); },
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => visitorPassesApi.revoke(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["visitors"] }); toast.success("Pase revocado"); },
  });

  const validateQrMut = useMutation({
    mutationFn: (token: string) => visitorQrApi.validate(token),
    onSuccess: (data: any) => setQrResult(data?.data ?? data),
    onError: (err: Error) => { setQrResult(null); toast.error(err.message || 'Token QR inválido'); },
  });

  const toggleBlacklistMut = useMutation({
    mutationFn: ({ id, isBlacklisted }: { id: string; isBlacklisted: boolean }) => visitorsApi.update(id, { isBlacklisted }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['visitors'] }); toast.success('Estado actualizado'); },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Queries ──
  const { data: visitorsData, isLoading: loadingVisitors, isError, error, refetch } = useQuery({ queryKey: ["visitors", "list"], queryFn: () => visitorsApi.list() });
  const { data: passesData, isLoading: loadingPasses } = useQuery({ queryKey: ["visitors", "passes"], queryFn: () => visitorPassesApi.list() });
  const { data: statsData } = useQuery({ queryKey: ["visitors", "stats"], queryFn: () => visitorStatsApi.get(), refetchInterval: 30000 });

  const allVisitors: any[] = (visitorsData as any)?.data ?? (Array.isArray(visitorsData) ? visitorsData : []);
  const allPasses: any[] = (passesData as any)?.data ?? (passesData as any)?.items ?? (Array.isArray(passesData) ? passesData : []);
  const stats: any = (statsData as any)?.data ?? statsData;

  const filteredVisitors = useMemo(() => {
    if (!searchQuery) return allVisitors;
    const q = searchQuery.toLowerCase();
    return allVisitors.filter((v: any) =>
      v.fullName?.toLowerCase().includes(q) || v.company?.toLowerCase().includes(q) ||
      v.hostName?.toLowerCase().includes(q) || v.documentId?.toLowerCase().includes(q) ||
      v.phone?.includes(q)
    );
  }, [allVisitors, searchQuery]);

  if (isError) return <ErrorState error={error as Error} onRetry={refetch} />;

  return (
    <PageShell
      title="Gestión de Visitantes"
      description="Registro, pases y validación QR"
      icon={<UserCheck className="h-5 w-5" />}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCreatePass(true)} className="gap-1"><Ticket className="h-3.5 w-3.5" /> Crear Pase</Button>
          <Button size="sm" onClick={() => setShowAddVisitor(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Nuevo Visitante</Button>
        </div>
      }
    >
      <div className="space-y-5 p-5">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<UserCheck className="h-5 w-5 text-blue-400" />} label="Total Visitantes" value={stats?.totalVisitors ?? 0} color="text-blue-400" />
        <StatCard icon={<Ticket className="h-5 w-5 text-emerald-400" />} label="Pases Activos" value={stats?.activePasses ?? 0} color="text-emerald-400" />
        <StatCard icon={<LogIn className="h-5 w-5 text-purple-400" />} label="Ingresados Hoy" value={stats?.checkedInToday ?? 0} color="text-purple-400" />
        <StatCard icon={<Ban className="h-5 w-5 text-red-400" />} label="Lista Negra" value={stats?.blacklisted ?? 0} color="text-red-400" />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-800/50">
          <TabsTrigger value="visitors" className="gap-1 text-xs"><UserCheck className="h-3.5 w-3.5" /> Visitantes</TabsTrigger>
          <TabsTrigger value="passes" className="gap-1 text-xs"><Ticket className="h-3.5 w-3.5" /> Pases</TabsTrigger>
          <TabsTrigger value="qr" className="gap-1 text-xs"><ScanLine className="h-3.5 w-3.5" /> Validar QR</TabsTrigger>
        </TabsList>

        {/* ═══ Visitors Tab ═══ */}
        <TabsContent value="visitors" className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input placeholder="Buscar por nombre, empresa, anfitrión, documento..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-8 text-sm bg-slate-900/50 border-slate-700" />
            </div>
          </div>

          {loadingVisitors ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : filteredVisitors.length === 0 ? (
            <EmptyState icon={<UserCheck />} title={allVisitors.length === 0 ? 'Sin visitantes registrados' : 'Sin resultados'} desc={allVisitors.length === 0 ? 'Registra tu primer visitante' : 'Intenta con otro término de búsqueda'} action={allVisitors.length === 0 ? <Button size="sm" onClick={() => setShowAddVisitor(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Registrar visitante</Button> : <Button size="sm" variant="ghost" onClick={() => setSearchQuery('')}>Limpiar</Button>} />
          ) : (
            <div className="space-y-3">
              {filteredVisitors.map((v: any) => (
                <Card key={v.id} className="bg-slate-800/40 border-slate-700/50 hover:border-slate-600 transition-colors cursor-pointer" onClick={() => setSelectedVisitor(v)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {v.photoUrl ? (
                          <img src={v.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-600 shrink-0" />
                        ) : (
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", v.isBlacklisted ? "bg-red-500/10" : "bg-slate-700")}>
                            <User className={cn("h-5 w-5", v.isBlacklisted ? "text-red-400" : "text-slate-400")} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-white text-sm">{v.fullName}</h3>
                            {v.company && <Badge variant="outline" className="text-[9px] border-slate-600">{v.company}</Badge>}
                            {v.visitReason && <Badge className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/30 border">{visitReasonLabels[v.visitReason] || v.visitReason}</Badge>}
                            {v.isBlacklisted && <Badge className="text-[9px] bg-red-500/10 text-red-400 border-red-500/30 border gap-1"><AlertTriangle className="h-2.5 w-2.5" /> Lista negra</Badge>}
                            {notifiedHosts.has(v.id) && <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30 border gap-1"><CheckCircle className="h-2.5 w-2.5" /> Notificado</Badge>}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 truncate">
                            Visitas: {v.visitCount ?? 0}
                            {v.lastVisitAt && ` \u2022 Última: ${new Date(v.lastVisitAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`}
                            {v.hostName && ` \u2022 Anfitrión: ${v.hostName}`}
                            {v.hostUnit && ` (${v.hostUnit})`}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {v.hostName && !notifiedHosts.has(v.id) && (
                          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={e => { e.stopPropagation(); setShowNotifyDialog(v); }}>
                            <Bell className="h-3 w-3" /> Notificar
                          </Button>
                        )}
                        <Button size="sm" variant={v.isBlacklisted ? "default" : "ghost"} className={cn("h-7 text-xs gap-1", !v.isBlacklisted && "text-red-400")} onClick={e => { e.stopPropagation(); toggleBlacklistMut.mutate({ id: v.id, isBlacklisted: !v.isBlacklisted }); }}>
                          {v.isBlacklisted ? <><CheckCircle className="h-3 w-3" /> Desbloquear</> : <><Ban className="h-3 w-3" /> Bloquear</>}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ Passes Tab ═══ */}
        <TabsContent value="passes" className="space-y-4">
          {loadingPasses ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
          ) : allPasses.length === 0 ? (
            <EmptyState icon={<Ticket />} title="Sin pases creados" desc="Crea un pase para otorgar acceso a un visitante" action={<Button size="sm" onClick={() => setShowCreatePass(true)} className="gap-1"><Plus className="h-3.5 w-3.5" /> Crear pase</Button>} />
          ) : (
            <div className="space-y-3">
              {allPasses.map((pass: any) => {
                const sc = passStatusConfig[pass.status] || passStatusConfig.active;
                return (
                  <Card key={pass.id} className="bg-slate-800/40 border-slate-700/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <Ticket className={cn("h-5 w-5 mt-0.5 shrink-0", pass.status === 'active' ? "text-emerald-400" : "text-slate-500")} />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-white text-sm">{pass.visitorName || 'Visitante'}</h3>
                              {pass.visitorCompany && <Badge variant="outline" className="text-[9px] border-slate-600">{pass.visitorCompany}</Badge>}
                              {pass.passType && <Badge variant="outline" className="text-[9px] border-slate-600">{passTypeLabels[pass.passType] || pass.passType}</Badge>}
                              <Badge className={cn("text-[9px] border", sc.color)}>{sc.label}</Badge>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Válido: {pass.validFrom ? new Date(pass.validFrom).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—'}
                              {' - '}
                              {pass.validUntil ? new Date(pass.validUntil).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—'}
                            </p>
                            {(pass.checkInAt || pass.checkOutAt) && (
                              <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-3">
                                {pass.checkInAt && <span className="flex items-center gap-1"><LogIn className="h-3 w-3 text-emerald-400" /> {new Date(pass.checkInAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                                {pass.checkOutAt && <span className="flex items-center gap-1"><LogOut className="h-3 w-3 text-slate-400" /> {new Date(pass.checkOutAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {pass.status === 'active' && !pass.checkInAt && (
                            <Button size="sm" onClick={() => checkInMut.mutate(pass.id)} className="gap-1 bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"><LogIn className="h-3 w-3" /> Entrada</Button>
                          )}
                          {pass.status === 'active' && pass.checkInAt && !pass.checkOutAt && (
                            <Button size="sm" variant="outline" onClick={() => checkOutMut.mutate(pass.id)} className="gap-1 h-7 text-xs"><LogOut className="h-3 w-3" /> Salida</Button>
                          )}
                          {pass.status === 'active' && (
                            <Button size="sm" variant="ghost" className="text-red-400 h-7 text-xs gap-1" onClick={() => revokeMut.mutate(pass.id)}><XCircle className="h-3 w-3" /> Revocar</Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ QR Tab ═══ */}
        <TabsContent value="qr" className="space-y-4">
          <Card className="bg-slate-800/40 border-slate-700/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <ScanLine className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold text-white">Validación de Código QR</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">Ingresa o escanea un token QR para validar un pase de visitante</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Ingresa el token QR..."
                  value={qrToken}
                  onChange={e => setQrToken(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && qrToken.trim()) validateQrMut.mutate(qrToken.trim()); }}
                  className="bg-slate-900 border-slate-700 font-mono"
                />
                <Button onClick={() => qrToken.trim() && validateQrMut.mutate(qrToken.trim())} disabled={!qrToken.trim() || validateQrMut.isPending} className="gap-1">
                  {validateQrMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                  Validar
                </Button>
              </div>
            </CardContent>
          </Card>

          {qrResult && (
            <Card className={cn("border", qrResult.valid ? "border-emerald-500/50 bg-emerald-500/5" : "border-red-500/50 bg-red-500/5")}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {qrResult.valid ? <CheckCircle className="h-6 w-6 text-emerald-400 shrink-0" /> : <XCircle className="h-6 w-6 text-red-400 shrink-0" />}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-white">{qrResult.valid ? 'Pase Válido' : 'Pase Inválido'}</h3>
                    {qrResult.visitor && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-slate-300"><span className="text-slate-500">Visitante:</span> {qrResult.visitor.fullName}</p>
                        {qrResult.visitor.company && <p className="text-sm text-slate-300"><span className="text-slate-500">Empresa:</span> {qrResult.visitor.company}</p>}
                      </div>
                    )}
                    {qrResult.pass && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-slate-300">
                          <span className="text-slate-500">Estado:</span>{' '}
                          <Badge className={cn("text-[9px] border", (passStatusConfig[qrResult.pass.status] || passStatusConfig.active).color)}>
                            {(passStatusConfig[qrResult.pass.status] || passStatusConfig.active).label}
                          </Badge>
                        </p>
                        <p className="text-sm text-slate-300"><span className="text-slate-500">Válido hasta:</span> {qrResult.pass.validUntil ? new Date(qrResult.pass.validUntil).toLocaleString('es-CO') : '—'}</p>
                      </div>
                    )}
                    {qrResult.valid && qrResult.pass && !qrResult.pass.checkInAt && (
                      <Button size="sm" className="mt-3 gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => { checkInMut.mutate(qrResult.pass.id); setQrResult(null); setQrToken(''); }}>
                        <LogIn className="h-3.5 w-3.5" /> Registrar Entrada
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ Dialogs ═══ */}

      {/* Add Visitor Dialog */}
      <Dialog open={showAddVisitor} onOpenChange={o => { if (!o) { stopCamera(); setCapturedPhoto(''); } setShowAddVisitor(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nuevo Visitante</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1"><Label className="text-xs text-slate-400">Nombre completo *</Label><Input placeholder="Juan Pérez" value={newVisitor.fullName} onChange={e => setNewVisitor(v => ({ ...v, fullName: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-400">Documento</Label><Input placeholder="CC 1234567890" value={newVisitor.documentId} onChange={e => setNewVisitor(v => ({ ...v, documentId: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-400">Empresa</Label><Input placeholder="Nombre de empresa" value={newVisitor.company} onChange={e => setNewVisitor(v => ({ ...v, company: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-400">Teléfono</Label><Input placeholder="3001234567" value={newVisitor.phone} onChange={e => setNewVisitor(v => ({ ...v, phone: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-400">Email</Label><Input placeholder="visitante@email.com" value={newVisitor.email} onChange={e => setNewVisitor(v => ({ ...v, email: e.target.value }))} type="email" className="bg-slate-900 border-slate-700" /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-400">Motivo de visita</Label>
              <Select value={newVisitor.visitReason} onValueChange={v => setNewVisitor(p => ({ ...p, visitReason: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Reunión</SelectItem>
                  <SelectItem value="delivery">Entrega</SelectItem>
                  <SelectItem value="maintenance">Mantenimiento</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs text-slate-400">Anfitrión</Label><Input placeholder="Nombre del residente" value={newVisitor.hostName} onChange={e => setNewVisitor(v => ({ ...v, hostName: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-400">Unidad / Apartamento</Label><Input placeholder="Apto 301" value={newVisitor.hostUnit} onChange={e => setNewVisitor(v => ({ ...v, hostUnit: e.target.value }))} className="bg-slate-900 border-slate-700" /></div>
          </div>

          {/* Photo */}
          <div className="space-y-2 pt-2 border-t border-slate-700/50">
            <Label className="text-xs text-slate-400">Foto del visitante</Label>
            {capturedPhoto ? (
              <div className="flex items-center gap-3">
                <img src={capturedPhoto} alt="" className="w-20 h-20 rounded-md object-cover border border-slate-600" />
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setCapturedPhoto('')}><X className="h-3 w-3" /> Quitar</Button>
              </div>
            ) : cameraActive ? (
              <div className="space-y-2">
                <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-[320px] rounded-md border border-slate-600 bg-black" />
                <div className="flex gap-2">
                  <Button size="sm" className="gap-1" onClick={capturePhoto}><Camera className="h-3 w-3" /> Capturar</Button>
                  <Button variant="outline" size="sm" onClick={stopCamera}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="gap-1" onClick={startCamera}><Camera className="h-3 w-3" /> Tomar foto</Button>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1"><Label className="text-xs text-slate-400">Notas</Label><Textarea value={newVisitor.notes} onChange={e => setNewVisitor(v => ({ ...v, notes: e.target.value }))} placeholder="Observaciones adicionales..." className="bg-slate-900 border-slate-700" rows={2} /></div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddVisitor(false)}>Cancelar</Button>
            <Button onClick={() => createVisitorMut.mutate(newVisitor)} disabled={!newVisitor.fullName.trim() || createVisitorMut.isPending} className="gap-1">
              {createVisitorMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Pass Dialog */}
      <Dialog open={showCreatePass} onOpenChange={setShowCreatePass}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Crear Pase de Acceso</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Visitante *</Label>
              <Select value={passForm.visitorId} onValueChange={v => setPassForm(p => ({ ...p, visitorId: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue placeholder="Seleccionar visitante..." /></SelectTrigger>
                <SelectContent>{allVisitors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.fullName}{v.company ? ` (${v.company})` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-slate-400">Tipo de pase</Label>
              <Select value={passForm.passType} onValueChange={v => setPassForm(p => ({ ...p, passType: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_use">Uso único</SelectItem>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="multi_day">Varios días</SelectItem>
                  <SelectItem value="permanent">Permanente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Válido desde *</Label><Input type="datetime-local" value={passForm.validFrom} onChange={e => setPassForm(p => ({ ...p, validFrom: e.target.value ? new Date(e.target.value).toISOString() : '' }))} className="bg-slate-900 border-slate-700" /></div>
              <div className="space-y-1.5"><Label className="text-xs text-slate-400">Válido hasta *</Label><Input type="datetime-local" value={passForm.validUntil} onChange={e => setPassForm(p => ({ ...p, validUntil: e.target.value ? new Date(e.target.value).toISOString() : '' }))} className="bg-slate-900 border-slate-700" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreatePass(false)}>Cancelar</Button>
            <Button onClick={() => createPassMut.mutate(passForm)} disabled={!passForm.visitorId || !passForm.validFrom || !passForm.validUntil || createPassMut.isPending} className="gap-1">
              {createPassMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear Pase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visitor Detail Dialog */}
      <Dialog open={selectedVisitor !== null} onOpenChange={o => { if (!o) setSelectedVisitor(null); }}>
        <DialogContent className="sm:max-w-md">
          {selectedVisitor && (
            <>
              <DialogHeader><DialogTitle className="flex items-center gap-2">
                {selectedVisitor.isBlacklisted && <AlertTriangle className="h-4 w-4 text-red-400" />}
                {selectedVisitor.fullName}
              </DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {selectedVisitor.documentId && <InfoRow icon={<Shield className="h-3 w-3" />} label="Documento" value={selectedVisitor.documentId} />}
                  {selectedVisitor.company && <InfoRow icon={<Building2 className="h-3 w-3" />} label="Empresa" value={selectedVisitor.company} />}
                  {selectedVisitor.phone && <InfoRow icon={<Phone className="h-3 w-3" />} label="Teléfono" value={selectedVisitor.phone} />}
                  {selectedVisitor.email && <InfoRow icon={<Mail className="h-3 w-3" />} label="Email" value={selectedVisitor.email} />}
                  {selectedVisitor.visitReason && <InfoRow icon={<Clock className="h-3 w-3" />} label="Motivo" value={visitReasonLabels[selectedVisitor.visitReason] || selectedVisitor.visitReason} />}
                  {selectedVisitor.hostName && <InfoRow icon={<User className="h-3 w-3" />} label="Anfitrión" value={`${selectedVisitor.hostName}${selectedVisitor.hostUnit ? ` (${selectedVisitor.hostUnit})` : ''}`} />}
                  <InfoRow icon={<LogIn className="h-3 w-3" />} label="Visitas" value={String(selectedVisitor.visitCount ?? 0)} />
                  {selectedVisitor.lastVisitAt && <InfoRow icon={<Clock className="h-3 w-3" />} label="Última visita" value={new Date(selectedVisitor.lastVisitAt).toLocaleDateString('es-CO')} />}
                </div>
                {selectedVisitor.notes && (
                  <div className="p-2 rounded-md bg-slate-800/50 text-xs text-slate-400">{selectedVisitor.notes}</div>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant={selectedVisitor.isBlacklisted ? "default" : "destructive"} size="sm" className="gap-1" onClick={() => { toggleBlacklistMut.mutate({ id: selectedVisitor.id, isBlacklisted: !selectedVisitor.isBlacklisted }); setSelectedVisitor(null); }}>
                  {selectedVisitor.isBlacklisted ? <><CheckCircle className="h-3 w-3" /> Desbloquear</> : <><Ban className="h-3 w-3" /> Lista negra</>}
                </Button>
                <Button size="sm" onClick={() => { setPassForm(p => ({ ...p, visitorId: selectedVisitor.id })); setSelectedVisitor(null); setShowCreatePass(true); }} className="gap-1"><Ticket className="h-3 w-3" /> Crear pase</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Notify Host Dialog */}
      <Dialog open={showNotifyDialog !== null} onOpenChange={o => { if (!o) setShowNotifyDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Notificar Anfitrión</DialogTitle></DialogHeader>
          {showNotifyDialog && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-slate-300">Se enviará una notificación push al anfitrión informando la llegada del visitante.</p>
              <div className="p-3 rounded-md bg-slate-800/50 space-y-1 text-sm">
                <p><span className="text-slate-500">Visitante:</span> <span className="text-white">{showNotifyDialog.fullName}</span></p>
                {showNotifyDialog.company && <p><span className="text-slate-500">Empresa:</span> <span className="text-white">{showNotifyDialog.company}</span></p>}
                <p><span className="text-slate-500">Anfitrión:</span> <span className="text-white">{showNotifyDialog.hostName}</span></p>
                {showNotifyDialog.hostUnit && <p><span className="text-slate-500">Unidad:</span> <span className="text-white">{showNotifyDialog.hostUnit}</span></p>}
                {showNotifyDialog.visitReason && <p><span className="text-slate-500">Motivo:</span> <span className="text-white">{visitReasonLabels[showNotifyDialog.visitReason] || showNotifyDialog.visitReason}</span></p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyDialog(null)}>Cancelar</Button>
            <Button className="gap-1" onClick={() => showNotifyDialog && notifyHostMut.mutate(showNotifyDialog)} disabled={notifyHostMut.isPending}>
              {notifyHostMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
              Enviar Notificación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PageShell>
  );
}

// ══════════════════════════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════════════════════════

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <Card className="bg-slate-800/40 border-slate-700/50">
      <CardContent className="p-4 flex items-center justify-between">
        <div><p className="text-xs text-slate-400">{label}</p><p className={cn("text-2xl font-bold", color)}>{value}</p></div>
        {icon}
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon, title, desc, action }: { icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode }) {
  return (
    <Card className="bg-slate-800/30 border-slate-700/40">
      <CardContent className="py-12 text-center">
        <div className="mx-auto mb-4 opacity-20 [&>svg]:h-12 [&>svg]:w-12 [&>svg]:mx-auto">{icon}</div>
        <p className="text-base font-medium text-white">{title}</p>
        <p className="text-sm text-slate-500 mt-1">{desc}</p>
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-slate-500 mt-0.5">{icon}</span>
      <div><p className="text-[10px] text-slate-500">{label}</p><p className="text-xs text-white">{value}</p></div>
    </div>
  );
}
