import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";

interface DeviceApprovalDialogProps {
  device: {
    id: string;
    vendor: string;
    device_id: string;
    display_name?: string;
    channel_count?: number;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: () => void;
}

export function DeviceApprovalDialog({
  device,
  open,
  onOpenChange,
  onApproved,
}: DeviceApprovalDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [channelCount, setChannelCount] = useState(16);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [isupKey, setIsupKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleApprove = async () => {
    if (!device) return;
    setSubmitting(true);
    setError("");
    try {
      await apiClient.post(`/reverse/devices/${device.id}/approve`, {
        display_name: displayName || undefined,
        channel_count: channelCount,
        username: username || undefined,
        password: password || undefined,
        isup_key: isupKey || undefined,
      });
      onApproved();
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message ?? "Error al aprobar dispositivo");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aprobar Dispositivo</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {device?.vendor?.toUpperCase()} &middot; {device?.device_id}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dn">Nombre</Label>
            <Input
              id="dn"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={device?.display_name ?? "Ej: Brescia XVR"}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc">Canales</Label>
            <Input
              id="cc"
              type="number"
              min={1}
              max={256}
              value={channelCount}
              onChange={(e) => setChannelCount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="usr">Usuario del equipo</Label>
            <Input
              id="usr"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pwd">Contrasena del equipo</Label>
            <Input
              id="pwd"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {device?.vendor === "hikvision" && (
            <div className="space-y-1.5">
              <Label htmlFor="ik">Clave ISUP (Hikvision)</Label>
              <Input
                id="ik"
                value={isupKey}
                onChange={(e) => setIsupKey(e.target.value)}
                placeholder="Clave de verificacion ISUP"
              />
            </div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleApprove} disabled={submitting}>
            {submitting ? "Aprobando..." : "Aprobar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
