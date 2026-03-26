"use client";

import { getWaitColor } from "@/lib/utils/colors";

interface ForecastPoint {
  time: string;
  predicted_wait: number;
  confidence: number;
}

export function ForecastChart({
  points,
  width = 320,
  height = 120,
}: {
  points: ForecastPoint[];
  width?: number;
  height?: number;
}) {
  if (points.length === 0) return null;

  const padding = { top: 10, right: 10, bottom: 24, left: 32 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxWait = Math.max(...points.map((p) => p.predicted_wait), 10);
  const yScale = (val: number) => chartH - (val / maxWait) * chartH;
  const xScale = (i: number) => (i / (points.length - 1)) * chartW;

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(p.predicted_wait)}`)
    .join(" ");

  const areaD = `${pathD} L ${xScale(points.length - 1)} ${chartH} L 0 ${chartH} Z`;

  const yTicks = [0, Math.round(maxWait / 2), Math.round(maxWait)];

  const xLabels = [0, Math.floor(points.length / 2), points.length - 1].map((i) => ({
    i,
    label: new Date(points[i].time).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  }));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Wait time forecast chart"
    >
      <g transform={`translate(${padding.left}, ${padding.top})`}>
        {yTicks.map((tick) => (
          <line
            key={tick}
            x1={0}
            y1={yScale(tick)}
            x2={chartW}
            y2={yScale(tick)}
            stroke="currentColor"
            strokeOpacity={0.1}
          />
        ))}

        <path d={areaD} fill="currentColor" fillOpacity={0.05} />

        <path d={pathD} fill="none" stroke="currentColor" strokeWidth={2} className="text-blue-500" />

        {points.map((p, i) => {
          const color = getWaitColor(p.predicted_wait);
          return (
            <circle
              key={i}
              cx={xScale(i)}
              cy={yScale(p.predicted_wait)}
              r={3}
              fill={color.light}
            />
          );
        })}

        {yTicks.map((tick) => (
          <text
            key={tick}
            x={-4}
            y={yScale(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-gray-400 text-[10px]"
          >
            {tick}m
          </text>
        ))}

        {xLabels.map(({ i, label }) => (
          <text
            key={i}
            x={xScale(i)}
            y={chartH + 16}
            textAnchor="middle"
            className="fill-gray-400 text-[10px]"
          >
            {label}
          </text>
        ))}
      </g>
    </svg>
  );
}
