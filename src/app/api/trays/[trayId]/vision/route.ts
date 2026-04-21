import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import {
  analyzeTrayImageForPlantInstances,
  persistTrayVisionResult
} from "@/lib/services/tray-vision-service";
import { getTrayById } from "@/lib/services/topology-service";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

export async function POST(
  request: Request,
  context: { params: Promise<{ trayId: string }> }
) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const { trayId } = await context.params;
  const tray = await getTrayById(authResult.email, trayId);
  if (!tray) {
    return NextResponse.json({ error: "Tray not found" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("photo");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing photo (multipart field: photo)" },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image too large (max 6MB)" }, { status: 400 });
  }
  if (buf.length === 0) {
    return NextResponse.json({ error: "Empty file" }, { status: 400 });
  }

  try {
    const vision = await analyzeTrayImageForPlantInstances(buf);
    await persistTrayVisionResult(trayId, vision);
    return NextResponse.json({
      data: {
        trayId,
        vision,
        recordedAt: new Date().toISOString()
      }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tray vision analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
