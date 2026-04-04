export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/atoms/Badge";
import { BackLink } from "@/components/app/BackLink";
import { Card, SectionTitle } from "@/components/app/Section";
import { ClientChartFrame } from "@/components/charts/ClientChartFrame";
import { PlantImage } from "@/components/media/PlantImage";
import { MonitoringAreaChart } from "@/components/charts/MonitoringAreaChart";
import { getLatestCameraCapture } from "@/lib/services/camera-service";
import { getMonitoringLog } from "@/lib/services/monitoring-service";
import { listPlantsByTray } from "@/lib/services/plant-service";
import { getTrayById } from "@/lib/services/topology-service";
import { formatDateTime, formatRelativeTimestamp } from "@/lib/utils";

import { TrayVisionAnalyzeClient } from "./TrayVisionAnalyzeClient";

function trayTone(status: string) {
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "success" as const;
}

function plantTone(status: string) {
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "success" as const;
}

export default async function TrayDetailPage({
  params
}: {
  params: Promise<{ trayId: string }>;
}) {
  const { trayId } = await params;
  const tray = await getTrayById(trayId);
  if (!tray) notFound();

  const [plants, events, capture] = await Promise.all([
    listPlantsByTray(trayId),
    getMonitoringLog(15, trayId),
    getLatestCameraCapture(trayId)
  ]);

  return (
    <div>
      <BackLink href="/trays">Trays</BackLink>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="bg-gradient-to-r from-moss to-leaf bg-clip-text text-xl font-bold tracking-tight text-transparent">
            {tray.name}
          </h1>
          <p className="text-sm text-ink/45">
            {tray.crop} · {tray.zone}
          </p>
        </div>
        <Badge tone={trayTone(tray.status)}>{tray.status}</Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-ink/40">Health</dt>
          <dd className="font-medium tabular-nums">{tray.healthScore}%</dd>
        </div>
        <div>
          <dt className="text-ink/40">Plants (catalog)</dt>
          <dd className="font-medium">{tray.plantCount}</dd>
        </div>
        <div>
          <dt className="text-ink/40">CV plant count</dt>
          <dd className="font-medium">
            {tray.visionPlantCount != null ? (
              <>
                {tray.visionPlantCount}
                {tray.visionPlantCountConfidence != null ? (
                  <span className="ml-1 text-xs font-normal text-ink/45">
                    ({(tray.visionPlantCountConfidence * 100).toFixed(0)}% conf.)
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-ink/40">—</span>
            )}
          </dd>
        </div>
        {tray.visionPlantCountAt ? (
          <div className="col-span-2">
            <dt className="text-ink/40">Last CV analysis</dt>
            <dd>{formatDateTime(tray.visionPlantCountAt)}</dd>
          </div>
        ) : null}
        <div className="col-span-2">
          <dt className="text-ink/40">Camera</dt>
          <dd className="font-mono text-xs text-ink/70">{tray.deviceId}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-ink/40">Last capture</dt>
          <dd>{formatDateTime(tray.lastCaptureAt)}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <ClientChartFrame
          skeleton={
            <div className="h-[240px] rounded-2xl bg-gradient-to-r from-ember/10 to-lime/15 animate-pulse" />
          }
        >
          <MonitoringAreaChart events={events} />
        </ClientChartFrame>
      </div>

      <TrayVisionAnalyzeClient trayId={tray.id} />

      {capture?.imageUrl ? (
        <div className="mt-6">
          <SectionTitle>Latest image</SectionTitle>
          <Card className="overflow-hidden p-0">
            <div className="relative aspect-[4/3] w-full bg-mist">
              <Image
                src={capture.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            </div>
            <p className="px-3 py-2 text-xs text-ink/45">
              {formatRelativeTimestamp(capture.capturedAt)}
            </p>
          </Card>
        </div>
      ) : null}

      <section className="mt-6">
        <SectionTitle>Plants</SectionTitle>
        <ul className="flex flex-col gap-2">
          {plants.map((plant) => (
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
                    <span className="text-sm tabular-nums font-semibold text-leaf">
                      {plant.healthScore}%
                    </span>
                    <Badge tone={plantTone(plant.status)}>{plant.status}</Badge>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
        {plants.length === 0 ? <p className="text-sm text-ink/45">No plants in this tray.</p> : null}
      </section>

      <section className="mt-6">
        <SectionTitle>Log</SectionTitle>
        <ul className="flex flex-col gap-2">
          {events.map((ev) => (
            <li key={ev.id}>
              <Card className="py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{ev.title}</p>
                  <span className="shrink-0 text-xs text-ink/40">
                    {formatRelativeTimestamp(ev.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink/50">{ev.message}</p>
                <p className="mt-1 text-[0.65rem] uppercase text-ink/35">{ev.level}</p>
              </Card>
            </li>
          ))}
        </ul>
        {events.length === 0 ? <p className="text-sm text-ink/45">No entries.</p> : null}
      </section>
    </div>
  );
}
