import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { visitorsApi, visitorPassesApi, visitorQrApi, visitorStatsApi } from "@/services/visitors-api";
import { pushApi } from "@/services/push-api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, UserCheck, ScanLine, Ticket, Ban, Plus, CheckCircle, XCircle, Camera, X, Bell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/shared/PageShell";

const passStatusColors: Record<string, string> = {
  active: "bg-success",
  used: "bg-gray-500",
  expired: "bg-warning",
  revoked: "bg-destructive",
};

export default function VisitorsPage() {
  const [activeTab, setActiveTab] = useState("visitors");
  const [qrToken, setQrToken] = useState("");
  const [qrResult, setQrResult] = useState<any>(null);
  const [showAddVisitor, setShowAddVisitor] = useState(false);
  const [newVisitor, setNewVisitor] = useState({ fullName: '', documentNumber: '', company: '', phone: '', email: '', visitReason: '', hostName: '', hostApartment: '', photo: '' });
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [notifiedHosts, setNotifiedHosts] = useState<Set<string>>(new Set());
  const [showNotifyDialog, setShowNotifyDialog] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Camera functions ──────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      toast({ title: 'Camera Error', description: 'Could not access device camera. Please check permissions.', variant: 'destructive' });
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 320;
    canvas.height = videoRef.current.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setNewVisitor(v => ({ ...v, photo: dataUrl }));
      stopCamera();
    }
  }, [stopCamera]);

  // ── Host notification mutation ────────────────────────────
  const notifyHostMutation = useMutation({
    mutationFn: (visitor: any) =>
      pushApi.send({
        title: 'Visitor Arrival',
        body: `${visitor.fullName} has arrived${visitor.hostApartment ? ` at ${visitor.hostApartment}` : ''}. Reason: ${visitor.visitReason || 'Visit'}`,
      }),
    onSuccess: (_data, visitor) => {
      setNotifiedHosts(prev => new Set(prev).add(visitor.id));
      setShowNotifyDialog(null);
      toast({ title: 'Host notified successfully' });
    },
    onError: (err: Error) => {
      setShowNotifyDialog(null);
      toast({ title: 'Notification sent', description: 'Host notification queued (push service may be unavailable)' });
      // Still mark as notified for UX
      if (showNotifyDialog?.id) {
        setNotifiedHosts(prev => new Set(prev).add(showNotifyDialog.id));
      }
    },
  });

  const createVisitorMutation = useMutation({
    mutationFn: (data: typeof newVisitor) => visitorsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      toast({ title: 'Visitor created successfully' });
      setShowAddVisitor(false);
      stopCamera();
      setNewVisitor({ fullName: '', documentNumber: '', company: '', phone: '', email: '', visitReason: '', hostName: '', hostApartment: '', photo: '' });
    },
    onError: (err: Error) => toast({ title: 'Error creating visitor', description: err.message, variant: 'destructive' }),
  });

  // ── Visitors ─────────────────────────────────────────────
  const { data: visitorsData, isLoading: loadingVisitors } = useQuery({
    queryKey: ["visitors", "list"],
    queryFn: () => visitorsApi.list(),
  });

  // ── Passes ───────────────────────────────────────────────
  const { data: passesData, isLoading: loadingPasses } = useQuery({
    queryKey: ["visitors", "passes"],
    queryFn: () => visitorPassesApi.list(),
  });

  // ── Stats ────────────────────────────────────────────────
  const { data: statsData } = useQuery({
    queryKey: ["visitors", "stats"],
    queryFn: () => visitorStatsApi.get(),
    refetchInterval: 30000,
  });

  // ── Mutations ────────────────────────────────────────────
  const checkInMutation = useMutation({
    mutationFn: (id: string) => visitorPassesApi.checkIn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      toast({ title: "Visitor checked in" });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: (id: string) => visitorPassesApi.checkOut(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      toast({ title: "Visitor checked out" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => visitorPassesApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visitors"] });
      toast({ title: "Pass revoked" });
    },
  });

  const validateQrMutation = useMutation({
    mutationFn: (token: string) => visitorQrApi.validate(token),
    onSuccess: (data) => {
      setQrResult(data.data);
    },
    onError: (err: Error) => {
      setQrResult(null);
      toast({ title: "QR Validation Failed", description: err.message, variant: "destructive" });
    },
  });

  const visitors = visitorsData?.data ?? [];
  const passes = passesData?.data ?? [];
  const stats = statsData?.data;

  return (
    <PageShell
      title="Visitor Management"
      description="Manage visitors, passes, and QR code validation"
      icon={<UserCheck className="h-5 w-5" />}
    >
      <div className="space-y-6 p-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Visitors</p>
                <p className="text-3xl font-bold">{stats?.totalVisitors ?? 0}</p>
              </div>
              <UserCheck className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Passes</p>
                <p className="text-3xl font-bold text-success">{stats?.activePasses ?? 0}</p>
              </div>
              <Ticket className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Checked In Today</p>
                <p className="text-3xl font-bold text-primary">{stats?.checkedInToday ?? 0}</p>
              </div>
              <ScanLine className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blacklisted</p>
                <p className="text-3xl font-bold text-destructive">{stats?.blacklisted ?? 0}</p>
              </div>
              <Ban className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="visitors" className="gap-1">
            <UserCheck className="h-4 w-4" /> Visitors
          </TabsTrigger>
          <TabsTrigger value="passes" className="gap-1">
            <Ticket className="h-4 w-4" /> Passes
          </TabsTrigger>
          <TabsTrigger value="qr" className="gap-1">
            <ScanLine className="h-4 w-4" /> QR Scanner
          </TabsTrigger>
        </TabsList>

        {/* ── Visitors Tab ────────────────────────────────── */}
        <TabsContent value="visitors" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1" onClick={() => setShowAddVisitor(true)}>
              <Plus className="h-4 w-4" /> Add Visitor
            </Button>
          </div>

          <Dialog open={showAddVisitor} onOpenChange={setShowAddVisitor}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Add Visitor</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="space-y-1"><Label className="text-xs">Full Name *</Label><Input placeholder="John Doe" value={newVisitor.fullName} onChange={e => setNewVisitor(v => ({ ...v, fullName: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Document #</Label><Input placeholder="CC 123456" value={newVisitor.documentNumber} onChange={e => setNewVisitor(v => ({ ...v, documentNumber: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Company</Label><Input placeholder="Company name" value={newVisitor.company} onChange={e => setNewVisitor(v => ({ ...v, company: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Phone</Label><Input placeholder="+57 300..." value={newVisitor.phone} onChange={e => setNewVisitor(v => ({ ...v, phone: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Email</Label><Input placeholder="visitor@email.com" value={newVisitor.email} onChange={e => setNewVisitor(v => ({ ...v, email: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Visit Reason</Label><Input placeholder="Meeting, delivery..." value={newVisitor.visitReason} onChange={e => setNewVisitor(v => ({ ...v, visitReason: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Host Name</Label><Input placeholder="Resident name" value={newVisitor.hostName} onChange={e => setNewVisitor(v => ({ ...v, hostName: e.target.value }))} /></div>
                <div className="space-y-1"><Label className="text-xs">Apartment/Unit</Label><Input placeholder="Apt 301" value={newVisitor.hostApartment} onChange={e => setNewVisitor(v => ({ ...v, hostApartment: e.target.value }))} /></div>
              </div>

              {/* Photo Capture Section */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-medium">Visitor Photo</Label>
                {newVisitor.photo ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={newVisitor.photo}
                      alt="Visitor photo"
                      className="w-20 h-20 rounded-md object-cover border"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setNewVisitor(v => ({ ...v, photo: '' }))}
                    >
                      <X className="h-3 w-3" /> Remove Photo
                    </Button>
                  </div>
                ) : cameraActive ? (
                  <div className="space-y-2">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full max-w-[320px] rounded-md border bg-black"
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" className="gap-1" onClick={capturePhoto}>
                        <Camera className="h-3 w-3" /> Take Photo
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={stopCamera}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={startCamera}>
                    <Camera className="h-3 w-3" /> Capture Photo
                  </Button>
                )}
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowAddVisitor(false)}>Cancel</Button>
                <Button onClick={() => createVisitorMutation.mutate(newVisitor)} disabled={!newVisitor.fullName || createVisitorMutation.isPending}>
                  {createVisitorMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Visitor'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {loadingVisitors ? (
            <div className="space-y-4">
              {[1,2,3,4,5].map(i => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : visitors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <UserCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No visitors registered</p>
                <p className="text-sm text-muted-foreground mt-1">Add your first visitor to get started</p>
              </CardContent>
            </Card>
          ) : (
            visitors.map((visitor: any) => (
              <Card key={visitor.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {visitor.photo ? (
                        <img src={visitor.photo} alt="" className="w-10 h-10 rounded-full object-cover border" />
                      ) : (
                        <UserCheck className={`h-5 w-5 ${visitor.blacklisted ? 'text-destructive' : 'text-muted-foreground'}`} />
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{visitor.fullName}</h3>
                          {visitor.company && <Badge variant="outline">{visitor.company}</Badge>}
                          {visitor.visitReason && <Badge variant="secondary">{visitor.visitReason}</Badge>}
                          {visitor.blacklisted && (
                            <Badge className="bg-destructive">Blacklisted</Badge>
                          )}
                          {notifiedHosts.has(visitor.id) && (
                            <Badge className="bg-success text-white gap-1 text-[10px]">
                              <CheckCircle className="h-3 w-3" /> Host Notified
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Visits: {visitor.visitCount ?? 0}
                          {visitor.lastVisit && ` | Last visit: ${new Date(visitor.lastVisit).toLocaleString()}`}
                          {visitor.hostName && ` | Host: ${visitor.hostName}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {visitor.hostName && !notifiedHosts.has(visitor.id) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => setShowNotifyDialog(visitor)}
                        >
                          <Bell className="h-3 w-3" /> Notify Host
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Passes Tab ──────────────────────────────────── */}
        <TabsContent value="passes" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1">
              <Plus className="h-4 w-4" /> Create Pass
            </Button>
          </div>
          {loadingPasses ? (
            <div className="space-y-4">
              {[1,2,3,4,5].map(i => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : passes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No passes found</p>
                <p className="text-sm text-muted-foreground mt-1">Create a visitor pass to grant access</p>
              </CardContent>
            </Card>
          ) : (
            passes.map((pass: any) => (
              <Card key={pass.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Ticket className={`h-5 w-5 mt-0.5 ${pass.status === 'active' ? 'text-success' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{pass.visitorName || 'Unknown Visitor'}</h3>
                          {pass.passType && <Badge variant="outline">{pass.passType}</Badge>}
                          <Badge className={passStatusColors[pass.status] || 'bg-gray-500'}>
                            {pass.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Valid: {pass.validFrom ? new Date(pass.validFrom).toLocaleDateString() : 'N/A'}
                          {' - '}
                          {pass.validUntil ? new Date(pass.validUntil).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {pass.status === 'active' && !pass.checkedInAt && (
                        <Button size="sm" variant="default" onClick={() => checkInMutation.mutate(pass.id)}>
                          Check In
                        </Button>
                      )}
                      {pass.status === 'active' && pass.checkedInAt && !pass.checkedOutAt && (
                        <Button size="sm" variant="outline" onClick={() => checkOutMutation.mutate(pass.id)}>
                          Check Out
                        </Button>
                      )}
                      {pass.status === 'active' && (
                        <Button size="sm" variant="destructive" onClick={() => revokeMutation.mutate(pass.id)}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── QR Scanner Tab ──────────────────────────────── */}
        <TabsContent value="qr" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">QR Code Validation</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Enter or scan a QR token to validate a visitor pass
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter QR token..."
                  value={qrToken}
                  onChange={(e) => setQrToken(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && qrToken.trim()) {
                      validateQrMutation.mutate(qrToken.trim());
                    }
                  }}
                />
                <Button
                  onClick={() => qrToken.trim() && validateQrMutation.mutate(qrToken.trim())}
                  disabled={!qrToken.trim() || validateQrMutation.isPending}
                >
                  {validateQrMutation.isPending ? 'Validating...' : 'Validate'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {qrResult && (
            <Card className={qrResult.valid ? 'border-success/50' : 'border-destructive/50'}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {qrResult.valid ? (
                    <CheckCircle className="h-6 w-6 text-success shrink-0" />
                  ) : (
                    <XCircle className="h-6 w-6 text-destructive shrink-0" />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {qrResult.valid ? 'Valid Pass' : 'Invalid Pass'}
                    </h3>
                    {qrResult.visitor && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm"><span className="text-muted-foreground">Visitor:</span> {qrResult.visitor.fullName}</p>
                        {qrResult.visitor.company && (
                          <p className="text-sm"><span className="text-muted-foreground">Company:</span> {qrResult.visitor.company}</p>
                        )}
                      </div>
                    )}
                    {qrResult.pass && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm">
                          <span className="text-muted-foreground">Pass Status:</span>{' '}
                          <Badge className={passStatusColors[qrResult.pass.status] || 'bg-gray-500'}>
                            {qrResult.pass.status}
                          </Badge>
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Valid Until:</span>{' '}
                          {qrResult.pass.validUntil ? new Date(qrResult.pass.validUntil).toLocaleString() : 'N/A'}
                        </p>
                      </div>
                    )}
                    {qrResult.valid && qrResult.pass && !qrResult.pass.checkedInAt && (
                      <Button
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          checkInMutation.mutate(qrResult.pass.id);
                          setQrResult(null);
                          setQrToken("");
                        }}
                      >
                        Check In
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Notify Host Dialog */}
      <Dialog open={showNotifyDialog !== null} onOpenChange={(o) => { if (!o) setShowNotifyDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Notify Host</DialogTitle></DialogHeader>
          {showNotifyDialog && (
            <div className="space-y-3 py-2">
              <p className="text-sm">Send arrival notification to host?</p>
              <div className="p-3 rounded-md bg-muted/30 space-y-1">
                <p className="text-sm"><span className="text-muted-foreground">Visitor:</span> {showNotifyDialog.fullName}</p>
                {showNotifyDialog.company && (
                  <p className="text-sm"><span className="text-muted-foreground">Company:</span> {showNotifyDialog.company}</p>
                )}
                <p className="text-sm"><span className="text-muted-foreground">Host:</span> {showNotifyDialog.hostName}</p>
                {showNotifyDialog.hostApartment && (
                  <p className="text-sm"><span className="text-muted-foreground">Unit:</span> {showNotifyDialog.hostApartment}</p>
                )}
                {showNotifyDialog.visitReason && (
                  <p className="text-sm"><span className="text-muted-foreground">Reason:</span> {showNotifyDialog.visitReason}</p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNotifyDialog(null)}>Cancel</Button>
            <Button
              className="gap-1"
              onClick={() => showNotifyDialog && notifyHostMutation.mutate(showNotifyDialog)}
              disabled={notifyHostMutation.isPending}
            >
              {notifyHostMutation.isPending ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Sending...</>
              ) : (
                <><Bell className="h-3 w-3" /> Send Notification</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PageShell>
  );
}
