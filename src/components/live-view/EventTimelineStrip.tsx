import { useMemo } from 'react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────
interface TimelineEvent {
  timestamp: string;
}

interface EventTimelineStripProps {
  events: TimelineEvent[];
  durationMinutes?: number;
  className?: string;
}

// ── Constants ─────────────────────────────────────────────────
const BUCKET_COLORS = [
  'transparent',
  'rgba(234,179,8,0.3)',   // 1 event — yellow
  'rgba(249,115,22,0.5)',  // 2-3 events — orange
  'rgba(249,115,22,0.5)',  // 2-3 events — orange
  'rgba(239,68,68,0.7)',   // 4+ events — red
] as const;

function getBucketColor(count: number): string {
  if (count === 0) return BUCKET_COLORS[0];
  if (count === 1) return BUCKET_COLORS[1];
  if (count <= 3) return BUCKET_COLORS[2];
  return BUCKET_COLORS[4];
}

// ── Component ─────────────────────────────────────────────────
export function EventTimelineStrip({
  events,
  durationMinutes = 60,
  className,
}: EventTimelineStripProps) {
  const buckets = useMemo(() => {
    const now = Date.now();
    const windowStart = now - durationMinutes * 60 * 1000;
    const bucketCount = durationMinutes;
    const bucketMs = (durationMinutes * 60 * 1000) / bucketCount;
    const counts = new Array<number>(bucketCount).fill(0);

    for (const event of events) {
      const eventTime = new Date(event.timestamp).getTime();
      if (eventTime < windowStart || eventTime > now) continue;

      const bucketIndex = Math.min(
        Math.floor((eventTime - windowStart) / bucketMs),
        bucketCount - 1,
      );
      counts[bucketIndex] += 1;
    }

    return counts;
  }, [events, durationMinutes]);

  return (
    <div
      className={cn('flex w-full h-1.5 rounded-sm overflow-hidden bg-muted/30', className)}
      role="img"
      aria-label={`Linea de tiempo: ${events.length} eventos en ${durationMinutes} minutos`}
    >
      {buckets.map((count, index) => (
        <div
          key={index}
          className="flex-1 transition-colors duration-300"
          style={{ backgroundColor: getBucketColor(count) }}
          title={
            count > 0
              ? `${count} evento${count > 1 ? 's' : ''}`
              : undefined
          }
        />
      ))}
    </div>
  );
}
