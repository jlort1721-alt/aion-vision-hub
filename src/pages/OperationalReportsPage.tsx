import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera, Wrench, Ticket, Users, Building2, ShieldCheck,
  Bell, ClipboardList, BarChart3, ChevronLeft, ChevronRight,
} from "lucide-react";

// ── Types ──
interface PaginatedResponse<T> { data: T[]; meta?: { total: number; limit: number; offset: number } }

// ── Hooks ──
function useOps<T>(endpoint: string, params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ["ops", endpoint, params],
    queryFn: () => apiClient.get<PaginatedResponse<T>>(`/ops/${endpoint}`, params),
  });
}

// ── Patrol Stats Component ──
function PatrolStats() {
  const { data, isLoading } = useOps<{ site_name: string; total_checks: number; with_visual: number; recording: number; last_check: string }>("visual-patrols/stats");
  if (isLoading) return <div className="animate-pulse h-40" />;
  const stats = (data as any)?.data || [];
  return (
    <div className="grid gap-3">
      {stats.map((s: any) => (
        <div key={s.site_name} className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <p className="font-medium text-sm">{s.site_name}</p>
            <p className="text-xs text-muted-foreground">{s.total_checks} revisiones</p>
          </div>
          <div className="flex gap-2">
            <Badge variant={s.with_visual === s.total_checks ? "default" : "destructive"}>
              {s.with_visual}/{s.total_checks} visual
            </Badge>
            <Badge variant={s.recording === s.total_checks ? "default" : "secondary"}>
              {s.recording} grabando
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Generic Table Component ──
function DataTable({ endpoint, columns, title }: { endpoint: string; columns: { key: string; label: string }[]; title: string }) {
  const [page, setPage] = useState(0);
  const limit = 20;
  const { data, isLoading } = useOps<Record<string, any>>(endpoint, { limit, offset: page * limit });
  const result = data as any;
  const rows = result?.data || [];
  const total = result?.meta?.total || rows.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title} ({total})</CardTitle>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="icon" variant="outline" disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="animate-pulse h-40" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b">{columns.map(c => <th key={c.key} className="text-left p-2 font-medium">{c.label}</th>)}</tr></thead>
              <tbody>
                {rows.map((r: any, i: number) => (
                  <tr key={r.id || i} className="border-b hover:bg-muted/50">
                    {columns.map(c => <td key={c.key} className="p-2 max-w-[200px] truncate">{r[c.key] ?? "-"}</td>)}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={columns.length} className="p-4 text-center text-muted-foreground">Sin registros</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Summary Dashboard ──
function SummaryDashboard() {
  const { data, isLoading } = useOps<any>("operational-summary");
  if (isLoading) return <div className="animate-pulse h-60" />;
  const sedes = (data as any)?.data || [];

  const totals = sedes.reduce((acc: any, s: any) => ({
    residents: acc.residents + (s.residents || 0),
    vehicles: acc.vehicles + (s.vehicles || 0),
    cameras: acc.cameras + (s.cameras || 0),
    devices: acc.devices + (s.devices || 0),
    patrols: acc.patrols + (s.patrol_logs || 0),
  }), { residents: 0, vehicles: 0, cameras: 0, devices: 0, patrols: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{totals.residents}</p><p className="text-xs text-muted-foreground">Residentes</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{totals.vehicles}</p><p className="text-xs text-muted-foreground">Vehiculos</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{totals.cameras}</p><p className="text-xs text-muted-foreground">Camaras</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{totals.devices}</p><p className="text-xs text-muted-foreground">Dispositivos</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{totals.patrols}</p><p className="text-xs text-muted-foreground">Patrullas</p></CardContent></Card>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th className="text-left p-2">Sede</th><th className="p-2">Res.</th><th className="p-2">Veh.</th><th className="p-2">Cam.</th><th className="p-2">Disp.</th><th className="p-2">Patrullas</th></tr></thead>
          <tbody>
            {sedes.map((s: any) => (
              <tr key={s.id} className="border-b hover:bg-muted/50">
                <td className="p-2 font-medium">{s.name}</td>
                <td className="p-2 text-center">{s.residents}</td>
                <td className="p-2 text-center">{s.vehicles}</td>
                <td className="p-2 text-center">{s.cameras}</td>
                <td className="p-2 text-center">{s.devices}</td>
                <td className="p-2 text-center">{s.patrol_logs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function OperationalReportsPage() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Reportes Operativos</h1>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-1" />Dashboard</TabsTrigger>
          <TabsTrigger value="patrols"><Camera className="h-4 w-4 mr-1" />Recorrido Visual</TabsTrigger>
          <TabsTrigger value="tech"><Wrench className="h-4 w-4 mr-1" />Servicios Tecnicos</TabsTrigger>
          <TabsTrigger value="tickets"><Ticket className="h-4 w-4 mr-1" />Tickets</TabsTrigger>
          <TabsTrigger value="workers"><Users className="h-4 w-4 mr-1" />Trabajadores</TabsTrigger>
          <TabsTrigger value="admins"><Building2 className="h-4 w-4 mr-1" />Admins</TabsTrigger>
          <TabsTrigger value="restarts"><ShieldCheck className="h-4 w-4 mr-1" />Reinicios</TabsTrigger>
          <TabsTrigger value="sirens"><Bell className="h-4 w-4 mr-1" />Sirenas</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><SummaryDashboard /></TabsContent>

        <TabsContent value="patrols"><PatrolStats /></TabsContent>

        <TabsContent value="tech">
          <DataTable endpoint="tech-services" title="Seguimiento Servicios Tecnicos" columns={[
            { key: "request_date", label: "Fecha" }, { key: "site_name", label: "Sede" },
            { key: "service_description", label: "Descripcion" }, { key: "technician", label: "Tecnico" },
            { key: "status", label: "Estado" }, { key: "operator", label: "Operador" },
          ]} />
        </TabsContent>

        <TabsContent value="tickets">
          <DataTable endpoint="service-tickets" title="Tickets de Servicio" columns={[
            { key: "service_type", label: "Tipo" }, { key: "description", label: "Descripcion" },
            { key: "site_name", label: "Sede" }, { key: "requester_name", label: "Solicitante" },
            { key: "status", label: "Estado" },
          ]} />
        </TabsContent>

        <TabsContent value="workers">
          <DataTable endpoint="authorized-workers" title="Trabajadores Autorizados" columns={[
            { key: "worker_name", label: "Nombre" }, { key: "id_number", label: "Identificacion" },
            { key: "house_lot", label: "Casa" }, { key: "function", label: "Funcion" },
            { key: "authorized_by", label: "Autoriza" }, { key: "year", label: "Ano" },
          ]} />
        </TabsContent>

        <TabsContent value="admins">
          <DataTable endpoint="site-admins" title="Administradores de Unidades" columns={[
            { key: "site_name", label: "Sede" }, { key: "admin_name", label: "Administrador" },
            { key: "admin_contact", label: "Contacto" }, { key: "notes", label: "Notas" },
          ]} />
        </TabsContent>

        <TabsContent value="restarts">
          <DataTable endpoint="device-restarts" title="Reinicios de Equipos" columns={[
            { key: "restart_date", label: "Fecha" }, { key: "device_name", label: "Equipo" },
            { key: "did_update", label: "Actualizo" }, { key: "operator", label: "Operador" },
            { key: "observations", label: "Observaciones" },
          ]} />
        </TabsContent>

        <TabsContent value="sirens">
          <DataTable endpoint="sirens" title="Sirenas" columns={[
            { key: "site_name", label: "Sede" }, { key: "siren_name", label: "Sirena" },
            { key: "status", label: "Estado" },
          ]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
