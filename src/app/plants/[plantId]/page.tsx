export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/atoms/Badge";
import { BackLink } from "@/components/app/BackLink";
import { Card, SectionTitle } from "@/components/app/Section";
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

function severityTone(s: string) {
  if (s === "high") return "critical" as const;
  if (s === "medium") return "warning" as const;
  return "default" as const;
}

export default async function PlantDetailPage({
  params
}: {
  params: Promise<{ plantId: string }>;
}) {
  const { plantId } = await params;
  const plant = await getPlantById(plantId);
  if (!plant) notFound();

  const [tray, meshes] = await Promise.all([
    getTrayById(plant.trayId),
    listMeshNetworks()
  ]);
  const reports = await listPlantReports({ plantId: plant.id, limit: 25 });
  const plantLog = await getMonitoringLog(15, undefined, plant.id);
  const trayFallbackLog =
    plantLog.length === 0 ? await getMonitoringLog(10, plant.trayId) : [];

  const logEntries = plantLog.length > 0 ? plantLog : trayFallbackLog;
  const logSubtitle =
    plantLog.length > 0 ? "Log" : trayFallbackLog.length > 0 ? "Tray log" : "Log";

  return (
    <div>
      <BackLink href={`/trays/${plant.trayId}`}>{tray?.name ?? "Tray"}</BackLink>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="bg-gradient-to-r from-moss via-leaf to-lime bg-clip-text text-xl font-bold tracking-tight text-transparent">
            {plant.name}
          </h1>
          <p className="text-sm text-ink/45">{plant.cultivar}</p>
          <p className="mt-1 text-xs text-ink/40">Slot {plant.slotLabel}</p>
        </div>
        <Badge tone={plantTone(plant.status)}>{plant.status}</Badge>
      </div>

      <PlantDetailClient plant={plant} />

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink/40">Health</dt>
          <dd className="font-medium tabular-nums">{plant.healthScore}%</dd>
        </div>
        <div>
          <dt className="text-ink/40">Last report</dt>
          <dd>{formatDateTime(plant.lastReportAt)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-ink/40">Latest finding</dt>
          <dd className="text-ink/70">{plant.latestDiagnosis}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <ClientChartFrame
          skeleton={
            <div className="h-[240px] rounded-2xl bg-gradient-to-r from-lime/20 to-moss/10 animate-pulse" />
          }
        >
          <PlantHealthLineChart reports={reports} />
        </ClientChartFrame>
      </div>

      {plant.meshIds.length > 0 ? (
        <p className="mt-3 text-xs text-ink/40">
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
        </p>
      ) : null}

      <section className="mt-6">
        <SectionTitle>Report history</SectionTitle>
        <ul className="flex flex-col gap-2">
          {reports.map((r) => (
            <li key={r.id}>
              <Card className="py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{r.diagnosis}</p>
                  <Badge tone={severityTone(r.severity)} className="!normal-case">
                    {r.severity}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-ink/45">{formatDateTime(r.createdAt)}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{r.summary}</p>
                <p className="mt-2 text-xs text-ink/50">
                  Confidence {clampPercent(r.confidence)} · {r.status}
                </p>
                {(r.diseases.length > 0 || r.deficiencies.length > 0) && (
                  <p className="mt-1 text-xs text-ink/45">
                    {r.diseases.length > 0 ? `Issues: ${r.diseases.join(", ")}` : ""}
                    {r.diseases.length > 0 && r.deficiencies.length > 0 ? " · " : ""}
                    {r.deficiencies.length > 0 ? `Deficits: ${r.deficiencies.join(", ")}` : ""}
                  </p>
                )}
                <p className="mt-2 border-t border-ink/10 pt-2 text-xs text-ink/55">
                  Next step: {r.recommendedAction}
                </p>
              </Card>
            </li>
          ))}
        </ul>
        {reports.length === 0 ? <p className="text-sm text-ink/45">No saved reports.</p> : null}
      </section>

      <section className="mt-6">
        <SectionTitle>{logSubtitle}</SectionTitle>
        {plantLog.length === 0 && trayFallbackLog.length > 0 ? (
          <p className="mb-2 text-xs text-ink/40">No plant-tagged events; showing tray entries.</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {logEntries.map((ev) => (
            <li key={ev.id}>
              <Card className="py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{ev.title}</p>
                  <span className="shrink-0 text-xs text-ink/40">
                    {formatRelativeTimestamp(ev.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink/50">{ev.message}</p>
                <p className="mt-1 text-[0.65rem] uppercase text-ink/35">{ev.level}</p>
              </Card>
            </li>
          ))}
        </ul>
        {logEntries.length === 0 ? <p className="text-sm text-ink/45">No log entries.</p> : null}
      </section>
    </div>
  );
}
