import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import { requireDeviceApiKey } from "@/lib/auth/device-auth";
import {
  claimEdgeCommand,
  completeEdgeCommand,
  listPendingCommandsForDevice
} from "@/lib/services/edge-command-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/raspberry-pi/commands — list pending commands for this device. */
export async function GET(request: Request) {
  const auth = await requireDeviceApiKey(request);
  if (auth instanceof Response) return auth;

  try {
    const commands = await listPendingCommandsForDevice(auth.id, 10);
    return NextResponse.json({ data: commands });
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}

/**
 * POST /api/raspberry-pi/commands
 * Body: { commandId, action: "claim" | "complete" | "fail", result?, errorMessage? }
 */
export async function POST(request: Request) {
  const auth = await requireDeviceApiKey(request);
  if (auth instanceof Response) return auth;

  try {
    const body = (await request.json()) as {
      commandId?: string;
      action?: "claim" | "complete" | "fail";
      result?: Record<string, unknown>;
      errorMessage?: string;
    };

    if (!body.commandId?.trim() || !body.action) {
      return apiErrorResponse(
        API_ERROR_CODES.BAD_REQUEST,
        "commandId and action are required",
        400
      );
    }

    if (body.action === "claim") {
      const cmd = await claimEdgeCommand(body.commandId, auth.id);
      if (!cmd) {
        return apiErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          "Command not found or already claimed",
          404
        );
      }
      return NextResponse.json({ data: cmd });
    }

    if (body.action === "complete" || body.action === "fail") {
      const cmd = await completeEdgeCommand({
        commandId: body.commandId,
        deviceId: auth.id,
        status: body.action === "complete" ? "completed" : "failed",
        result: body.result,
        errorMessage: body.errorMessage
      });
      if (!cmd) {
        return apiErrorResponse(
          API_ERROR_CODES.NOT_FOUND,
          "Command not found",
          404
        );
      }
      return NextResponse.json({ data: cmd });
    }

    return apiErrorResponse(
      API_ERROR_CODES.BAD_REQUEST,
      "action must be claim, complete, or fail",
      400
    );
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}
