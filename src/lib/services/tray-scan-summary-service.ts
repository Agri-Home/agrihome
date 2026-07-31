import { queryRows } from "@/lib/db/postgres";
import { listTrayCapturesSince } from "@/lib/services/camera-service";
import { listPoseSequencesForTray } from "@/lib/services/capture-pose-service";

export type TrayScanPlantResult = {
  plantId: string | null;
  plantName: string | null;
  slotLabel: string | null;
  poseOrder: number | null;
  hingeDeg: number | null;
  motorMm: number | null;
  captureId: string | null;
  imageUrl: string | null;
  capturedAt: string | null;
  status: "ok" | "failed" | "pending" | "skipped";
  diagnosis: string | null;
  confidence: number | null;
  error: string | null;
};

export type TrayScanSummary = {
  trayId: string;
  since: string;
  durationMs: number | null;
  posesTotal: number | null;
  posesSucceeded: number | null;
  failedPoseOrders: number[];
  lastError: string | null;
  plants: TrayScanPlantResult[];
};

/**
 * Build a per-plant scan summary from captures since `sinceIso`, joined with
 * pose sequence expectations and latest plant_reports for those captures.
 */
export async function getTrayScanSummary(input: {
  ownerEmail: string;
  trayId: string;
  sinceIso: string;
  commandResult?: Record<string, unknown> | null;
  startedAtMs?: number;
}): Promise<TrayScanSummary> {
  const owner = input.ownerEmail.toLowerCase();
  const captures = await listTrayCapturesSince(owner, input.trayId, {
    sinceIso: input.sinceIso,
    limit: 200
  });

  const sequences = await listPoseSequencesForTray(owner, input.trayId);
  const active = sequences.find((s) => s.active) ?? sequences[0] ?? null;

  const reportByCapture = new Map<
    string,
    { diagnosis: string; confidence: number }
  >();
  const reportByPlant = new Map<
    string,
    { diagnosis: string; confidence: number; createdAt: string }
  >();

  const reportRows = await queryRows<{
    capture_id: string | null;
    plant_id: string;
    diagnosis: string;
    confidence: string | number;
    created_at: Date | string;
  }>(
    `SELECT pr.capture_id, pr.plant_id, pr.diagnosis, pr.confidence, pr.created_at
     FROM plant_reports pr
     INNER JOIN tray_systems t ON t.id = pr.tray_id
     WHERE t.owner_email = $1
       AND pr.tray_id = $2
       AND pr.created_at >= $3::timestamptz
     ORDER BY pr.created_at DESC`,
    [owner, input.trayId, input.sinceIso]
  );

  for (const row of reportRows) {
    const conf = Number(row.confidence);
    const entry = {
      diagnosis: row.diagnosis,
      confidence: Number.isFinite(conf) ? conf : 0
    };
    if (row.capture_id && !reportByCapture.has(row.capture_id)) {
      reportByCapture.set(row.capture_id, entry);
    }
    if (!reportByPlant.has(row.plant_id)) {
      reportByPlant.set(row.plant_id, {
        ...entry,
        createdAt: new Date(row.created_at).toISOString()
      });
    }
  }

  const plantMeta = await queryRows<{
    id: string;
    name: string;
    slot_label: string;
  }>(
    `SELECT id, name, slot_label
     FROM plants
     WHERE tray_id = $1 AND owner_email = $2`,
    [input.trayId, owner]
  );
  const metaById = new Map(plantMeta.map((p) => [p.id, p]));

  const capturedByPlant = new Map<string, (typeof captures)[number]>();
  const capturedByOrder = new Map<number, (typeof captures)[number]>();
  for (const c of captures) {
    if (c.plantId && !capturedByPlant.has(c.plantId)) {
      capturedByPlant.set(c.plantId, c);
    }
    if (c.poseOrder != null && !capturedByOrder.has(c.poseOrder)) {
      capturedByOrder.set(c.poseOrder, c);
    }
  }

  const failedOrders = Array.isArray(input.commandResult?.failedPoseOrders)
    ? (input.commandResult!.failedPoseOrders as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n))
    : [];
  const failedSet = new Set(failedOrders);
  const lastError =
    typeof input.commandResult?.lastError === "string"
      ? input.commandResult.lastError
      : null;

  const plants: TrayScanPlantResult[] = [];

  if (active && active.poses.length > 0) {
    for (const pose of active.poses) {
      const capture =
        (pose.plantId ? capturedByPlant.get(pose.plantId) : undefined) ??
        capturedByOrder.get(pose.poseOrder);
      const meta = pose.plantId ? metaById.get(pose.plantId) : undefined;
      const report = capture
        ? reportByCapture.get(capture.id) ??
          (capture.plantId ? reportByPlant.get(capture.plantId) : undefined)
        : pose.plantId
          ? reportByPlant.get(pose.plantId)
          : undefined;

      let status: TrayScanPlantResult["status"] = "pending";
      let error: string | null = null;
      if (failedSet.has(pose.poseOrder)) {
        status = "failed";
        error = lastError;
      } else if (capture) {
        status = "ok";
      } else if (failedOrders.length > 0 || lastError) {
        status = "skipped";
        error = lastError;
      }

      plants.push({
        plantId: pose.plantId,
        plantName: meta?.name ?? null,
        slotLabel: pose.slotLabel || meta?.slot_label || null,
        poseOrder: pose.poseOrder,
        hingeDeg: capture?.hingeDeg ?? pose.hingeDeg,
        motorMm: capture?.motorMm ?? pose.motorMm,
        captureId: capture?.id ?? null,
        imageUrl: capture?.imageUrl ?? null,
        capturedAt: capture?.capturedAt ?? null,
        status,
        diagnosis: report?.diagnosis ?? null,
        confidence: report?.confidence ?? null,
        error
      });
    }
  } else {
    for (const c of captures) {
      const meta = c.plantId ? metaById.get(c.plantId) : undefined;
      const report = reportByCapture.get(c.id) ??
        (c.plantId ? reportByPlant.get(c.plantId) : undefined);
      plants.push({
        plantId: c.plantId ?? null,
        plantName: meta?.name ?? null,
        slotLabel: meta?.slot_label ?? null,
        poseOrder: c.poseOrder ?? null,
        hingeDeg: c.hingeDeg ?? null,
        motorMm: c.motorMm ?? null,
        captureId: c.id,
        imageUrl: c.imageUrl,
        capturedAt: c.capturedAt,
        status: "ok",
        diagnosis: report?.diagnosis ?? null,
        confidence: report?.confidence ?? null,
        error: null
      });
    }
  }

  const posesSucceeded =
    typeof input.commandResult?.posesSucceeded === "number"
      ? input.commandResult.posesSucceeded
      : plants.filter((p) => p.status === "ok").length;
  const posesTotal =
    typeof input.commandResult?.posesTotal === "number"
      ? input.commandResult.posesTotal
      : active?.poses.length ?? plants.length;

  const durationMs =
    typeof input.commandResult?.durationMs === "number"
      ? input.commandResult.durationMs
      : input.startedAtMs != null
        ? Date.now() - input.startedAtMs
        : null;

  return {
    trayId: input.trayId,
    since: input.sinceIso,
    durationMs,
    posesTotal,
    posesSucceeded,
    failedPoseOrders: failedOrders,
    lastError,
    plants
  };
}
