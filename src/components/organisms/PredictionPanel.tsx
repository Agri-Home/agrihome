import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { PanelHeader } from "@/components/molecules/PanelHeader";
import type { PredictionResult } from "@/lib/types/domain";
import { clampPercent, formatDateTime } from "@/lib/utils";

const toneForSeverity = (severity: PredictionResult["severity"]) => {
  if (severity === "high") {
    return "critical" as const;
  }

  if (severity === "medium") {
    return "warning" as const;
  }

  return "success" as const;
};

export function PredictionPanel({
  latestPrediction
}: {
  latestPrediction: PredictionResult | null;
}) {
  return (
    <Card className="h-full">
      <PanelHeader
        eyebrow="Prediction engine"
        title="Latest recognition result"
        description="Current output from the mock-ready inference service, enriched by vector similarity matches so the API contract is already aligned with future image recognition."
      />
      {latestPrediction ? (
        <div className="mt-6 space-y-6">
          <div className="rounded-[1.75rem] bg-ink p-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone={toneForSeverity(latestPrediction.severity)}>
                {latestPrediction.severity} severity
              </Badge>
              <p className="text-sm text-white/55">
                {formatDateTime(latestPrediction.createdAt)}
              </p>
            </div>
            <h3 className="panel-title mt-4 text-4xl">
              {latestPrediction.label}
            </h3>
            <p className="mt-4 text-sm leading-7 text-white/78">
              {latestPrediction.recommendation}
            </p>
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-sm text-white/70">
                <span>Confidence</span>
                <span>{clampPercent(latestPrediction.confidence)}</span>
              </div>
              <div className="h-3 rounded-full bg-white/15">
                <div
                  className="h-3 rounded-full bg-leaf"
                  style={{ width: clampPercent(latestPrediction.confidence) }}
                />
              </div>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-moss/65">
              Vector similarity references
            </p>
            <div className="mt-4 grid gap-3">
              {latestPrediction.similarMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between rounded-[1.4rem] bg-white/70 px-4 py-4 ring-1 ring-ink/8"
                >
                  <div>
                    <p className="font-semibold text-ink">{match.label}</p>
                    <p className="mt-1 text-sm text-ink/55">
                      {match.imageUrl ? "Image linked" : "Reference only"}
                    </p>
                  </div>
                  <Badge tone="default">{clampPercent(match.score)}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-[1.75rem] bg-white/70 p-6 text-sm text-ink/65 ring-1 ring-ink/8">
          No prediction result is available yet. The backend will return mock
          classification data until the real ML service is connected.
        </div>
      )}
    </Card>
  );
}
