export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/atoms/Badge";
import { BackLink } from "@/components/app/BackLink";
import { Card, SectionTitle } from "@/components/app/Section";
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

async function monitoringLogForTrays(trayIds: string[]): Promise<MonitoringEvent[]> {
  if (trayIds.length === 0) return [];
  const buckets = await Promise.all(
    trayIds.map((trayId) => getMonitoringLog(28, trayId))
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
  const { meshId } = await params;
  const mesh = await getMeshById(meshId);
  if (!mesh) notFound();

  const trays = await listTraySystems();
  const meshTrays = mesh.trayIds
    .map((id) => trays.find((t) => t.id === id))
    .filter((t): t is TraySystem => Boolean(t));

  const [allPlants, meshEvents] = await Promise.all([
    listPlantsByTray(),
    monitoringLogForTrays(mesh.trayIds)
  ]);
  const meshPlants = allPlants.filter((p) => mesh.trayIds.includes(p.trayId));
  const alerts = meshPlants.filter((p) => p.status === "alert").length;

  return (
    <div>
      <BackLink href="/mesh">Mesh</BackLink>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-ink">{mesh.name}</h1>
          <p className="text-sm text-ink/45">
            {mesh.nodeCount} trays · created {formatDateTime(mesh.createdAt)}
          </p>
        </div>
        <Badge tone={meshTone(mesh.status)}>{mesh.status}</Badge>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink/55">{mesh.summary}</p>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-ink/40">Plants in group</dt>
          <dd className="font-medium">{meshPlants.length}</dd>
        </div>
        <div>
          <dt className="text-ink/40">Alerts</dt>
          <dd className="font-medium tabular-nums">{alerts}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <ClientChartFrame
          skeleton={
            <div className="h-[240px] rounded-2xl bg-gradient-to-r from-ember/10 to-lime/15 animate-pulse" />
          }
        >
          <MonitoringAreaChart events={meshEvents} />
        </ClientChartFrame>
      </div>

      <section className="mt-6">
        <SectionTitle>Plants</SectionTitle>
        <ul className="flex flex-col gap-2">
          {meshPlants.map((plant) => (
            <li key={plant.id}>
              <Link href={`/plants/${plant.id}`}>
                <Card className="flex items-center gap-3 hover:border-lime/40 hover:shadow-[0_8px_28px_rgba(200,251,128,0.15)]">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-mist ring-2 ring-leaf/25">
                    {plant.lastImageUrl ? (
                      <PlantImage
                        src={plant.lastImageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[10px] text-ink/30">
                        —
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{plant.name}</p>
                    <p className="truncate text-xs text-ink/45">{plant.cultivar}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-leaf">
                      {plant.healthScore}%
                    </span>
                    <Badge tone={plantTone(plant.status)}>{plant.status}</Badge>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
        {meshPlants.length === 0 ? (
          <p className="mt-2 text-sm text-ink/45">No plants on these trays yet.</p>
        ) : null}
      </section>

      <section className="mt-6">
        <SectionTitle>Trays</SectionTitle>
        <ul className="flex flex-col gap-2">
          {meshTrays.map((tray) => (
            <li key={tray.id}>
              <Link href={`/trays/${tray.id}`}>
                <Card className="flex items-center justify-between hover:border-leaf/30">
                  <div>
                    <p className="font-medium">{tray.name}</p>
                    <p className="text-xs text-ink/45">
                      {tray.crop} · {tray.healthScore}%
                    </p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
