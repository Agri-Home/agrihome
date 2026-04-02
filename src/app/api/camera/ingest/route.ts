import { NextResponse } from "next/server";

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

  const capture = await ingestCameraCapture({
    trayId: payload.trayId,
    trayName: payload.trayName,
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
