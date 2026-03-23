import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { patrolRoutesApi, patrolCheckpointsApi, patrolLogsApi } from "@/services/patrols-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Map, MapPin, Navigation, CheckCircle, Plus, Radar, ShieldAlert, Timer, Crosshair } from "lucide-react";

const logStatusColors: Record<string, string> = {
  completed: "bg-green-500",
  in_progress: "bg-blue-500",
  missed: "bg-red-500",
  partial: "bg-yellow-500",
};

export default function PatrolsPage() {
  const [activeTab, setActiveTab] = useState("live_tracking");
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Routes ──────────────────────────────────────────────
  const { data: routesData, isLoading: loadingRoutes } = useQuery({
    queryKey: ["patrols", "routes"],
    queryFn: () => patrolRoutesApi.list(),
  });

  const toggleRouteMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      patrolRoutesApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrols", "routes"] });
      toast({ title: "Route updated" });
    },
  });

  // ── Checkpoints ─────────────────────────────────────────
  const { data: checkpointsData, isLoading: loadingCheckpoints } = useQuery({
    queryKey: ["patrols", "checkpoints", selectedRouteId],
    queryFn: () => patrolCheckpointsApi.listByRoute(selectedRouteId!),
    enabled: !!selectedRouteId,
  });

  // ── Logs ────────────────────────────────────────────────
  const { data: logsData, isLoading: loadingLogs } = useQuery({
    queryKey: ["patrols", "logs"],
    queryFn: () => patrolLogsApi.list(),
  });

  const { data: statsData } = useQuery({
    queryKey: ["patrols", "stats"],
    queryFn: () => patrolLogsApi.stats(),
    refetchInterval: 30000,
  });

  const routes = routesData?.data ?? [];
  const checkpoints = checkpointsData?.data ?? [];
  const logs = logsData?.data ?? [];
  const stats = statsData?.data;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Map className="h-6 w-6" />
            Patrol Management
          </h1>
          <p className="text-muted-foreground">
            Manage patrol routes, checkpoints, and track compliance
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Routes</p>
                <p className="text-3xl font-bold">{stats?.totalRoutes ?? 0}</p>
              </div>
              <Navigation className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compliance Rate</p>
                <p className="text-3xl font-bold text-green-500">{stats?.complianceRate ?? 0}%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
                <p className="text-3xl font-bold text-green-500">{stats?.completedToday ?? 0}</p>
              </div>
              <Map className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Missed Today</p>
                <p className="text-3xl font-bold text-red-500">{stats?.missedToday ?? 0}</p>
              </div>
              <MapPin className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="live_tracking" className="gap-1 text-primary data-[state=active]:bg-primary/20">
            <Radar className="h-4 w-4" /> Live SLA Tracking
          </TabsTrigger>
          <TabsTrigger value="routes" className="gap-1">
            <Navigation className="h-4 w-4" /> Routes
          </TabsTrigger>
          <TabsTrigger value="checkpoints" className="gap-1">
            <MapPin className="h-4 w-4" /> Checkpoints
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1">
            <CheckCircle className="h-4 w-4" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* ── Live SLA Tracking Tab ─────────────────────────── */}
        <TabsContent value="live_tracking" className="space-y-4">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
             
             {/* Tactical Map View */}
             <Card className="lg:col-span-2 flex flex-col overflow-hidden border-primary/30 relative shadow-[0_0_20px_rgba(0,180,216,0.1)]">
               <CardHeader className="bg-background/80 backdrop-blur-sm z-10 border-b absolute top-0 w-full flex flex-row items-center justify-between py-3">
                 <CardTitle className="text-sm tracking-widest font-bold flex items-center gap-2 text-primary">
                    <Map className="h-4 w-4" /> SITE GRID TOPOGRAPHY
                 </CardTitle>
                 <Badge variant="outline" className="border-green-500 text-green-500 bg-green-500/10 animate-pulse">
                   GPS LINK ACTIVE
                 </Badge>
               </CardHeader>
               <CardContent className="p-0 flex-1 relative bg-[#0a0f12] flex items-center justify-center pt-14">
                 <div className="absolute w-full h-full opacity-20" style={{ 
                     backgroundImage: "linear-gradient(#00ff88 1px, transparent 1px), linear-gradient(90deg, #00ff88 1px, transparent 1px)", 
                     backgroundSize: "40px 40px" 
                 }}></div>
                 
                 {/* Guard Marker 1 */}
                 <div className="absolute top-[30%] left-[40%] flex flex-col items-center">
                   <div className="h-8 w-8 rounded-full border border-green-500 bg-green-500/20 flex items-center justify-center animate-bounce">
                      <Crosshair className="h-5 w-5 text-green-500" />
                   </div>
                   <div className="mt-1 bg-black/80 px-2 py-1 rounded text-[10px] text-green-400 font-mono border border-green-500/50">
                     UNIT-01 (Bravo)
                   </div>
                   {/* Target Path line simulated */}
                   <svg className="absolute top-4 left-4 w-40 h-40 pointer-events-none -z-10 overflow-visible">
                     <path d="M 0 0 L 150 120" stroke="#00ff88" strokeWidth="2" strokeDasharray="5,5" fill="none" className="opacity-50" />
                   </svg>
                 </div>

                 {/* Guard Marker 2 (SLA Breached) */}
                 <div className="absolute bottom-[20%] right-[30%] flex flex-col items-center">
                   <span className="animate-ping absolute h-12 w-12 rounded-full bg-red-400 opacity-20"></span>
                   <div className="h-8 w-8 rounded-full border-2 border-red-500 bg-red-500/40 flex items-center justify-center drop-shadow-[0_0_10px_#ff0000]">
                      <ShieldAlert className="h-5 w-5 text-red-100" />
                   </div>
                   <div className="mt-1 bg-red-950 px-2 py-1 rounded text-[10px] text-red-500 font-mono border border-red-500 font-bold whitespace-nowrap">
                     UNIT-04 (Echo) - OFF ROUTE
                   </div>
                 </div>

                 {/* Checkpoint Nodes */}
                 <div className="absolute top-[60%] left-[60%] flex items-center gap-1 opacity-60">
                    <MapPin className="h-4 w-4 text-blue-400" />
                    <span className="text-[10px] font-mono text-blue-400">CP-05</span>
                 </div>
               </CardContent>
             </Card>

             {/* SLA Timers & Telemetry */}
             <div className="space-y-4 overflow-y-auto">
               <h3 className="uppercase text-xs font-bold text-muted-foreground mb-2 flex items-center gap-2"><Timer className="h-4 w-4" /> Service Level Agreements</h3>
               
               {/* SLA Block 1 */}
               <Card className="border-green-500/30 bg-green-500/5">
                 <CardContent className="p-4 flex flex-col gap-2">
                   <div className="flex justify-between items-center">
                     <Badge variant="outline" className="text-green-500 border-green-500/50 bg-green-500/10 font-mono">ON SCHEDULE</Badge>
                     <span className="text-2xl font-mono font-bold text-green-400">04:12</span>
                   </div>
                   <div>
                     <p className="font-bold text-sm">Unit: Carlos B. (Bravo-1)</p>
                     <p className="text-xs text-muted-foreground flex justify-between">
                       <span>Target: Sector D Checkpoint</span>
                       <span>ETA: 4m</span>
                     </p>
                   </div>
                   <div className="w-full bg-black/50 rounded-full h-1 mt-1">
                     <div className="bg-green-500 h-1 rounded-full w-[70%]"></div>
                   </div>
                 </CardContent>
               </Card>

               {/* SLA Block 2 (Warning) */}
               <Card className="border-yellow-500/30 bg-yellow-500/5">
                 <CardContent className="p-4 flex flex-col gap-2">
                   <div className="flex justify-between items-center">
                     <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 bg-yellow-500/10 font-mono animate-pulse">AT RISK</Badge>
                     <span className="text-2xl font-mono font-bold text-yellow-400">00:45</span>
                   </div>
                   <div>
                     <p className="font-bold text-sm">Unit: Maria S. (Alpha-2)</p>
                     <p className="text-xs text-muted-foreground flex justify-between">
                       <span>Target: Server Room B</span>
                       <span>ETA: 45s</span>
                     </p>
                   </div>
                   <div className="w-full bg-black/50 rounded-full h-1 mt-1">
                     <div className="bg-yellow-500 h-1 rounded-full w-[90%]"></div>
                   </div>
                 </CardContent>
               </Card>

               {/* SLA Block 3 (Breached) */}
               <Card className="border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.15)] bg-red-950/20">
                 <CardContent className="p-4 flex flex-col gap-2">
                   <div className="flex justify-between items-center">
                     <Badge variant="destructive" className="font-mono animate-pulse">SLA BREACHED</Badge>
                     <span className="text-2xl font-mono font-bold text-red-500">-05:22</span>
                   </div>
                   <div>
                     <p className="font-bold text-sm text-red-200">Unit: John D. (Echo-4)</p>
                     <p className="text-xs text-red-400/80 flex justify-between">
                       <span>Target: Perimeter North</span>
                       <span>DELAYED: 5m</span>
                     </p>
                   </div>
                   <div className="w-full bg-black/50 rounded-full h-1 mt-1 overflow-hidden relative">
                     <div className="absolute w-full h-full bg-red-500/20"></div>
                     <div className="bg-red-500 h-1 rounded-full w-[100%] animate-pulse"></div>
                   </div>
                   <Button size="sm" variant="destructive" className="w-full mt-2 text-xs h-7">Dispatch Backup</Button>
                 </CardContent>
               </Card>
             </div>
           </div>
        </TabsContent>

        {/* ── Routes Tab ──────────────────────────────────── */}
        <TabsContent value="routes" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1">
              <Plus className="h-4 w-4" /> New Route
            </Button>
          </div>
          {loadingRoutes ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : routes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Map className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No patrol routes configured</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first patrol route to get started</p>
              </CardContent>
            </Card>
          ) : (
            routes.map((route: any) => (
              <Card key={route.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Navigation className={`h-5 w-5 ${route.isActive ? 'text-blue-500' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{route.name}</h3>
                          {route.siteName && <Badge variant="outline">{route.siteName}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Est. Time: {route.estimatedMinutes ?? 'N/A'}min | Frequency: {route.frequency || 'Not set'}
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto text-xs"
                          onClick={() => {
                            setSelectedRouteId(route.id);
                            setActiveTab("checkpoints");
                          }}
                        >
                          View Checkpoints
                        </Button>
                      </div>
                    </div>
                    <Switch
                      checked={route.isActive}
                      onCheckedChange={(checked) => toggleRouteMutation.mutate({ id: route.id, isActive: checked })}
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Checkpoints Tab ─────────────────────────────── */}
        <TabsContent value="checkpoints" className="space-y-4">
          {!selectedRouteId ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">Select a route</p>
                <p className="text-sm text-muted-foreground mt-1">Choose a route from the Routes tab to view its checkpoints</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedRouteId(null)}>
                    Back
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Route: {routes.find((r: any) => r.id === selectedRouteId)?.name || selectedRouteId}
                  </span>
                </div>
                <Button className="gap-1">
                  <Plus className="h-4 w-4" /> New Checkpoint
                </Button>
              </div>
              {loadingCheckpoints ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : checkpoints.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium">No checkpoints</p>
                    <p className="text-sm text-muted-foreground mt-1">Add checkpoints to this patrol route</p>
                  </CardContent>
                </Card>
              ) : (
                checkpoints.map((cp: any, index: number) => (
                  <Card key={cp.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <h3 className="font-semibold">{cp.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {cp.description || 'No description'}
                              {cp.latitude && cp.longitude && ` | Location: ${cp.latitude}, ${cp.longitude}`}
                            </p>
                          </div>
                        </div>
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </>
          )}
        </TabsContent>

        {/* ── Logs Tab ────────────────────────────────────── */}
        <TabsContent value="logs" className="space-y-4">
          {loadingLogs ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : logs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No patrol logs</p>
                <p className="text-sm text-muted-foreground mt-1">Patrol logs will appear here as guards complete their rounds</p>
              </CardContent>
            </Card>
          ) : (
            logs.map((log: any) => (
              <Card key={log.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className={`h-5 w-5 mt-0.5 ${log.status === 'completed' ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{log.routeName || 'Patrol'}</h3>
                          <Badge className={logStatusColors[log.status] || 'bg-gray-500'}>
                            {log.status?.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Guard: {log.guardName || log.userId || 'Unknown'}
                          {log.checkpointsVisited !== undefined && ` | Checkpoints: ${log.checkpointsVisited}/${log.totalCheckpoints ?? '?'}`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Started: {log.startedAt ? new Date(log.startedAt).toLocaleString() : 'N/A'}
                          {log.completedAt && ` | Completed: ${new Date(log.completedAt).toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
