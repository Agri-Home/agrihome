"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { CHART } from "@/lib/chart-series";

export function TrayHealthBarChart({
  items
}: {
  items: Array<{ name: string; health: number }>;
}) {
  const data = items.map((t) => ({
    name: t.name.length > 12 ? `${t.name.slice(0, 11)}…` : t.name,
    health: t.health
  }));

  const barColor = (h: number) =>
    h >= 85 ? CHART.leaf : h >= 70 ? CHART.lime : h >= 55 ? CHART.warning : CHART.critical;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-leaf/20 bg-gradient-to-br from-white via-lime/10 to-leaf/15 p-4 shadow-[0_12px_40px_rgba(61,159,108,0.12)]">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-moss/70">Tray health</p>
      <p className="mb-3 text-sm text-ink/50">Score by tray (%)</p>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: CHART.ink, fontSize: 11, opacity: 0.65 }}
              axisLine={{ stroke: CHART.grid }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: CHART.ink, fontSize: 11, opacity: 0.5 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: `1px solid ${CHART.leaf}`,
                boxShadow: "0 8px 24px rgba(15,31,23,0.1)"
              }}
              formatter={(value: number) => [`${value}%`, "Health"]}
            />
            <Bar dataKey="health" radius={[8, 8, 4, 4]} maxBarSize={48}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={barColor(entry.health)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
