import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

const DAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function generateMockData(): number[][] {
  return DAYS.map((_, dayIdx) =>
    HOURS.map((hour) => {
      // Simulate realistic security activity patterns
      const isWeekend = dayIdx >= 5;
      const isNight = hour >= 22 || hour <= 5;
      const isPeak = hour >= 7 && hour <= 9 || hour >= 17 && hour <= 19;
      let base = Math.random() * 3;
      if (isNight) base += Math.random() * 4;
      if (isPeak) base += Math.random() * 5;
      if (isWeekend && isNight) base += Math.random() * 3;
      return Math.round(base);
    })
  );
}

function getColor(value: number): string {
  if (value === 0) return 'bg-muted/30';
  if (value <= 2) return 'bg-green-500/30';
  if (value <= 4) return 'bg-green-500/50';
  if (value <= 6) return 'bg-yellow-500/50';
  if (value <= 8) return 'bg-orange-500/50';
  return 'bg-red-500/60';
}

export default function ActivityHeatmap() {
  const data = useMemo(() => generateMockData(), []);

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
            {/* Hour labels */}
            <div className="flex mb-1 ml-10">
              {HOURS.map(h => (
                <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
                  {h % 3 === 0 ? `${String(h).padStart(2, '0')}` : ''}
                </div>
              ))}
            </div>
            {/* Grid rows */}
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
            {/* Legend */}
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
