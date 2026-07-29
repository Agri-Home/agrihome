export const dynamic = "force-dynamic";

import Link from "next/link";

import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { StatusDot } from "@/components/atoms/StatusDot";
import { SectionTitle } from "@/components/app/Section";
import { requireSessionAccountUser } from "@/lib/auth/session";
import { ClientChartFrame } from "@/components/charts/ClientChartFrame";
import { PlantImage } from "@/components/media/PlantImage";
import { TrayHealthBarChart } from "@/components/charts/TrayHealthBarChart";
import { getLatestCameraCapture } from "@/lib/services/camera-service";
import { getMonitoringLog } from "@/lib/services/monitoring-service";
import { listSchedules } from "@/lib/services/schedule-service";
import { listTraySystems, listMeshNetworks } from "@/lib/services/topology-service";
import { formatRelativeTimestamp, formatDateTime } from "@/lib/utils";

function trayTone(status: string) {
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "success" as const;
}

function trayStatusLabel(status: string) {
  if (status === "alert") return "Needs care";
  if (status === "watch") return "Watch";
  return "Looking good";
}

function trayDotStatus(status: string) {
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "healthy" as const;
}

function overallHealth(trays: Array<{ healthScore: number }>) {
  if (trays.length === 0) return 0;
  return Math.round(trays.reduce((s, t) => s + t.healthScore, 0) / trays.length);
}

function nextStepCopy(input: {
  trays: number;
  alertCount: number;
  watchCount: number;
}) {
  if (input.trays === 0) {
    return {
      title: "Add your first plant",
      detail: "Take a photo to identify a plant and start monitoring.",
      href: "/plants/new",
      cta: "Add a plant"
    };
  }
  if (input.alertCount > 0) {
    return {
      title: "Some trays need attention",
      detail: `${input.alertCount} tray${input.alertCount === 1 ? "" : "s"} look critical — open them to check the latest photos and notes.`,
      href: "/trays",
      cta: "Review trays"
    };
  }
  if (input.watchCount > 0) {
    return {
      title: "Keep an eye on a few trays",
      detail: `${input.watchCount} tray${input.watchCount === 1 ? "" : "s"} are on watch. A quick check usually helps.`,
      href: "/trays",
      cta: "Open trays"
    };
  }
  return {
    title: "Everything looks calm",
    detail: "Add a plant photo anytime, or open a tray to take a new picture.",
    href: "/plants/new",
    cta: "Add a plant"
  };
}

