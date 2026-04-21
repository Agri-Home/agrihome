export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { StatusDot } from "@/components/atoms/StatusDot";
import { SectionTitle } from "@/components/app/Section";
import { requireSessionAccountUser } from "@/lib/auth/session";
import { ClientChartFrame } from "@/components/charts/ClientChartFrame";
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
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "healthy" as const;
}

function overallHealth(trays: Array<{ healthScore: number }>) {
  if (trays.length === 0) return 0;
  return Math.round(trays.reduce((s, t) => s + t.healthScore, 0) / trays.length);
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

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <section className="animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">
              Dashboard
            </h1>
            <p className="mt-0.5 text-sm text-ink/50">
              Your greenhouse at a glance
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-ink/5 backdrop-blur-sm">
            <StatusDot status="healthy" pulse />
            <span className="text-ink/70">System online</span>
          </div>
        </div>

        {/* Quick stats strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="animate-fade-in stagger-1 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Health</p>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{health}%</p>
            <p className="mt-0.5 text-xs text-ink/45">Avg across {trays.length} trays</p>
          </Card>

          <Card className="animate-fade-in stagger-2 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime/25 text-leaf">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Trays</p>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{trays.length}</p>
            <p className="mt-0.5 text-xs text-ink/45">{meshes.length} mesh network{meshes.length === 1 ? "" : "s"}</p>
          </Card>

          <Card className="animate-fade-in stagger-3 p-4">
            <div className="flex items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${alertCount > 0 ? "bg-rose-100 text-rose-600" : watchCount > 0 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Alerts</p>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{alertCount + watchCount}</p>
            <p className="mt-0.5 text-xs text-ink/45">
              {alertCount > 0 ? `${alertCount} critical` : "All clear"}
            </p>
          </Card>

          <Card className="animate-fade-in stagger-4 p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" /></svg>
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/45">Watering</p>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
              {lastWatering ? formatRelativeTimestamp(lastWatering) : "—"}
            </p>
            <p className="mt-0.5 text-xs text-ink/45">
              {activeSchedules.length} active schedule{activeSchedules.length === 1 ? "" : "s"}
            </p>
          </Card>
        </div>
      </section>

      {/* Health chart */}
      {trays.length > 0 && (
        <section className="animate-fade-in stagger-2">
          <SectionTitle>Tray Health</SectionTitle>
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

      {/* Live camera preview */}
      {capture?.imageUrl && (
        <section className="animate-fade-in stagger-3">
          <SectionTitle>Live Camera</SectionTitle>
          <Link href={`/trays/${capture.trayId}`} className="block">
            <Card interactive className="overflow-hidden p-0">
              <div className="relative aspect-[16/10] w-full bg-mist">
                <Image
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
                    <Badge tone="success" live>Live</Badge>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        </section>
      )}

      {/* Trays list */}
      <section className="animate-fade-in stagger-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Trays</SectionTitle>
          {trays.length > 4 && (
            <Link href="/trays" className="text-xs font-semibold text-leaf hover:text-leaf/80 transition-colors">
              View all
            </Link>
          )}
        </div>
        <ul className="flex flex-col gap-2">
          {trays.slice(0, 4).map((tray) => (
            <li key={tray.id}>
              <Link href={`/trays/${tray.id}`}>
                <Card interactive className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusDot status={trayStatusLabel(tray.status)} pulse={tray.status === "alert"} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{tray.name}</p>
                      <p className="truncate text-xs text-ink/45">
                        {tray.crop} · {tray.zone}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-lg font-bold tabular-nums text-ink">{tray.healthScore}%</span>
                    <Badge tone={trayTone(tray.status)}>{tray.status}</Badge>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>

        {trays.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm text-ink/50">No trays configured yet.</p>
            <Link href="/plants/new" className="mt-2 inline-block text-sm font-semibold text-leaf">
              Add your first plant
            </Link>
          </Card>
        )}

        {trays.length > 0 && trays.length <= 4 && (
          <Link href="/trays" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-leaf transition-colors hover:text-leaf/80">
            Open directory
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        )}
      </section>

      {/* Recent activity */}
      {monitoringLog.length > 0 && (
        <section className="animate-fade-in stagger-5">
          <SectionTitle>Recent Activity</SectionTitle>
          <Card className="divide-y divide-ink/5 p-0">
            {monitoringLog.map((event, i) => (
              <div key={event.id} className={`flex items-start gap-3 px-5 py-3.5 ${i === 0 ? "rounded-t-3xl" : ""} ${i === monitoringLog.length - 1 ? "rounded-b-3xl" : ""}`}>
                <span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs ${
                  event.level === "critical"
                    ? "bg-rose-100 text-rose-600"
                    : event.level === "warning"
                      ? "bg-amber-100 text-amber-600"
                      : "bg-emerald-100 text-emerald-600"
                }`}>
                  {event.level === "critical" ? "!" : event.level === "warning" ? "!" : "i"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink">{event.title}</p>
                    <p className="shrink-0 text-[11px] text-ink/40">{formatDateTime(event.createdAt)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-ink/50 line-clamp-1">{event.message}</p>
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
