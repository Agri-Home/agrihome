export const dynamic = "force-dynamic";

import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/atoms/Badge";
import { Card, SectionTitle } from "@/components/app/Section";
import { ClientChartFrame } from "@/components/charts/ClientChartFrame";
import { TrayHealthBarChart } from "@/components/charts/TrayHealthBarChart";
import { getLatestCameraCapture } from "@/lib/services/camera-service";
import { listTraySystems } from "@/lib/services/topology-service";
import { formatRelativeTimestamp } from "@/lib/utils";

function trayTone(status: string) {
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "success" as const;
}

export default async function HomePage() {
  const trays = await listTraySystems();
  const focusTray = trays[0];
  const capture = focusTray ? await getLatestCameraCapture(focusTray.id) : null;

  return (
    <div>
      <h1 className="bg-gradient-to-r from-moss via-leaf to-ember bg-clip-text text-xl font-bold tracking-tight text-transparent">
        Overview
      </h1>
      <p className="mt-0.5 text-sm text-ink/45">
        {trays.length} tray{trays.length === 1 ? "" : "s"}
      </p>

      {trays.length > 0 ? (
        <div className="mt-5">
          <ClientChartFrame
            skeleton={
              <div className="h-[260px] rounded-2xl bg-gradient-to-r from-lime/25 to-leaf/15 animate-pulse" />
            }
          >
            <TrayHealthBarChart
              items={trays.map((t) => ({ name: t.name, health: t.healthScore }))}
            />
          </ClientChartFrame>
        </div>
      ) : null}

      {capture?.imageUrl ? (
        <Link href={`/trays/${capture.trayId}`} className="mt-5 block">
          <Card className="overflow-hidden p-0">
            <div className="relative aspect-[5/4] w-full bg-mist">
              <Image
                src={capture.imageUrl}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <p className="px-3 py-2 text-xs text-ink/45">
              Latest frame · {capture.trayName} · {formatRelativeTimestamp(capture.capturedAt)}
            </p>
          </Card>
        </Link>
      ) : null}

      <div className="mt-8">
        <SectionTitle>Trays</SectionTitle>
      </div>
      <ul className="flex flex-col gap-2">
        {trays.slice(0, 4).map((tray) => (
          <li key={tray.id}>
            <Link href={`/trays/${tray.id}`}>
              <Card className="flex items-center justify-between gap-3 transition-colors hover:border-leaf/30">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{tray.name}</p>
                  <p className="truncate text-xs text-ink/45">
                    {tray.crop} · {tray.zone}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm tabular-nums text-ink/70">{tray.healthScore}%</span>
                  <Badge tone={trayTone(tray.status)}>{tray.status}</Badge>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {trays.length > 4 ? (
        <Link href="/trays" className="mt-4 inline-block text-sm font-medium text-leaf">
          All trays
        </Link>
      ) : trays.length ? (
        <Link href="/trays" className="mt-4 inline-block text-sm font-medium text-leaf">
          Open directory
        </Link>
      ) : null}
    </div>
  );
}
