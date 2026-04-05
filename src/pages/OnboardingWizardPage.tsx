import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Building2,
  MonitorSpeaker,
  Users,
  Wifi,
  Settings,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Upload,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Step definitions ───────────────────────────────────────

interface StepDef {
  title: string;
  description: string;
  icon: LucideIcon;
}

const STEPS: StepDef[] = [
  { title: "Informacion de la Sede", description: "Nombre, direccion, contacto", icon: Building2 },
  { title: "Dispositivos", description: "Agregar DVR, NVR, camaras", icon: MonitorSpeaker },
  { title: "Control de Acceso", description: "Importar residentes y vehiculos", icon: Users },
  { title: "Domoticos", description: "Conectar dispositivos eWeLink", icon: Wifi },
  { title: "Configuracion", description: "Turnos, patrullas, SLA", icon: Settings },
  { title: "Revisar y Activar", description: "Confirmar configuracion", icon: CheckCircle2 },
];

// ── Form data types ────────────────────────────────────────

interface SiteInfo {
  name: string;
  address: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
}

interface DeviceEntry {
  id: string;
  name: string;
  ip: string;
  type: string;
  brand: string;
  status: "pending" | "testing" | "ok" | "error";
}

interface ShiftConfig {
  morningEnabled: boolean;
  afternoonEnabled: boolean;
  nightEnabled: boolean;
  patrolInterval: string;
  slaResponseMinutes: string;
}

interface WizardData {
  siteInfo: SiteInfo;
  devices: DeviceEntry[];
  csvFile: string;
  ewelinkConnected: boolean;
  shiftConfig: ShiftConfig;
}

// ── Step components ────────────────────────────────────────

