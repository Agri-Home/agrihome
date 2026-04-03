export const dynamic = "force-dynamic";

import Link from "next/link";

import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/app/Section";
import { listTraySystems } from "@/lib/services/topology-service";

function trayTone(status: string) {
  if (status === "alert") return "critical" as const;
  if (status === "watch") return "warning" as const;
  return "success" as const;
}

export default async function TraysIndexPage() {
  const trays = await listTraySystems();

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">Trays</h1>
      <p className="mt-0.5 text-sm text-ink/45">{trays.length} total</p>

      <ul className="mt-5 flex flex-col gap-2">
        {trays.map((tray) => (
          <li key={tray.id}>
            <Link href={`/trays/${tray.id}`}>
              <Card className="flex items-center justify-between gap-3 hover:border-leaf/30">
                <div className="min-w-0">
                  <p className="truncate font-medium">{tray.name}</p>
                  <p className="truncate text-xs text-ink/45">
                    {tray.crop} · {tray.zone} · {tray.plantCount} plants
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm tabular-nums">{tray.healthScore}%</span>
                  <Badge tone={trayTone(tray.status)}>{tray.status}</Badge>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {trays.length === 0 ? <p className="mt-6 text-sm text-ink/45">No trays configured.</p> : null}
    </div>
  );
}
