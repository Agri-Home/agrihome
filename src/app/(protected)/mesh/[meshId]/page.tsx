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
import { PlantImage } from "@/components/media/PlantImage";
import { MonitoringAreaChart } from "@/components/charts/MonitoringAreaChart";
import { getMonitoringLog } from "@/lib/services/monitoring-service";
import { listPlantsByTray } from "@/lib/services/plant-service";
import type { MonitoringEvent, TraySystem } from "@/lib/types/domain";
import { getMeshById, listTraySystems } from "@/lib/services/topology-service";
import { formatDateTime } from "@/lib/utils";

function meshTone(status: string) {
  return status === "active" ? ("success" as const) : ("default" as const);
}

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

async function monitoringLogForTrays(
  ownerEmail: string,
  trayIds: string[]
): Promise<MonitoringEvent[]> {
  if (trayIds.length === 0) return [];
  const buckets = await Promise.all(
    trayIds.map((trayId) =>
      getMonitoringLog({ ownerEmail, limit: 28, trayId })
    )
  );
  const byId = new Map<string, MonitoringEvent>();
  for (const list of buckets) {
    for (const ev of list) {
      byId.set(ev.id, ev);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export default async function MeshDetailPage({
  params
}: {
  params: Promise<{ meshId: string }>;
}) {
  const currentUser = await requireSessionAccountUser();
  const { meshId } = await params;
  const mesh = await getMeshById(currentUser.email, meshId);
  if (!mesh) notFound();

  const trays = await listTraySystems(currentUser.email);
  const meshTrays = mesh.trayIds
    .map((id) => trays.find((t) => t.id === id))
    .filter((t): t is TraySystem => Boolean(t));

  const [allPlants, meshEvents] = await Promise.all([
    listPlantsByTray(currentUser.email),
    monitoringLogForTrays(currentUser.email, mesh.trayIds)
  ]);
  const meshPlants = allPlants.filter((p) => mesh.trayIds.includes(p.trayId));
  const alerts = meshPlants.filter((p) => p.status === "alert").length;
  const avgHealth = meshPlants.length > 0
    ? Math.round(meshPlants.reduce((s, p) => s + p.healthScore, 0) / meshPlants.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <BackLink href="/mesh">Mesh</BackLink>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-ink">{mesh.name}</h1>
              <StatusDot status={mesh.status === "active" ? "healthy" : "offline"} pulse={mesh.status === "active"} size="md" />
            </div>
            <p className="mt-0.5 text-sm text-ink/50">
              {mesh.nodeCount} tray{mesh.nodeCount === 1 ? "" : "s"} · created {formatDateTime(mesh.createdAt)}
            </p>
          </div>
          <Badge tone={meshTone(mesh.status)} className="mt-1">{mesh.status}</Badge>
        </div>
      </div>

      {mesh.summary && (
        <p className="animate-fade-in text-sm text-ink/55">{mesh.summary}</p>
      )}

      {/* Stats grid */}
      <div className="animate-fade-in stagger-1 grid grid-cols-3 gap-3">
        <Card className="p-3.5 text-center">
          <p className="text-2xl font-bold text-ink">{meshPlants.length}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Plants</p>
        </Card>
        <Card className="p-3.5 text-center">
          <p className="text-2xl font-bold text-ink">{avgHealth}%</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Avg Health</p>
        </Card>
        <Card className={`p-3.5 text-center ${alerts > 0 ? "ring-1 ring-rose-200" : ""}`}>
          <p className={`text-2xl font-bold ${alerts > 0 ? "text-rose-600" : "text-ink"}`}>{alerts}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Alerts</p>
        </Card>
      </div>

      {/* Activity chart */}
      <section className="animate-fade-in stagger-2">
        <SectionTitle>Activity</SectionTitle>
        <ClientChartFrame
          skeleton={
            <div className="h-[240px] rounded-2xl bg-gradient-to-r from-ember/10 to-lime/15 animate-pulse" />
          }
        >
          <MonitoringAreaChart events={meshEvents} />
        </ClientChartFrame>
      </section>

      {/* Plants list */}
      <section className="animate-fade-in stagger-3">
        <SectionTitle>Plants ({meshPlants.length})</SectionTitle>
        <ul className="flex flex-col gap-2.5">
          {meshPlants.map((plant) => (
            <li key={plant.id}>
              <Link href={`/plants/${plant.id}`}>
                <Card interactive className="flex items-center gap-3 p-3.5">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-mist ring-1 ring-ink/5">
                    {plant.lastImageUrl ? (
                      <PlantImage src={plant.lastImageUrl} alt="" fill className="object-cover" sizes="48px" />
                    ) : (
                      <span className="flex h-full items-center justify-center">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink/20"><path d="M7 20h10M10 20c5.5-2.5.8-6.4 3-10M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" /><path d="M14.1 6a7 7 0 00-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" /></svg>
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{plant.name}</p>
                      <StatusDot status={plantDotStatus(plant.status)} />
                    </div>
                    <p className="truncate text-xs text-ink/45">{plant.cultivar}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-lg font-bold tabular-nums text-ink">{plant.healthScore}%</span>
                    <Badge tone={plantTone(plant.status)}>{plant.status}</Badge>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
        {meshPlants.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-sm text-ink/45">No plants on these trays yet.</p>
          </Card>
        )}
      </section>

      {/* Trays list */}
      <section className="animate-fade-in stagger-4">
        <SectionTitle>Trays ({meshTrays.length})</SectionTitle>
        <ul className="flex flex-col gap-2">
          {meshTrays.map((tray) => (
            <li key={tray.id}>
              <Link href={`/trays/${tray.id}`}>
                <Card interactive className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lime/20 to-leaf/10">
                      <span className="text-sm font-bold text-leaf">{tray.healthScore}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink">{tray.name}</p>
                      <p className="text-xs text-ink/45">{tray.crop}</p>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink/25"><polyline points="9 18 15 12 9 6" /></svg>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
