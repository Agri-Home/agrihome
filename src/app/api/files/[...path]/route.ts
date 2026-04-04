import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";

import {
  contentTypeForPath,
  resolveStorageFilePath
} from "@/lib/storage/resolve-file-path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  const absolute = resolveStorageFilePath(segments ?? []);

  if (!absolute) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [st, body] = await Promise.all([stat(absolute), readFile(absolute)]);
  const contentType = contentTypeForPath(absolute);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(st.size),
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
