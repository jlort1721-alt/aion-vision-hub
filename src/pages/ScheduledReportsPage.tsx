import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scheduledReportsApi } from "@/services/scheduled-reports-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { FileBarChart, Calendar, Clock, AlertCircle, Plus } from "lucide-react";

const reportTypeColors: Record<string, string> = {
  incident: "bg-red-500",
  patrol: "bg-blue-500",
  attendance: "bg-green-500",
  sla: "bg-purple-500",
  device: "bg-orange-500",
  audit: "bg-gray-500",
  summary: "bg-cyan-500",
  custom: "bg-pink-500",
};

export default function ScheduledReportsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Reports ─────────────────────────────────────────────
  const { data: reportsData, isLoading: loadingReports } = useQuery({
    queryKey: ["scheduled-reports"],
    queryFn: () => scheduledReportsApi.list(),
  });

  const toggleReportMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      scheduledReportsApi.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast({ title: "Report updated" });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: (id: string) => scheduledReportsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-reports"] });
      toast({ title: "Report deleted" });
    },
  });

  const reports = reportsData?.data ?? [];
  const totalReports = reports.length;
  const activeReports = reports.filter((r: any) => r.isActive).length;
  const lastRunErrors = reports.filter((r: any) => r.lastRunStatus === 'error').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileBarChart className="h-6 w-6" />
            Scheduled Reports
          </h1>
          <p className="text-muted-foreground">
            Configure and manage automated report generation
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reports</p>
                <p className="text-3xl font-bold">{totalReports}</p>
              </div>
              <FileBarChart className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-3xl font-bold text-green-500">{activeReports}</p>
              </div>
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Last Run Errors</p>
                <p className="text-3xl font-bold text-red-500">{lastRunErrors}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button className="gap-1">
            <Plus className="h-4 w-4" /> New Report
          </Button>
        </div>

        {loadingReports ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileBarChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">No scheduled reports</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first scheduled report to automate reporting</p>
            </CardContent>
          </Card>
        ) : (
          reports.map((report: any) => (
            <Card key={report.id} className={report.lastRunStatus === 'error' ? 'border-red-500/30' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <FileBarChart className={`h-5 w-5 mt-0.5 ${report.isActive ? 'text-blue-500' : 'text-muted-foreground'}`} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{report.name}</h3>
                        <Badge className={reportTypeColors[report.type] || 'bg-gray-500'}>
                          {report.type}
                        </Badge>
                        {report.format && (
                          <Badge variant="outline">{report.format.toUpperCase()}</Badge>
                        )}
                        {report.lastRunStatus === 'error' && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" /> Error
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          Schedule: {report.schedule || report.cronExpression || 'Not set'}
                        </span>
                        {report.recipientCount !== undefined && (
                          <span>Recipients: {report.recipientCount}</span>
                        )}
                        {report.recipients && (
                          <span>Recipients: {Array.isArray(report.recipients) ? report.recipients.length : report.recipients}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        {report.lastRunAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Last run: {new Date(report.lastRunAt).toLocaleString()}
                          </span>
                        )}
                        {report.nextRunAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Next run: {new Date(report.nextRunAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch
                      checked={report.isActive}
                      onCheckedChange={(checked) => toggleReportMutation.mutate({ id: report.id, isActive: checked })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
