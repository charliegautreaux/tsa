import { getWaitSeverity } from "@/lib/utils/colors";

const COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#f97316",
  severe: "#ef4444",
};

export function Sparkline({
  data,
  id,
  className,
}: {
  data: number[];
  id: string;
  className?: string;
}) {
  if (data.length < 2) return null;

  const w = 200;
  const h = 40;
  const pad = 3;
  const max = Math.max(...data, 5);
  const cH = h - pad * 2;

  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    pad + cH - (v / max) * cH,
  ]);

  const line = pts
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join("");
  const area = `${line}L${w},${h - pad}L0,${h - pad}Z`;

  const color = COLORS[getWaitSeverity(data[data.length - 1])];
  const gid = `sg-${id}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      {/* Glow layer — wider, translucent duplicate */}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={4}
        opacity={0.15}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Main line */}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r={2.5}
        fill={color}
      />
    </svg>
  );
}
