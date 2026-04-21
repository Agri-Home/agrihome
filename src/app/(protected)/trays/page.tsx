export const dynamic = "force-dynamic";

import Link from "next/link";

import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { StatusDot } from "@/components/atoms/StatusDot";
import { SectionTitle } from "@/components/app/Section";
import { requireSessionAccountUser } from "@/lib/auth/session";
import { listTraySystems } from "@/lib/services/topology-service";

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

export default async function TraysIndexPage() {
  const currentUser = await requireSessionAccountUser();
  const trays = await listTraySystems(currentUser.email);
  const avgHealth =
    trays.length > 0
      ? Math.round(trays.reduce((s, t) => s + t.healthScore, 0) / trays.length)
      : 0;
  const alertCount = trays.filter((t) => t.status === "alert").length;
  const totalPlants = trays.reduce((s, t) => s + t.plantCount, 0);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Trays</h1>
          <p className="mt-0.5 text-sm text-ink/50">
            {trays.length} tray{trays.length === 1 ? "" : "s"} in your system
          </p>
        </div>
        <Link
          href="/trays/new"
          className="rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lift transition-colors hover:bg-moss"
        >
          Add tray
        </Link>
      </div>

      {trays.length > 0 && (
        <div className="animate-fade-in stagger-1 grid grid-cols-3 gap-3">
          <Card className="p-3.5 text-center">
            <p className="text-2xl font-bold text-ink">{avgHealth}%</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Avg Health</p>
          </Card>
          <Card className="p-3.5 text-center">
            <p className="text-2xl font-bold text-ink">{totalPlants}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Plants</p>
          </Card>
          <Card className={`p-3.5 text-center ${alertCount > 0 ? "ring-1 ring-rose-200" : ""}`}>
            <p className={`text-2xl font-bold ${alertCount > 0 ? "text-rose-600" : "text-ink"}`}>{alertCount}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Alerts</p>
          </Card>
        </div>
      )}

      <div className="animate-fade-in stagger-2">
        <SectionTitle>All Trays</SectionTitle>
        <ul className="flex flex-col gap-2.5">
          {trays.map((tray) => (
            <li key={tray.id}>
              <Link href={`/trays/${tray.id}`}>
                <Card interactive className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lime/25 to-leaf/15">
                    <span className="text-lg font-bold text-leaf">{tray.healthScore}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{tray.name}</p>
                      <StatusDot status={trayDotStatus(tray.status)} pulse={tray.status === "alert"} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink/45">
                      {tray.crop} · {tray.zone} · {tray.plantCount} plant{tray.plantCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge tone={trayTone(tray.status)}>{tray.status}</Badge>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink/25"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {trays.length === 0 && (
        <Card className="p-8 text-center animate-fade-in">
          <p className="text-sm text-ink/50">No trays configured yet.</p>
          <Link href="/trays/new" className="mt-3 inline-block text-sm font-semibold text-leaf">
            Create a tray
          </Link>
          <span className="mx-2 text-ink/25">·</span>
          <Link href="/plants/new" className="mt-3 inline-block text-sm font-semibold text-leaf/80">
            Add a plant (photo)
          </Link>
        </Card>
      )}
    </div>
  );
}
