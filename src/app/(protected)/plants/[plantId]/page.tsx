export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { StatusDot } from "@/components/atoms/StatusDot";
import { BackLink } from "@/components/app/BackLink";
import { SectionTitle } from "@/components/app/Section";
import { requireSessionAccountUser } from "@/lib/auth/session";
import { ClientChartFrame } from "@/components/charts/ClientChartFrame";
import { PlantHealthLineChart } from "@/components/charts/PlantHealthLineChart";
import { getMonitoringLog } from "@/lib/services/monitoring-service";
import { getPlantById, listPlantReports } from "@/lib/services/plant-service";
import { getTrayById, listMeshNetworks } from "@/lib/services/topology-service";
import { clampPercent, formatDateTime, formatRelativeTimestamp } from "@/lib/utils";

import { PlantDetailClient } from "./PlantDetailClient";

function plantTone(status: string) {
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "success" as const;
}

function plantDotStatus(status: string) {
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "healthy" as const;
}

function severityTone(s: string) {
  if (s === "high") return "critical" as const;
  if (s === "medium") return "warning" as const;
  return "success" as const;
}

export default async function PlantDetailPage({
  params
}: {
  params: Promise<{ plantId: string }>;
}) {
  const currentUser = await requireSessionAccountUser();
  const { plantId } = await params;
  const plant = await getPlantById(currentUser.email, plantId);
  if (!plant) notFound();

  const [tray, meshes] = await Promise.all([
    getTrayById(currentUser.email, plant.trayId),
    listMeshNetworks(currentUser.email)
  ]);
  const reports = await listPlantReports({
    ownerEmail: currentUser.email,
    plantId: plant.id,
    limit: 25
  });
  const plantLog = await getMonitoringLog({
    ownerEmail: currentUser.email,
    limit: 15,
    plantId: plant.id
  });
  const trayFallbackLog =
    plantLog.length === 0
      ? await getMonitoringLog({
          ownerEmail: currentUser.email,
          limit: 10,
          trayId: plant.trayId
        })
      : [];

  const logEntries = plantLog.length > 0 ? plantLog : trayFallbackLog;
  const logSubtitle =
    plantLog.length > 0 ? "Log" : trayFallbackLog.length > 0 ? "Tray Log" : "Log";

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <BackLink href={`/trays/${plant.trayId}`}>{tray?.name ?? "Tray"}</BackLink>

        {/* Hero header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-ink">
                {plant.name}
              </h1>
              <StatusDot status={plantDotStatus(plant.status)} pulse size="md" />
            </div>
            <p className="mt-0.5 text-sm text-ink/50">{plant.cultivar}</p>
            <p className="mt-0.5 text-xs text-ink/35">Slot {plant.slotLabel}</p>
          </div>
          <Badge tone={plantTone(plant.status)} className="mt-1">{plant.status}</Badge>
        </div>
      </div>

      {/* Quick stats */}
      <div className="animate-fade-in stagger-1 grid grid-cols-3 gap-3">
        <Card className="p-3.5 text-center">
          <p className="text-2xl font-bold text-ink">{plant.healthScore}%</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Health</p>
        </Card>
        <Card className="p-3.5 text-center">
          <p className="text-sm font-bold text-ink">{formatRelativeTimestamp(plant.lastReportAt)}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Last Report</p>
        </Card>
        <Card className="p-3.5 text-center">
          <p className="text-sm font-bold text-ink">{reports.length}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Reports</p>
        </Card>
      </div>

      {/* Latest diagnosis card */}
      <Card className="animate-fade-in stagger-2 bg-gradient-to-br from-white/95 to-lime/[0.04] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/40">Latest Finding</p>
        <p className="mt-2 text-sm font-medium text-ink/75">{plant.latestDiagnosis}</p>
      </Card>

      {/* Photo + edit section */}
      <section className="animate-fade-in stagger-3">
        <PlantDetailClient plant={plant} />
      </section>

      {/* Health chart */}
      <section className="animate-fade-in stagger-4">
        <SectionTitle>Health Trend</SectionTitle>
        <ClientChartFrame
          skeleton={
            <div className="h-[240px] rounded-2xl bg-gradient-to-r from-lime/20 to-moss/10 animate-pulse" />
          }
        >
          <PlantHealthLineChart reports={reports} />
        </ClientChartFrame>
      </section>

      {/* Meshes */}
      {plant.meshIds.length > 0 && (
        <div className="animate-fade-in text-xs text-ink/40">
          Meshes:{" "}
          {plant.meshIds.map((id, i) => {
            const m = meshes.find((x) => x.id === id);
            return (
              <span key={id}>
                {i > 0 ? ", " : ""}
                <Link href={`/mesh/${id}`} className="text-leaf underline-offset-2 hover:underline">
                  {m?.name ?? id}
                </Link>
              </span>
            );
          })}
        </div>
      )}

      {/* Report history */}
      <section className="animate-fade-in">
        <SectionTitle>Report History</SectionTitle>
        {reports.length > 0 ? (
          <div className="space-y-2.5">
            {reports.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{r.diagnosis}</p>
                  <Badge tone={severityTone(r.severity)}>{r.severity}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-ink/35">{formatDateTime(r.createdAt)}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{r.summary}</p>

                {(r.diseases.length > 0 || r.deficiencies.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.diseases.map((d) => (
                      <span key={d} className="rounded-lg bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-rose-100">{d}</span>
                    ))}
                    {r.deficiencies.map((d) => (
                      <span key={d} className="rounded-lg bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-100">{d}</span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-ink/5 pt-2.5">
                  <p className="text-xs text-ink/40">
                    Confidence {clampPercent(r.confidence)} · {r.status}
                  </p>
                  <p className="text-xs font-medium text-leaf">{r.recommendedAction}</p>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-sm text-ink/45">No saved reports yet.</p>
          </Card>
        )}
      </section>

      {/* Event log */}
      {logEntries.length > 0 && (
        <section className="animate-fade-in">
          <SectionTitle>{logSubtitle}</SectionTitle>
          {plantLog.length === 0 && trayFallbackLog.length > 0 && (
            <p className="mb-2 text-xs text-ink/35">No plant-tagged events; showing tray entries.</p>
          )}
          <Card className="divide-y divide-ink/5 p-0">
            {logEntries.slice(0, 8).map((ev, i) => (
              <div key={ev.id} className={`flex items-start gap-3 px-4 py-3 ${i === 0 ? "rounded-t-3xl" : ""} ${i === Math.min(7, logEntries.length - 1) ? "rounded-b-3xl" : ""}`}>
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                  ev.level === "critical"
                    ? "bg-rose-100 text-rose-600"
                    : ev.level === "warning"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-emerald-100 text-emerald-600"
                }`}>
                  {ev.level === "critical" ? "!" : ev.level === "warning" ? "!" : "i"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink">{ev.title}</p>
                    <p className="shrink-0 text-[11px] text-ink/35">{formatRelativeTimestamp(ev.createdAt)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-ink/45 line-clamp-1">{ev.message}</p>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
