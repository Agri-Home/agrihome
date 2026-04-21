import { NextResponse } from "next/server";

import { queryRows } from "@/lib/db/postgres";
import { ingestCameraCapture } from "@/lib/services/camera-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    trayId?: string;
    trayName?: string;
    deviceId?: string;
    imageUrl?: string | null;
    capturedAt?: string;
    notes?: string;
  };

  if (!payload.deviceId || !payload.trayId) {
    return NextResponse.json(
      {
        error: "deviceId and trayId are required"
      },
      { status: 400 }
    );
  }

  const matchingTrays = await queryRows<{ name: string }>(
    `SELECT name
     FROM tray_systems
     WHERE id = $1 AND device_id = $2
     LIMIT 1`,
    [payload.trayId, payload.deviceId]
  );

  if (!matchingTrays[0]) {
    return NextResponse.json(
      { error: "Tray and device did not match" },
      { status: 403 }
    );
  }

  const capture = await ingestCameraCapture({
    trayId: payload.trayId,
    trayName: payload.trayName ?? matchingTrays[0].name,
    deviceId: payload.deviceId,
    imageUrl: payload.imageUrl ?? null,
    capturedAt: payload.capturedAt,
    notes: payload.notes
  });

  return NextResponse.json({
    message: "Camera frame accepted",
    data: capture
  });
}
