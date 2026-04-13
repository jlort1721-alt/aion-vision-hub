import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

import { apiClient } from "@/lib/api-client";

interface Event {
  id: number;
  route_id: string;
  event: string;
  from_state: string | null;
  to_state: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export function FailoverHistory() {
  const { data } = useQuery({
    queryKey: ["vh", "events"],
    queryFn: () =>
      apiClient.get<Event[]>("/vision-hub/events", { limit: "200" }),
    refetchInterval: 15_000,
  });

  const rows = data ?? [];

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-0">
        <table className="w-full text-xs">
          <thead className="text-left uppercase text-slate-500 border-b border-slate-800">
            <tr>
              <th className="p-3">Cuando</th>
              <th className="p-3">Evento</th>
              <th className="p-3">Transicion</th>
              <th className="p-3">Detalles</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.id}
                className="border-b border-slate-800/50 hover:bg-slate-800/50"
              >
                <td className="p-3 font-mono text-slate-400">
                  {new Date(e.created_at).toLocaleString("es-CO")}
                </td>
                <td className="p-3">
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase ${
                      e.event === "failover"
                        ? "border-yellow-500 text-yellow-400"
                        : "border-slate-600 text-slate-400"
                    }`}
                  >
                    {e.event}
                  </Badge>
                </td>
                <td className="p-3 font-mono">
                  <span className="text-slate-500">{e.from_state ?? "?"}</span>
                  <ArrowRight className="w-3 h-3 inline mx-1 text-slate-600" />
                  <span className="text-white">{e.to_state ?? "?"}</span>
                </td>
                <td className="p-3 text-slate-500 font-mono truncate max-w-md">
                  {JSON.stringify(e.details)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">
                  Sin eventos recientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
