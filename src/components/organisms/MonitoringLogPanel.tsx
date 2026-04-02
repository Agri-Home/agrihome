import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { PanelHeader } from "@/components/molecules/PanelHeader";
import type { MonitoringEvent } from "@/lib/types/domain";
import { formatDateTime } from "@/lib/utils";

const toneForLevel = (level: MonitoringEvent["level"]) => {
  if (level === "critical") {
    return "critical" as const;
  }

  if (level === "warning") {
    return "warning" as const;
  }

  return "success" as const;
};

export function MonitoringLogPanel({
  monitoringLog
}: {
  monitoringLog: MonitoringEvent[];
}) {
  return (
    <Card>
      <PanelHeader
        eyebrow="History"
        title="Monitoring log"
        description="Operational history from the camera simulator, prediction flow, and greenhouse alert states."
      />
      <div className="mt-6 space-y-3">
        {monitoringLog.length ? (
          monitoringLog.map((event) => (
            <article
              key={event.id}
              className="rounded-[1.5rem] bg-white/75 px-5 py-4 ring-1 ring-ink/8"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Badge tone={toneForLevel(event.level)}>{event.level}</Badge>
                  <p className="text-base font-semibold text-ink">
                    {event.title}
                  </p>
                </div>
                <p className="text-sm text-ink/50">
                  {formatDateTime(event.createdAt)}
                </p>
              </div>
              <p className="mt-3 text-sm leading-7 text-ink/68">
                {event.message}
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-[1.5rem] bg-white/75 px-5 py-5 text-sm text-ink/65 ring-1 ring-ink/8">
            No monitoring events yet.
          </div>
        )}
      </div>
    </Card>
  );
}
