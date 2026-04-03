"use client";

import type { PlantReport } from "@/lib/types/domain";
import { CHART, reportsToHealthSeries } from "@/lib/chart-series";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export function PlantHealthLineChart({ reports }: { reports: PlantReport[] }) {
  const data = reportsToHealthSeries(reports);

  if (data.length < 2) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-2xl border border-dashed border-leaf/25 bg-gradient-to-br from-lime/5 to-transparent text-sm text-ink/45">
        Need at least two reports for a trend line.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-leaf/25 bg-gradient-to-br from-lime/15 via-white to-moss/5 p-4 shadow-[0_12px_40px_rgba(61,159,108,0.14)]">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-leaf">Health trend</p>
      <p className="mb-3 text-sm text-ink/50">Estimated score from report severity</p>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={CHART.lime} />
                <stop offset="100%" stopColor={CHART.leaf} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART.ink, fontSize: 10, opacity: 0.55 }}
              axisLine={{ stroke: CHART.grid }}
              tickLine={false}
            />
            <YAxis
              domain={[35, 100]}
              tick={{ fill: CHART.ink, fontSize: 11, opacity: 0.5 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: `1px solid ${CHART.lime}`
              }}
              formatter={(value: number) => [`${value}%`, "Est. health"]}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="url(#lineStroke)"
              strokeWidth={3}
              dot={{ fill: CHART.ember, strokeWidth: 2, stroke: "#fff", r: 4 }}
              activeDot={{ r: 6, fill: CHART.leaf }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