function StepSiteInfo({
  data,
  onChange,
}: {
  data: SiteInfo;
  onChange: (d: SiteInfo) => void;
}) {
  const update = (field: keyof SiteInfo, value: string) =>
    onChange({ ...data, [field]: value });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nombre de la Sede *</Label>
        <Input
          placeholder="Ej: Conjunto Residencial Los Pinos"
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Direccion</Label>
        <Input
          placeholder="Ej: Calle 100 #15-20, Bogota"
          value={data.address}
          onChange={(e) => update("address", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Nombre de Contacto</Label>
          <Input
            placeholder="Administrador"
            value={data.contactName}
            onChange={(e) => update("contactName", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Telefono</Label>
          <Input
            placeholder="+57 300 000 0000"
            value={data.contactPhone}
            onChange={(e) => update("contactPhone", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Email de Contacto</Label>
        <Input
          type="email"
          placeholder="admin@conjunto.com"
          value={data.contactEmail}
          onChange={(e) => update("contactEmail", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Notas</Label>
        <Textarea
          placeholder="Informacion adicional sobre la sede..."
          value={data.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}

function StepDevices({
  devices,
  onChange,
}: {
  devices: DeviceEntry[];
  onChange: (d: DeviceEntry[]) => void;
}) {
  const addDevice = () => {
    onChange([
      ...devices,
      {
        id: crypto.randomUUID(),
        name: "",
        ip: "",
        type: "dvr",
        brand: "hikvision",
        status: "pending",
      },
    ]);
  };

  const removeDevice = (id: string) => {
    onChange(devices.filter((d) => d.id !== id));
  };

  const updateDevice = (id: string, field: keyof DeviceEntry, value: string) => {
    onChange(
      devices.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
  };

  const testDevice = async (id: string) => {
    onChange(
      devices.map((d) => (d.id === id ? { ...d, status: "testing" as const } : d))
    );
    // Simulate connectivity test
    await new Promise((r) => setTimeout(r, 1500));
    onChange(
      devices.map((d) =>
        d.id === id
          ? { ...d, status: (d.ip || '').trim() ? ("ok" as const) : ("error" as const) }
          : d
      )
    );
  };

  const statusBadge = (status: DeviceEntry["status"]) => {
    const map: Record<
      DeviceEntry["status"],
      { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
    > = {
      pending: { label: "Pendiente", variant: "secondary" },
      testing: { label: "Probando...", variant: "outline" },
      ok: { label: "Conectado", variant: "default" },
      error: { label: "Error", variant: "destructive" },
    };
    const m = map[status];
    return <Badge variant={m.variant}>{m.label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Agregue los DVR, NVR y camaras IP de la sede. Puede probar la conectividad de cada uno.
      </p>

      {devices.map((device) => (
        <Card key={device.id}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MonitorSpeaker className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {device.name || "Nuevo dispositivo"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {statusBadge(device.status)}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeDevice(device.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input
                  placeholder="DVR Principal"
                  value={device.name}
                  onChange={(e) => updateDevice(device.id, "name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IP / Hostname</Label>
                <Input
                  placeholder="192.168.1.64"
                  value={device.ip}
                  onChange={(e) => updateDevice(device.id, "ip", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Input
                  placeholder="dvr / nvr / camera"
                  value={device.type}
                  onChange={(e) => updateDevice(device.id, "type", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Marca</Label>
                <Input
                  placeholder="hikvision / dahua"
                  value={device.brand}
                  onChange={(e) => updateDevice(device.id, "brand", e.target.value)}
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => testDevice(device.id)}
              disabled={device.status === "testing"}
            >
              {device.status === "testing" ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              Probar Conectividad
            </Button>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" className="w-full" onClick={addDevice}>
        <Plus className="h-4 w-4 mr-2" />
        Agregar Dispositivo
      </Button>
    </div>
  );
}

function StepAccessControl({
  csvFile,
  onCsvChange,
}: {
  csvFile: string;
  onCsvChange: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Importe un archivo CSV con la lista de residentes y vehiculos autorizados.
      </p>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col items-center gap-3 py-6 border-2 border-dashed rounded-lg">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Arrastre un archivo CSV o haga clic para seleccionar
            </p>
            <Input
              type="file"
              accept=".csv"
              className="max-w-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onCsvChange(file.name);
                  toast.success(`Archivo ${file.name} seleccionado`);
                }
              }}
            />
          </div>
          {csvFile && (
            <p className="text-sm mt-3">
              Archivo seleccionado: <strong>{csvFile}</strong>
            </p>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>Formato esperado del CSV:</p>
        <code className="block bg-muted p-2 rounded text-[11px]">
          nombre,unidad,telefono,email,placa_vehiculo
        </code>
      </div>
    </div>
  );
}

function StepDomotics({
  connected,
  onConnect,
}: {
  connected: boolean;
  onConnect: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Conecte su cuenta eWeLink para gestionar dispositivos domoticos (relays, sensores, sirenas).
      </p>

      <Card>
        <CardContent className="pt-4 flex flex-col items-center gap-4">
          <Wifi className="h-12 w-12 text-muted-foreground" />
          {connected ? (
            <div className="text-center">
              <Badge variant="default" className="mb-2">
                Conectado
              </Badge>
              <p className="text-sm text-muted-foreground">
                Cuenta eWeLink vinculada exitosamente
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => onConnect(false)}
              >
                Desvincular
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">
                No hay cuenta eWeLink vinculada
              </p>
              <Button onClick={() => onConnect(true)}>
                Vincular cuenta eWeLink
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Puede omitir este paso si no utiliza dispositivos eWeLink.
      </p>
    </div>
  );
}

function StepConfiguration({
  config,
  onChange,
}: {
  config: ShiftConfig;
  onChange: (c: ShiftConfig) => void;
}) {
  const update = (field: keyof ShiftConfig, value: string | boolean) =>
    onChange({ ...config, [field]: value });

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Label className="text-sm font-medium">Turnos habilitados</Label>
        <div className="space-y-2">
          {([
            ["morningEnabled", "Manana (06:00 - 14:00)"],
            ["afternoonEnabled", "Tarde (14:00 - 22:00)"],
            ["nightEnabled", "Noche (22:00 - 06:00)"],
          ] as const).map(([field, label]) => (
            <label key={field} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-input"
                checked={config[field] as boolean}
                onChange={(e) => update(field, e.target.checked)}
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Intervalo de Patrulla (min)</Label>
          <Input
            type="number"
            placeholder="60"
            value={config.patrolInterval}
            onChange={(e) => update("patrolInterval", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>SLA Respuesta (min)</Label>
          <Input
            type="number"
            placeholder="5"
            value={config.slaResponseMinutes}
            onChange={(e) => update("slaResponseMinutes", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function StepReview({ data }: { data: WizardData }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Revise la configuracion antes de activar la sede.
      </p>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Sede</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>
            <strong>Nombre:</strong> {data.siteInfo.name || "—"}
          </p>
          <p>
            <strong>Direccion:</strong> {data.siteInfo.address || "—"}
          </p>
          <p>
            <strong>Contacto:</strong> {data.siteInfo.contactName || "—"} (
            {data.siteInfo.contactPhone || "sin telefono"})
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dispositivos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {data.devices.length === 0 ? (
            <p className="text-muted-foreground">Ninguno configurado</p>
          ) : (
            <ul className="space-y-1">
              {(data.devices || []).map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <MonitorSpeaker className="h-3 w-3" />
                  {d.name || d.ip || "Sin nombre"} — {d.brand} {d.type}
                  {d.status === "ok" && (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Acceso y Domotica</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>
            <strong>CSV residentes:</strong>{" "}
            {data.csvFile || "No importado"}
          </p>
          <p>
            <strong>eWeLink:</strong>{" "}
            {data.ewelinkConnected ? "Conectado" : "No conectado"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Operaciones</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>
            <strong>Turnos:</strong>{" "}
            {[
              data.shiftConfig.morningEnabled && "Manana",
              data.shiftConfig.afternoonEnabled && "Tarde",
              data.shiftConfig.nightEnabled && "Noche",
            ]
              .filter(Boolean)
              .join(", ") || "Ninguno"}
          </p>
          <p>
            <strong>Patrulla cada:</strong>{" "}
            {data.shiftConfig.patrolInterval || "60"} min
          </p>
          <p>
            <strong>SLA respuesta:</strong>{" "}
            {data.shiftConfig.slaResponseMinutes || "5"} min
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main wizard page ───────────────────────────────────────

export default function OnboardingWizardPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [wizardData, setWizardData] = useState<WizardData>({
    siteInfo: {
      name: "",
      address: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      notes: "",
    },
    devices: [],
    csvFile: "",
    ewelinkConnected: false,
    shiftConfig: {
      morningEnabled: true,
      afternoonEnabled: true,
      nightEnabled: true,
      patrolInterval: "60",
      slaResponseMinutes: "5",
    },
  });

  const pct = Math.round(((currentStep + 1) / STEPS.length) * 100);
  const isLast = currentStep === STEPS.length - 1;

  const goNext = () => {
    if (currentStep === 0 && !wizardData.siteInfo.name.trim()) {
      toast.error("Ingrese el nombre de la sede");
      return;
    }
    if (!isLast) setCurrentStep((s) => s + 1);
  };
  const goBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const activateSite = async () => {
    setSubmitting(true);
    try {
      // Create site
      await apiClient.post("/sites", {
        name: wizardData.siteInfo.name,
        address: wizardData.siteInfo.address,
        status: "healthy",
      });

      // Register devices
      for (const device of wizardData.devices) {
        if (device.name || device.ip) {
          await apiClient.post("/devices", {
            name: device.name || `Device ${device.ip}`,
            ip_address: device.ip,
            type: device.type,
            brand: device.brand,
          });
        }
      }

      toast.success("Sede activada exitosamente");
    } catch {
      toast.error("Error al activar la sede. Intente nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const stepDef = STEPS[currentStep];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepSiteInfo
            data={wizardData.siteInfo}
            onChange={(siteInfo) => setWizardData((d) => ({ ...d, siteInfo }))}
          />
        );
      case 1:
        return (
          <StepDevices
            devices={wizardData.devices}
            onChange={(devices) => setWizardData((d) => ({ ...d, devices }))}
          />
        );
      case 2:
        return (
          <StepAccessControl
            csvFile={wizardData.csvFile}
            onCsvChange={(csvFile) => setWizardData((d) => ({ ...d, csvFile }))}
          />
        );
      case 3:
        return (
          <StepDomotics
            connected={wizardData.ewelinkConnected}
            onConnect={(ewelinkConnected) =>
              setWizardData((d) => ({ ...d, ewelinkConnected }))
            }
          />
        );
      case 4:
        return (
          <StepConfiguration
            config={wizardData.shiftConfig}
            onChange={(shiftConfig) =>
              setWizardData((d) => ({ ...d, shiftConfig }))
            }
          />
        );
      case 5:
        return <StepReview data={wizardData} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Configuracion de Nueva Sede</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Paso {currentStep + 1} de {STEPS.length}
          </p>
        </div>

        {/* Progress */}
        <Progress value={pct} className="h-2 mb-6" />

        {/* Step indicators */}
        <div className="flex justify-between mb-6 overflow-x-auto">
          {STEPS.map((step, i) => {
            const StepIcon = step.icon;
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            return (
              <button
                key={i}
                className={`flex flex-col items-center gap-1 min-w-0 flex-1 transition-colors ${
                  isActive
                    ? "text-primary"
                    : isDone
                      ? "text-primary/60"
                      : "text-muted-foreground/40"
                }`}
                onClick={() => {
                  if (isDone) setCurrentStep(i);
                }}
                disabled={!isDone && !isActive}
                type="button"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : isDone
                        ? "border-primary/60 bg-primary/5"
                        : "border-muted"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>
                <span className="text-[10px] leading-tight text-center hidden sm:block">
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Current step card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {(() => {
                const Icon = stepDef.icon;
                return <Icon className="h-5 w-5" />;
              })()}
              {stepDef.title}
            </CardTitle>
            <CardDescription>{stepDef.description}</CardDescription>
          </CardHeader>
          <CardContent>{renderStepContent()}</CardContent>
        </Card>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>

          {isLast ? (
            <Button onClick={activateSite} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Activar Sede
            </Button>
          ) : (
            <Button onClick={goNext}>
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
