import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { slaDefinitionsApi, slaTrackingApi } from "@/services/sla-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Timer, CheckCircle, AlertTriangle, Target, Plus } from "lucide-react";

const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getDeadlineInfo(deadline: string): { text: string; isUrgent: boolean; isBreached: boolean } {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 0) {
    return { text: `Breached ${Math.abs(diffMins)}m ago`, isUrgent: true, isBreached: true };
  }
  if (diffMins < 30) {
    return { text: `${diffMins}m remaining`, isUrgent: true, isBreached: false };
  }
  return { text: formatMinutes(diffMins) + ' remaining', isUrgent: false, isBreached: false };
}

export default function SLAPage() {
  const [activeTab, setActiveTab] = useState("definitions");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Definitions ─────────────────────────────────────────
  const { data: definitionsData, isLoading: loadingDefinitions } = useQuery({
    queryKey: ["sla", "definitions"],
    queryFn: () => slaDefinitionsApi.list(),
  });

  const deleteDefinitionMutation = useMutation({
    mutationFn: (id: string) => slaDefinitionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla", "definitions"] });
      toast({ title: "SLA definition deleted" });
    },
  });

  // ── Tracking ────────────────────────────────────────────
  const { data: trackingData, isLoading: loadingTracking } = useQuery({
    queryKey: ["sla", "tracking"],
    queryFn: () => slaTrackingApi.list(),
    refetchInterval: 15000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["sla", "stats"],
    queryFn: () => slaTrackingApi.stats(),
    refetchInterval: 30000,
  });

  const definitions = definitionsData?.data ?? [];
  const tracking = trackingData?.data ?? [];
  const stats = statsData?.data;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6" />
            SLA Management
          </h1>
          <p className="text-muted-foreground">
            Define service level agreements and track compliance
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active SLAs</p>
                <p className="text-3xl font-bold">{stats?.activeSlas ?? 0}</p>
              </div>
              <Timer className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Met</p>
                <p className="text-3xl font-bold text-green-500">{stats?.met ?? 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Breached</p>
                <p className="text-3xl font-bold text-red-500">{stats?.breached ?? 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Response Breach Rate</p>
                <p className="text-3xl font-bold text-orange-500">{stats?.responseBreachRate ?? 0}%</p>
              </div>
              <Target className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="definitions" className="gap-1">
            <Target className="h-4 w-4" /> Definitions
          </TabsTrigger>
          <TabsTrigger value="tracking" className="gap-1">
            <Timer className="h-4 w-4" /> Tracking
          </TabsTrigger>
        </TabsList>

        {/* ── Definitions Tab ─────────────────────────────── */}
        <TabsContent value="definitions" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-1">
              <Plus className="h-4 w-4" /> New Definition
            </Button>
          </div>
          {loadingDefinitions ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : definitions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No SLA definitions</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first SLA definition to start tracking</p>
              </CardContent>
            </Card>
          ) : (
            definitions.map((def: any) => (
              <Card key={def.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Target className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{def.name}</h3>
                          <Badge className={severityColors[def.severity] || 'bg-gray-500'}>{def.severity}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          Response Time: {formatMinutes(def.responseTimeMinutes ?? 0)} | Resolution Time: {formatMinutes(def.resolutionTimeMinutes ?? 0)}
                        </p>
                        {def.description && (
                          <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => deleteDefinitionMutation.mutate(def.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ── Tracking Tab ────────────────────────────────── */}
        <TabsContent value="tracking" className="space-y-4">
          {loadingTracking ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : tracking.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Timer className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">No active SLA tracking items</p>
                <p className="text-sm text-muted-foreground mt-1">SLA tracking will appear here when incidents are linked to SLA definitions</p>
              </CardContent>
            </Card>
          ) : (
            tracking.map((item: any) => {
              const deadlineInfo = item.deadline ? getDeadlineInfo(item.deadline) : null;
              return (
                <Card key={item.id} className={deadlineInfo?.isBreached ? 'border-red-500/50' : ''}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Timer className={`h-5 w-5 mt-0.5 ${deadlineInfo?.isBreached ? 'text-red-500' : deadlineInfo?.isUrgent ? 'text-orange-500 animate-pulse' : 'text-muted-foreground'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{item.title || item.incidentTitle || 'SLA Item'}</h3>
                            <Badge className={severityColors[item.severity] || 'bg-gray-500'}>{item.severity}</Badge>
                            {deadlineInfo?.isBreached && (
                              <Badge variant="destructive">Breached</Badge>
                            )}
                            {item.status && (
                              <Badge variant="outline">{item.status}</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            SLA: {item.slaName || 'Unknown'} | Created: {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}
                          </p>
                          {deadlineInfo && (
                            <p className={`text-sm mt-1 font-medium ${deadlineInfo.isBreached ? 'text-red-500' : deadlineInfo.isUrgent ? 'text-orange-500' : 'text-green-500'}`}>
                              {deadlineInfo.text}
                            </p>
                          )}
                        </div>
                      </div>
                      {!deadlineInfo?.isBreached && item.status !== 'resolved' && (
                        <Badge variant="outline" className="shrink-0">
                          <Timer className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
