import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import { requireDeviceApiKey } from "@/lib/auth/device-auth";
import { env } from "@/lib/config/env";
import {
  listPendingCommandsForDevice,
  claimEdgeCommand
} from "@/lib/services/edge-command-service";
import { updateDeviceHeartbeat } from "@/lib/services/edge-device-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/raspberry-pi/heartbeat
 * Auth: X-Agrihome-Device-Key
 * Updates last_heartbeat_at / status and optionally syncs actuator limits.
 * Returns pending capture commands for the agent to execute.
 */
export async function POST(request: Request) {
  const auth = await requireDeviceApiKey(request);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      status?: "online" | "offline" | "error";
      hingeMinDeg?: number;
      hingeMaxDeg?: number;
      motorMinMm?: number;
      motorMaxMm?: number;
      moonrakerUrl?: string;
      claimCommands?: boolean;
    };

    const device = await updateDeviceHeartbeat({
      deviceId: auth.id,
      status: body.status,
      hingeMinDeg: body.hingeMinDeg,
      hingeMaxDeg: body.hingeMaxDeg,
      motorMinMm: body.motorMinMm,
      motorMaxMm: body.motorMaxMm,
      moonrakerUrl: body.moonrakerUrl
    });

    if (!device) {
      return apiErrorResponse(
        API_ERROR_CODES.NOT_FOUND,
        "Device not found or revoked",
        404
      );
    }

    let commands = await listPendingCommandsForDevice(auth.id, 5);
    if (body.claimCommands !== false) {
      const claimed = [];
      for (const cmd of commands) {
        const c = await claimEdgeCommand(cmd.id, auth.id);
        if (c) claimed.push(c);
      }
      commands = claimed;
    }

    return NextResponse.json({
      message: "Heartbeat recorded",
      data: {
        deviceId: device.id,
        status: device.status,
        lastHeartbeatAt: device.lastHeartbeatAt,
        staleAfterMinutes: env.device.heartbeatStaleMinutes,
        actuatorLimits: {
          hingeMinDeg: device.hingeMinDeg,
          hingeMaxDeg: device.hingeMaxDeg,
          motorMinMm: device.motorMinMm,
          motorMaxMm: device.motorMaxMm
        },
        commands: commands.map((c) => ({
          id: c.id,
          type: c.commandType,
          trayId: c.trayId,
          plantId: c.plantId,
          payload: c.payload,
          createdAt: c.createdAt
        }))
      }
    });
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}
