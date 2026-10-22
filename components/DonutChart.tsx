interface Segment {
  label: string;
  value: number;
  color: string;
}

/** Donut simple en SVG puro, sin dependencias. */
export default function DonutChart({ segments, size = 140 }: { segments: Segment[]; size?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const radius = size / 2;
  const stroke = size * 0.22;
  const innerRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * innerRadius;

  let offset = 0;
  const arcs = total === 0
    ? [{ label: "sin datos", value: 1, color: "#E5E7F2" }]
    : segments.filter((s) => s.value > 0);
  const arcTotal = total === 0 ? 1 : total;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${radius} ${radius})`}>
          {arcs.map((seg, i) => {
            const fraction = seg.value / arcTotal;
            const length = fraction * circumference;
            const dasharray = `${length} ${circumference - length}`;
            const dashoffset = -offset;
            offset += length;
            return (
              <circle
                key={i}
                cx={radius}
                cy={radius}
                r={innerRadius}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
              />
            );
          })}
        </g>
        <text x={radius} y={radius} textAnchor="middle" dominantBaseline="central" className="fill-ink font-display font-bold" style={{ fontSize: size * 0.16 }}>
          {total}
        </text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-steel">{seg.label}</span>
            <span className="font-mono text-ink">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