export default async function HomePage() {
  const currentUser = await requireSessionAccountUser();
  const trays = await listTraySystems(currentUser.email);
  const focusTray = trays[0];

  const [capture, monitoringLog, meshes, schedules] = await Promise.all([
    focusTray
      ? getLatestCameraCapture(currentUser.email, focusTray.id)
      : Promise.resolve(null),
    getMonitoringLog({ ownerEmail: currentUser.email, limit: 5 }),
    listMeshNetworks(currentUser.email),
    listSchedules({ ownerEmail: currentUser.email })
  ]);

  const health = overallHealth(trays);
  const alertCount = trays.filter((t) => t.status === "alert").length;
  const watchCount = trays.filter((t) => t.status === "watch").length;
  const activeSchedules = schedules.filter((s) => s.active);
  const lastWatering = activeSchedules[0]?.lastRunAt;
  const next = nextStepCopy({ trays: trays.length, alertCount, watchCount });
  const systemOk = alertCount === 0;

  return (
    <div className="space-y-6">
      <section className="animate-fade-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Home
            </h1>
            <p className="mt-0.5 text-sm text-ink/50">
              How your greenhouse is doing today
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-ink/5 backdrop-blur-sm">
            <StatusDot status={systemOk ? "healthy" : "critical"} pulse />
            <span className="text-ink/70">
              {systemOk ? "Looking good" : "Needs attention"}
            </span>
          </div>
        </div>

        <Card className="mt-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{next.title}</p>
            <p className="mt-0.5 text-sm text-ink/55">{next.detail}</p>
          </div>
          <Link
            href={next.href}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-leaf px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-leaf/90"
          >
            {next.cta}
          </Link>
        </Card>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="animate-fade-in stagger-1 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">
              Health
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
              {trays.length === 0 ? "—" : `${health}%`}
            </p>
            <p className="mt-0.5 text-xs text-ink/45">
              {trays.length === 0
                ? "No trays yet"
                : `Average across ${trays.length} tray${trays.length === 1 ? "" : "s"}`}
            </p>
          </Card>

          <Card className="animate-fade-in stagger-2 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">
              Trays
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
              {trays.length}
            </p>
            <p className="mt-0.5 text-xs text-ink/45">
              {meshes.length > 0
                ? `${meshes.length} group${meshes.length === 1 ? "" : "s"}`
                : "Ready to grow"}
            </p>
          </Card>

          <Card className="animate-fade-in stagger-3 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">
              Alerts
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
              {alertCount + watchCount}
            </p>
            <p className="mt-0.5 text-xs text-ink/45">
              {alertCount > 0
                ? `${alertCount} need care`
                : watchCount > 0
                  ? "On watch"
                  : "All clear"}
            </p>
          </Card>

          <Card className="animate-fade-in stagger-4 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">
              Watering
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
              {lastWatering ? formatRelativeTimestamp(lastWatering) : "—"}
            </p>
            <p className="mt-0.5 text-xs text-ink/45">
              {activeSchedules.length === 0
                ? "No schedule yet"
                : `${activeSchedules.length} active`}
            </p>
          </Card>
        </div>
      </section>

      {trays.length > 0 && (
        <section className="animate-fade-in stagger-2">
          <SectionTitle>Tray health</SectionTitle>
          <Card className="p-4">
            <ClientChartFrame
              skeleton={
                <div className="h-[220px] rounded-2xl bg-gradient-to-r from-lime/20 to-leaf/10 animate-pulse" />
              }
            >
              <TrayHealthBarChart
                items={trays.map((t) => ({ name: t.name, health: t.healthScore }))}
              />
            </ClientChartFrame>
          </Card>
        </section>
      )}

      {capture?.imageUrl && (
        <section className="animate-fade-in stagger-3">
          <SectionTitle>Latest photo</SectionTitle>
          <Link href={`/trays/${capture.trayId}`} className="block">
            <Card interactive className="overflow-hidden p-0">
              <div className="relative aspect-[16/10] w-full bg-mist">
                <PlantImage
                  src={capture.imageUrl}
                  alt="Latest greenhouse frame"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs font-medium text-white/70">
                        {capture.trayName}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-white">
                        {formatRelativeTimestamp(capture.capturedAt)}
                      </p>
                    </div>
                    <Badge tone="success" live>
                      Recent
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        </section>
      )}

      <section className="animate-fade-in stagger-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Your trays</SectionTitle>
          {trays.length > 4 && (
            <Link
              href="/trays"
              className="text-xs font-semibold text-leaf transition-colors hover:text-leaf/80"
            >
              View all
            </Link>
          )}
        </div>
        <ul className="flex flex-col gap-2">
          {trays.slice(0, 4).map((tray) => (
            <li key={tray.id}>
              <Link href={`/trays/${tray.id}`}>
                <Card
                  interactive
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <StatusDot
                      status={trayDotStatus(tray.status)}
                      pulse={tray.status === "alert"}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {tray.name}
                      </p>
                      <p className="truncate text-xs text-ink/45">
                        {tray.crop} · {tray.zone}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-lg font-bold tabular-nums text-ink">
                      {tray.healthScore}%
                    </span>
                    <Badge tone={trayTone(tray.status)}>
                      {trayStatusLabel(tray.status)}
                    </Badge>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>

        {trays.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-ink/50">No trays yet.</p>
            <Link
              href="/plants/new"
              className="mt-2 inline-block text-sm font-semibold text-leaf"
            >
              Add your first plant
            </Link>
          </Card>
        )}

        {trays.length > 0 && trays.length <= 4 && (
          <Link
            href="/trays"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-leaf transition-colors hover:text-leaf/80"
          >
            See all trays
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        )}
      </section>

      {monitoringLog.length > 0 && (
        <section className="animate-fade-in stagger-5">
          <SectionTitle>Recent activity</SectionTitle>
          <Card className="divide-y divide-ink/5 p-0">
            {monitoringLog.map((event, i) => (
              <div
                key={event.id}
                className={`flex items-start gap-3 px-5 py-3.5 ${i === 0 ? "rounded-t-3xl" : ""} ${i === monitoringLog.length - 1 ? "rounded-b-3xl" : ""}`}
              >
                <span
                  className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs ${
                    event.level === "critical"
                      ? "bg-rose-100 text-rose-600"
                      : event.level === "warning"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-emerald-100 text-emerald-600"
                  }`}
                >
                  {event.level === "critical" || event.level === "warning"
                    ? "!"
                    : "i"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink">
                      {event.title}
                    </p>
                    <p className="shrink-0 text-[11px] text-ink/40">
                      {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-ink/50">
                    {event.message}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
