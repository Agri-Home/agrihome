import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import { createPlantFromPhotoWithAutoDetection } from "@/lib/services/plant-manual-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const form = await request.formData();
  const file = form.get("photo");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing photo (multipart field: photo)" },
      { status: 400 }
    );
  }

  const trayId = (form.get("trayId") as string | null)?.trim() || undefined;
  const displayName = (form.get("displayName") as string | null)?.trim() || undefined;
  const cultivarOverride =
    (form.get("cultivar") as string | null)?.trim() || undefined;

  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const data = await createPlantFromPhotoWithAutoDetection({
      ownerEmail: authResult.email,
      file: buf,
      mime: file.type,
      trayId,
      displayName,
      cultivarOverride
    });
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to process photo";
    const status =
      msg.includes("not found") || msg.includes("Use JPEG") || msg.includes("too large")
        ? 400
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
