export const dynamic = "force-dynamic";

import Image from "next/image";
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
import { getLatestCameraCapture } from "@/lib/services/camera-service";
import { getMonitoringLog } from "@/lib/services/monitoring-service";
import { listPlantsByTray } from "@/lib/services/plant-service";
import { getTrayById } from "@/lib/services/topology-service";
import { formatDateTime, formatRelativeTimestamp } from "@/lib/utils";

import { TrayManageClient } from "./TrayManageClient";
import { TrayVisionAnalyzeClient } from "./TrayVisionAnalyzeClient";

function trayTone(status: string) {
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "success" as const;
}

function trayDotStatus(status: string) {
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "healthy" as const;
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

export default async function TrayDetailPage({
  params
}: {
  params: Promise<{ trayId: string }>;
}) {
  const currentUser = await requireSessionAccountUser();
  const { trayId } = await params;
  const tray = await getTrayById(currentUser.email, trayId);
  if (!tray) notFound();

  const [plants, events, capture] = await Promise.all([
    listPlantsByTray(currentUser.email, trayId),
    getMonitoringLog({ ownerEmail: currentUser.email, limit: 15, trayId }),
    getLatestCameraCapture(currentUser.email, trayId)
  ]);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <BackLink href="/trays">Trays</BackLink>

        {/* Hero header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-ink">
                {tray.name}
              </h1>
              <StatusDot status={trayDotStatus(tray.status)} pulse size="md" />
            </div>
            <p className="mt-0.5 text-sm text-ink/50">
              {tray.crop} · {tray.zone}
            </p>
          </div>
          <Badge tone={trayTone(tray.status)} className="mt-1">{tray.status}</Badge>
        </div>
      </div>

      <section className="animate-fade-in stagger-1">
        <TrayManageClient tray={tray} />
      </section>

      {/* Stats grid */}
      <div className="animate-fade-in stagger-2 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/40">Health</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-ink">{tray.healthScore}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/40">Plants</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-ink">{tray.plantCount}</p>
          {tray.visionPlantCount != null && (
            <p className="mt-0.5 text-xs text-ink/40">
              CV: {tray.visionPlantCount}
              {tray.visionPlantCountConfidence != null && (
                <span className="ml-1">({(tray.visionPlantCountConfidence * 100).toFixed(0)}%)</span>
              )}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/40">Camera</p>
          <p className="mt-1 text-sm font-semibold font-mono text-ink/70">{tray.deviceId}</p>
          <p className="mt-0.5 text-xs text-ink/40">{formatRelativeTimestamp(tray.lastCaptureAt)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/40">CV Analysis</p>
          <p className="mt-1 text-sm font-semibold text-ink/70">
            {tray.visionPlantCountAt ? formatDateTime(tray.visionPlantCountAt) : "Not run yet"}
          </p>
        </Card>
      </div>

      {/* Latest image */}
      {capture?.imageUrl && (
        <section className="animate-fade-in stagger-3">
          <SectionTitle>Latest Capture</SectionTitle>
          <Card className="overflow-hidden p-0">
            <div className="relative aspect-[16/10] w-full bg-mist">
              <Image
                src={capture.imageUrl}
                alt="Latest tray capture"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4">
                <div className="flex items-end justify-between">
                  <p className="text-sm font-medium text-white">
                    {formatRelativeTimestamp(capture.capturedAt)}
                  </p>
                  <Badge tone="success" live>Live</Badge>
                </div>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* Activity chart */}
      <section className="animate-fade-in stagger-4">
        <SectionTitle>Activity</SectionTitle>
        <ClientChartFrame
          skeleton={
            <div className="h-[240px] rounded-2xl bg-gradient-to-r from-ember/10 to-lime/15 animate-pulse" />
          }
        >
          <MonitoringAreaChart events={events} />
        </ClientChartFrame>
      </section>

      {/* CV Analysis */}
      <section className="animate-fade-in stagger-5">
        <SectionTitle>Computer Vision</SectionTitle>
        <TrayVisionAnalyzeClient trayId={tray.id} />
      </section>

      {/* Plants list */}
      <section className="animate-fade-in stagger-6">
        <div className="flex items-center justify-between">
          <SectionTitle>Plants ({plants.length})</SectionTitle>
          <Link
            href={`/plants/new?trayId=${encodeURIComponent(tray.id)}`}
            className="text-xs font-semibold text-leaf transition-colors hover:text-leaf/80"
          >
            + Photo add
          </Link>
        </div>
        <ul className="flex flex-col gap-2.5">
          {plants.map((plant) => (
            <li key={plant.id}>
              <Link href={`/plants/${plant.id}`}>
                <Card interactive className="flex items-center gap-3 p-3.5">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-mist ring-1 ring-ink/5">
                    {plant.lastImageUrl ? (
                      <PlantImage
                        src={plant.lastImageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink/20"><path d="M7 20h10M10 20c5.5-2.5.8-6.4 3-10M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" /><path d="M14.1 6a7 7 0 00-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" /></svg>
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{plant.name}</p>
                      <StatusDot status={plantDotStatus(plant.status)} />
                    </div>
                    <p className="truncate text-xs text-ink/45">
                      {plant.cultivar}
                      <span className="text-ink/30">
                        {" "}
                        · {plant.slotLabel} (r{plant.row}c{plant.column})
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-lg font-bold tabular-nums text-ink">
                      {plant.healthScore}%
                    </span>
                    <Badge tone={plantTone(plant.status)}>{plant.status}</Badge>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
        {plants.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-sm text-ink/45">No plants in this tray yet.</p>
            <p className="mt-2 text-xs text-ink/35">
              Use the form above to add plants manually, or{" "}
              <Link href={`/plants/new?trayId=${encodeURIComponent(tray.id)}`} className="font-semibold text-leaf">
                add from a photo
              </Link>
              .
            </p>
          </Card>
        )}
      </section>

      {/* Event log */}
      {events.length > 0 && (
        <section className="animate-fade-in">
          <SectionTitle>Event Log</SectionTitle>
          <Card className="divide-y divide-ink/5 p-0">
            {events.slice(0, 8).map((ev, i) => (
              <div key={ev.id} className={`flex items-start gap-3 px-4 py-3 ${i === 0 ? "rounded-t-3xl" : ""} ${i === Math.min(7, events.length - 1) ? "rounded-b-3xl" : ""}`}>
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
