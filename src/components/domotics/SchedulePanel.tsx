import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Schedule {
  id: string;
  name: string;
  trigger: {
    type: string;
    config: { hour: number; minute: number; daysOfWeek: number[] };
  };
  actions: { type: string; config: { deviceId: string; action: string } }[];
  isActive: boolean;
}

interface DomoticDevice {
  id: string;
  name: string;
}

const DAYS = ["Lun", "Mar", "Mi\u00e9", "Jue", "Vie", "S\u00e1b", "Dom"];

export default function SchedulePanel() {
  const queryClient = useQueryClient();
  const [hour, setHour] = useState("08");
  const [minute, setMinute] = useState("00");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [action, setAction] = useState("on");

  const { data: schedules = [], isLoading } = useQuery<Schedule[]>({
    queryKey: ["automation", "schedule"],
    queryFn: () =>
      apiClient.get("/automation/rules", { trigger_type: "schedule" }),
  });

  const { data: devices = [] } = useQuery<DomoticDevice[]>({
    queryKey: ["domotics", "devices"],
    queryFn: () => apiClient.get("/domotics"),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiClient.post("/automation", data),
    onSuccess: () => {
      toast.success("Programaci\u00f3n creada correctamente");
      queryClient.invalidateQueries({ queryKey: ["automation", "schedule"] });
      setSelectedDays([]);
      setDeviceId("");
      setAction("on");
    },
    onError: () => {
      toast.error("Error al crear la programaci\u00f3n");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/automation/${id}`),
    onSuccess: () => {
      toast.success("Programaci\u00f3n eliminada");
      queryClient.invalidateQueries({ queryKey: ["automation", "schedule"] });
    },
    onError: () => {
      toast.error("Error al eliminar la programaci\u00f3n");
    },
  });

  const toggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex],
    );
  };

  const handleCreate = () => {
    if (selectedDays.length === 0) {
      toast.error("Selecciona al menos un d\u00eda");
      return;
    }
    if (!deviceId) {
      toast.error("Selecciona un dispositivo");
      return;
    }
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const daysLabel = selectedDays.map((d) => DAYS[d]).join(", ");
    createMutation.mutate({
      name: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} - ${daysLabel}`,
      trigger: {
        type: "schedule",
        config: { hour: h, minute: m, daysOfWeek: selectedDays },
      },
      actions: [{ type: "toggle_device", config: { deviceId, action } }],
      isActive: true,
    });
  };

  const formatTime = (h: number, m: number) =>
    `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" />
            Nueva Programaci&oacute;n
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              min={0}
              max={23}
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className="w-20"
              placeholder="HH"
            />
            <span className="font-bold">:</span>
            <Input
              type="number"
              min={0}
              max={59}
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className="w-20"
              placeholder="MM"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {DAYS.map((day, idx) => (
              <Button
                key={day}
                size="sm"
                variant={selectedDays.includes(idx) ? "default" : "outline"}
                onClick={() => toggleDay(idx)}
              >
                {day}
              </Button>
            ))}
          </div>

          <Select value={deviceId} onValueChange={setDeviceId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar dispositivo" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={action} onValueChange={setAction}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="on">Encender</SelectItem>
              <SelectItem value="off">Apagar</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="w-full"
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Crear Programaci&oacute;n
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            Programaciones Activas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin programaciones configuradas
            </p>
          ) : (
            <ul className="space-y-3">
              {schedules.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {formatTime(
                        s.trigger.config.hour,
                        s.trigger.config.minute,
                      )}
                    </p>
                    <div className="flex gap-1">
                      {s.trigger.config.daysOfWeek.map((d) => (
                        <Badge key={d} variant="secondary" className="text-xs">
                          {DAYS[d]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.isActive ? "default" : "outline"}>
                      {s.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteMutation.mutate(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
