import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SessionCardProps {
  session: {
    id: string;
    vendor: string;
    device_id: string;
    display_name: string;
    state: string;
    remote_addr: string;
    opened_at: string;
    last_heartbeat: string;
    channel_count: number;
  };
  selected?: boolean;
  onClick?: () => void;
}

const stateColors: Record<string, string> = {
  online: "bg-green-500",
  connecting: "bg-yellow-500",
  degraded: "bg-orange-500",
  disconnected: "bg-red-500",
};

export function SessionCard({ session, selected, onClick }: SessionCardProps) {
  const sinceHb = session.last_heartbeat
    ? Math.round(
        (Date.now() - new Date(session.last_heartbeat).getTime()) / 1000,
      )
    : null;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors hover:border-red-500/40",
        selected && "border-red-500 ring-1 ring-red-500/30",
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                stateColors[session.state] ?? "bg-gray-400",
              )}
            />
            <span className="font-medium text-sm">
              {session.display_name || session.device_id}
            </span>
          </div>
          <Badge
            variant={session.vendor === "hikvision" ? "default" : "secondary"}
            className="text-[10px]"
          >
            {session.vendor === "hikvision" ? "HIK" : "DAHUA"}
          </Badge>
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
          <div>
            {session.remote_addr} &middot; {session.channel_count ?? 1} ch
          </div>
          {sinceHb !== null && (
            <div>
              Heartbeat: hace{" "}
              {sinceHb < 60 ? `${sinceHb}s` : `${Math.round(sinceHb / 60)}min`}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
