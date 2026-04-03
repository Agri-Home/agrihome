import type { MonitoringEvent, PlantReport, Severity } from "@/lib/types/domain";

export const CHART = {
  leaf: "#3d9f6c",
  lime: "#c8fb80",
  ember: "#e85d04",
  moss: "#1a3d2e",
  ink: "#0f1f17",
  grid: "rgba(15, 31, 23, 0.08)",
  warning: "#f59e0b",
  critical: "#f43f5e"
} as const;

export function monitoringEventsToSeries(events: MonitoringEvent[]) {
  const chronological = [...events].reverse();
  return chronological.map((ev, i) => ({
    i,
    label: new Date(ev.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }),
    signal:
      ev.level === "critical" ? 3 : ev.level === "warning" ? 2 : 1
  }));
}

function scoreFromSeverity(severity: Severity, confidence: number) {
  const base =
    severity === "high" ? 52 : severity === "medium" ? 72 : 91;
  const adj = Math.round((confidence - 0.8) * 40);
  return Math.min(99, Math.max(38, base + adj));
}

export function reportsToHealthSeries(reports: PlantReport[]) {
  const chronological = [...reports].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  return chronological.map((r, idx) => ({
    idx,
    label: new Date(r.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    }),
    score: scoreFromSeverity(r.severity, r.confidence)
  }));
}
