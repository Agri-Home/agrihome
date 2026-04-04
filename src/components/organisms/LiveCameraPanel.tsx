import Image from "next/image";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { PanelHeader } from "@/components/molecules/PanelHeader";
import type { CameraCapture } from "@/lib/types/domain";
import { formatDateTime, formatRelativeTimestamp } from "@/lib/utils";

export function LiveCameraPanel({
  latestImage,
  isRefreshing,
  autoRefreshEnabled,
  onRefresh,
  onToggleAutoRefresh,
  lastUpdatedAt
}: {
  latestImage: CameraCapture | null;
  isRefreshing: boolean;
  autoRefreshEnabled: boolean;
  onRefresh: () => void;
  onToggleAutoRefresh: () => void;
  lastUpdatedAt: string | null;
}) {
  const capture = latestImage;
  const hasImage = Boolean(capture?.imageUrl);

  return (
    <Card className="h-full">
      <PanelHeader
        eyebrow="Camera feed"
        title="Latest frame from the hardware camera path"
        description="Fetch the newest capture stored in PostgreSQL, refresh on demand, or leave auto-refresh on while the camera pipeline ingests frames."
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={onToggleAutoRefresh}>
              {autoRefreshEnabled ? "Auto-refresh on" : "Auto-refresh off"}
            </Button>
            <Button onClick={onRefresh} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Manual refresh"}
            </Button>
          </div>
        }
      />
      <div className="mt-6 overflow-hidden rounded-[1.75rem] bg-ink/95">
        {hasImage ? (
          <div className="relative aspect-[16/10]">
            <Image
              src={capture?.imageUrl as string}
              alt="Latest greenhouse capture"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 60vw"
              priority
            />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/75 to-transparent p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/55">
                  Device
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {capture?.deviceId}
                </p>
              </div>
              <Badge tone="success">
                Captured {formatRelativeTimestamp(capture?.capturedAt as string)}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="flex aspect-[16/10] flex-col items-center justify-center gap-4 px-8 text-center text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-white/45">
              No image available
            </p>
            <h3 className="panel-title text-4xl">Placeholder mode engaged</h3>
            <p className="max-w-lg text-sm leading-7 text-white/70">
              The backend returned no current frame. This panel remains stable
              while the camera module reconnects or the hardware ingest endpoint
              receives a new image.
            </p>
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-ink/60">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={hasImage ? "success" : "warning"}>
            {hasImage ? "Image available" : "Using placeholder"}
          </Badge>
          <span>
            Last backend refresh{" "}
            {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : "not fetched yet"}
          </span>
        </div>
        <span>
          Capture timestamp{" "}
          {latestImage?.capturedAt
            ? formatDateTime(latestImage.capturedAt)
            : "unavailable"}
        </span>
      </div>
    </Card>
  );
}
