import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import { analyzePlantPhotoFromUpload } from "@/lib/services/plant-manual-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ plantId: string }> }
) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const { plantId } = await context.params;
  const form = await request.formData();
  const file = form.get("photo");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing photo field (multipart image file)" },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const data = await analyzePlantPhotoFromUpload(
      authResult.email,
      plantId,
      buf,
      file.type
    );
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analysis failed";
    const status =
      msg === "Plant not found"
        ? 404
        : msg.includes("too large") || msg.includes("Use JPEG")
          ? 400
          : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
