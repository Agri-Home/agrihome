import { NextResponse } from "next/server";

import { apiErrorResponse, API_ERROR_CODES, mapErrorToApiResponse } from "@/lib/api/api-error";
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
    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "Missing photo field (multipart image file)",
      400
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
    return mapErrorToApiResponse(e, "Analysis failed");
  }
}
