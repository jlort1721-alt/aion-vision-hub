interface SparklineProps {
  data: number[];  // array of 7 values (last 7 days)
  color?: string;  // default: "hsl(var(--primary))"
  height?: number; // default: 24
  width?: number;  // default: 80
}

let sparklineIdCounter = 0;

export default function Sparkline({
  data,
  color = 'hsl(var(--primary))',
  height = 24,
  width = 80,
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const gradientId = `sparkline-grad-${++sparklineIdCounter}`;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * innerW;
    const y = padding + innerH - ((v - min) / range) * innerH;
    return `${x},${y}`;
  });

  const polyline = points.join(' ');

  // Build the fill polygon (area under the line)
  const firstX = padding;
  const lastX = padding + innerW;
  const areaPath = `${polyline} ${lastX},${height} ${firstX},${height}`;

  const lastPoint = points[points.length - 1].split(',');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon points={areaPath} fill={`url(#${gradientId})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastPoint[0]}
        cy={lastPoint[1]}
        r={2}
        fill={color}
      />
    </svg>
  );
}
