import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { visitorsApi, visitorPassesApi, visitorQrApi, visitorStatsApi } from "@/services/visitors-api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UserCheck, ScanLine, Ticket, Ban, Plus, CheckCircle, XCircle } from "lucide-react";

const passStatusColors: Record<string, string> = {
  active: "bg-green-500",
  used: "bg-gray-500",
  expired: "bg-yellow-500",
  revoked: "bg-red-500",
};

export default function VisitorsPage() {
  const [activeTab, setActiveTab] = useState("visitors");
  const [qrToken, setQrToken] = useState("");
  const [qrResult, setQrResult] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserCheck className="h-6 w-6" />
            Visitor Management
          </h1>
          <p className="text-muted-foreground">
            Manage visitors, passes, and QR code validation
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Visitors</p>
                <p className="text-3xl font-bold">{stats?.totalVisitors ?? 0}</p>
              </div>
              <UserCheck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Passes</p>
                <p className="text-3xl font-bold text-green-500">{stats?.activePasses ?? 0}</p>
              </div>
              <Ticket className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Checked In Today</p>
                <p className="text-3xl font-bold text-blue-500">{stats?.checkedInToday ?? 0}</p>
              </div>
              <ScanLine className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blacklisted</p>
                <p className="text-3xl font-bold text-red-500">{stats?.blacklisted ?? 0}</p>
              </div>
              <Ban className="h-8 w-8 text-red-500" />
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
            <Button className="gap-1">
              <Plus className="h-4 w-4" /> Add Visitor
            </Button>
          </div>
          {loadingVisitors ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserCheck className={`h-5 w-5 ${visitor.blacklisted ? 'text-red-500' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{visitor.fullName}</h3>
                          {visitor.company && <Badge variant="outline">{visitor.company}</Badge>}
                          {visitor.visitReason && <Badge variant="secondary">{visitor.visitReason}</Badge>}
                          {visitor.blacklisted && (
                            <Badge className="bg-red-500">Blacklisted</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Visits: {visitor.visitCount ?? 0}
                          {visitor.lastVisit && ` | Last visit: ${new Date(visitor.lastVisit).toLocaleString()}`}
                        </p>
                      </div>
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
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
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
                      <Ticket className={`h-5 w-5 mt-0.5 ${pass.status === 'active' ? 'text-green-500' : 'text-muted-foreground'}`} />
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
            <Card className={qrResult.valid ? 'border-green-500/50' : 'border-red-500/50'}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  {qrResult.valid ? (
                    <CheckCircle className="h-6 w-6 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-500 shrink-0" />
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
    </div>
  );
}
