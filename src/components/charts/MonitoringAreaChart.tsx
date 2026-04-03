"use client";

import type { MonitoringEvent } from "@/lib/types/domain";
import { CHART, monitoringEventsToSeries } from "@/lib/chart-series";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export function MonitoringAreaChart({ events }: { events: MonitoringEvent[] }) {
  const data = monitoringEventsToSeries(events);

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-2xl border border-dashed border-ink/15 bg-mist/40 text-sm text-ink/45">
        No log data to plot.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ember/15 bg-gradient-to-br from-ink/[0.03] via-white to-lime/10 p-4 shadow-[0_12px_40px_rgba(232,93,4,0.08)]">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ember/80">Activity</p>
      <p className="mb-3 text-sm text-ink/50">Signal level (1 = info … 3 = critical)</p>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="areaVibrant" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.lime} stopOpacity={0.55} />
                <stop offset="50%" stopColor={CHART.leaf} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CHART.ember} stopOpacity={0.12} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART.ink, fontSize: 9, opacity: 0.55 }}
              axisLine={{ stroke: CHART.grid }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 3.5]}
              ticks={[1, 2, 3]}
              tick={{ fill: CHART.ink, fontSize: 11, opacity: 0.5 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: `1px solid ${CHART.leaf}`
              }}
              formatter={(value: number) => [value, "Level"]}
            />
            <Area
              type="monotone"
              dataKey="signal"
              stroke={CHART.leaf}
              strokeWidth={2.5}
              fill="url(#areaVibrant)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
