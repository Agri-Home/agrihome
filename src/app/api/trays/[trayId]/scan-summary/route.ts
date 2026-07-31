import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import { API_ERROR_CODES, apiErrorResponse } from "@/lib/api/api-error";
import { getTrayById } from "@/lib/services/topology-service";
import { getTrayScanSummary } from "@/lib/services/tray-scan-summary-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/trays/[trayId]/scan-summary?since=<ISO>
 * Optional: commandResult is not passed via query; client merges command poll
 * result client-side, or pass posesSucceeded etc. as query params if needed.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ trayId: string }> }
) {
  const auth = await requireApiAccountUser();
  if (auth instanceof Response) return auth;

  const { trayId } = await params;
  const tray = await getTrayById(auth.email, trayId);
  if (!tray) {
    return apiErrorResponse(API_ERROR_CODES.NOT_FOUND, "Tray not found", 404);
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since")?.trim();
  if (!since || Number.isNaN(Date.parse(since))) {
    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "since (ISO timestamp) is required",
      400
    );
  }

  const startedAtMsRaw = searchParams.get("startedAtMs");
  const startedAtMs = startedAtMsRaw ? Number(startedAtMsRaw) : undefined;

  const commandResultRaw = searchParams.get("commandResult");
  let commandResult: Record<string, unknown> | null = null;
  if (commandResultRaw) {
    try {
      commandResult = JSON.parse(commandResultRaw) as Record<string, unknown>;
    } catch {
      commandResult = null;
    }
  }

  const data = await getTrayScanSummary({
    ownerEmail: auth.email,
    trayId,
    sinceIso: new Date(since).toISOString(),
    commandResult,
    startedAtMs:
      startedAtMs != null && Number.isFinite(startedAtMs)
        ? startedAtMs
        : undefined
  });

  return NextResponse.json({ data, refreshedAt: new Date().toISOString() });
}
