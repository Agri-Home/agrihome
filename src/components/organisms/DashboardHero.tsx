import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { MetricTile } from "@/components/molecules/MetricTile";
import type {
  CameraCapture,
  MonitoringEvent,
  PredictionResult
} from "@/lib/types/domain";
import { clampPercent, formatRelativeTimestamp } from "@/lib/utils";

export function DashboardHero({
  latestImage,
  latestPrediction,
  monitoringLog
}: {
  latestImage: CameraCapture | null;
  latestPrediction: PredictionResult | null;
  monitoringLog: MonitoringEvent[];
}) {
  const latestEvent = monitoringLog[0];

  return (
    <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
      <Card className="overflow-hidden p-0">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <Badge tone="success">Hardware-ready monitoring stack</Badge>
            <h1 className="panel-title mt-5 text-5xl leading-none text-ink sm:text-6xl">
              Camera capture, recognition, and greenhouse telemetry in one
              operating surface.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink/70">
              Incoming frames move from hardware ingest to prediction and
              monitoring history through a single full-stack pipeline designed
              for MariaDB metadata and vector-backed image recognition.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-ink/70">
              <span className="rounded-full bg-white/70 px-4 py-2 ring-1 ring-ink/10">
                Camera module
              </span>
              <span className="rounded-full bg-white/70 px-4 py-2 ring-1 ring-ink/10">
                Ingest API
              </span>
              <span className="rounded-full bg-white/70 px-4 py-2 ring-1 ring-ink/10">
                MariaDB metadata
              </span>
              <span className="rounded-full bg-white/70 px-4 py-2 ring-1 ring-ink/10">
                Vector search
              </span>
              <span className="rounded-full bg-white/70 px-4 py-2 ring-1 ring-ink/10">
                Dashboard + GraphQL
              </span>
            </div>
          </div>
          <div className="rounded-[1.75rem] bg-ink p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
              Live snapshot
            </p>
            <div className="mt-5 space-y-5">
              <div>
                <p className="text-sm text-white/55">Latest frame</p>
                <p className="mt-1 text-xl font-semibold">
                  {latestImage?.capturedAt
                    ? formatRelativeTimestamp(latestImage.capturedAt)
                    : "No frame yet"}
                </p>
              </div>
              <div>
                <p className="text-sm text-white/55">Latest label</p>
                <p className="mt-1 text-xl font-semibold">
                  {latestPrediction?.label ?? "Pending analysis"}
                </p>
              </div>
              <div>
                <p className="text-sm text-white/55">Confidence</p>
                <p className="mt-1 text-xl font-semibold">
                  {latestPrediction
                    ? clampPercent(latestPrediction.confidence)
                    : "0%"}
                </p>
              </div>
              <div>
                <p className="text-sm text-white/55">Most recent event</p>
                <p className="mt-1 text-sm leading-6 text-white/80">
                  {latestEvent?.message ?? "No monitoring events recorded."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-1">
        <MetricTile
          label="Camera link"
          value={latestImage?.status === "available" ? "Online" : "Needs review"}
          detail={
            latestImage?.notes ?? "The dashboard will show a placeholder if no image is available."
          }
        />
        <MetricTile
          label="Inference state"
          value={latestPrediction?.severity ?? "queued"}
          detail={
            latestPrediction?.recommendation ??
            "Mock inference is active until the ML model is connected."
          }
        />
      </div>
    </section>
  );
}
