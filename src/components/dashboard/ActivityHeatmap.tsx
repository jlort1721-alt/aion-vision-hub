import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

const DAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getColor(value: number): string {
  if (value === 0) return 'bg-muted/30';
  if (value <= 2) return 'bg-green-500/30';
  if (value <= 4) return 'bg-green-500/50';
  if (value <= 6) return 'bg-yellow-500/50';
  if (value <= 8) return 'bg-orange-500/50';
  return 'bg-red-500/60';
}

function buildHeatmapFromEvents(events: Array<{ created_at?: string; createdAt?: string }>): number[][] {
  const grid = DAYS.map(() => HOURS.map(() => 0));
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const ev of events) {
    const ts = ev.created_at || ev.createdAt;
    if (!ts) continue;
    const d = new Date(ts);
    if (d < weekAgo) continue;
    const dayIdx = (d.getDay() + 6) % 7; // Mon=0
    const hour = d.getHours();
    grid[dayIdx][hour]++;
  }
  return grid;
}

export default function ActivityHeatmap() {
  const { isAuthenticated } = useAuth();

  const { data: events } = useQuery({
    queryKey: ['heatmap-events'],
    queryFn: async () => {
      const res = await apiClient.get('/events', { limit: '500' });
      return res.data?.items || res.data || [];
    },
    enabled: isAuthenticated,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const data = useMemo(() => buildHeatmapFromEvents(events || []), [events]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" /> Mapa de Actividad Semanal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="flex mb-1 ml-10">
              {HOURS.map(h => (
                <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
                  {h % 3 === 0 ? `${String(h).padStart(2, '0')}` : ''}
                </div>
              ))}
            </div>
            {DAYS.map((day, dayIdx) => (
              <div key={day} className="flex items-center gap-1 mb-0.5">
                <span className="w-8 text-[10px] text-muted-foreground text-right shrink-0">{day}</span>
                <div className="flex-1 flex gap-0.5">
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className={`flex-1 h-5 rounded-sm ${getColor(data[dayIdx][hour])} transition-colors`}
                      title={`${day} ${String(hour).padStart(2, '0')}:00 — ${data[dayIdx][hour]} eventos`}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-end gap-1.5 mt-2">
              <span className="text-[9px] text-muted-foreground">Menos</span>
              {['bg-muted/30', 'bg-green-500/30', 'bg-green-500/50', 'bg-yellow-500/50', 'bg-orange-500/50', 'bg-red-500/60'].map((c, i) => (
                <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
              ))}
              <span className="text-[9px] text-muted-foreground">Mas</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
