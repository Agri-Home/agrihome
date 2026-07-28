import { NextResponse } from "next/server";

import {
  apiErrorResponse,
  API_ERROR_CODES,
  mapErrorToApiResponse
} from "@/lib/api/api-error";
import { requireApiAccountUser } from "@/lib/auth/session";
import {
  generatePosesFromPlantLayout,
  listPoseSequencesForTray,
  updateDeviceActuatorLimits,
  upsertPlantPosePosition,
  upsertPoseSequence
} from "@/lib/services/capture-pose-service";
import { getTrayById } from "@/lib/services/topology-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/trays/[trayId]/poses */
export async function GET(
  _request: Request,
  context: { params: Promise<{ trayId: string }> }
) {
  const auth = await requireApiAccountUser();
  if (auth instanceof Response) return auth;
  const { trayId } = await context.params;

  try {
    const tray = await getTrayById(auth.email, trayId);
    if (!tray) {
      return apiErrorResponse(API_ERROR_CODES.NOT_FOUND, "Tray not found", 404);
    }
    const sequences = await listPoseSequencesForTray(auth.email, trayId);
    return NextResponse.json({ data: sequences });
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}

/**
 * POST /api/trays/[trayId]/poses
 * Body: { name, poses[], generateFromLayout?, upsertPlantPose?, plantId?,
 *         hingeDeg?, motorMm?, deviceId?, actuatorLimits? }
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ trayId: string }> }
) {
  const auth = await requireApiAccountUser();
  if (auth instanceof Response) return auth;
  const { trayId } = await context.params;

  try {
    const tray = await getTrayById(auth.email, trayId);
    if (!tray) {
      return apiErrorResponse(API_ERROR_CODES.NOT_FOUND, "Tray not found", 404);
    }

    const body = (await request.json()) as {
      name?: string;
      deviceId?: string;
      generateFromLayout?: boolean;
      upsertPlantPose?: boolean;
      plantId?: string;
      hingeDeg?: number;
      motorMm?: number;
      sequenceId?: string;
      poses?: Array<{
        poseOrder: number;
        slotLabel?: string;
        row?: number;
        column?: number;
        plantId?: string | null;
        hingeDeg: number;
        motorMm: number;
        dwellMs?: number;
      }>;
      actuatorLimits?: {
        hingeMinDeg?: number;
        hingeMaxDeg?: number;
        motorMinMm?: number;
        motorMaxMm?: number;
      };
    };

    const deviceId = body.deviceId ?? tray.edgeDeviceId ?? undefined;

    if (body.actuatorLimits && deviceId) {
      await updateDeviceActuatorLimits({
        ownerEmail: auth.email,
        deviceId,
        ...body.actuatorLimits
      });
    }

    if (body.upsertPlantPose) {
      if (!body.plantId?.trim()) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "plantId is required to save a plant pose",
          400
        );
      }
      if (
        body.hingeDeg == null ||
        !Number.isFinite(body.hingeDeg) ||
        body.motorMm == null ||
        !Number.isFinite(body.motorMm)
      ) {
        return apiErrorResponse(
          API_ERROR_CODES.BAD_REQUEST,
          "hingeDeg and motorMm are required",
          400
        );
      }
      const sequence = await upsertPlantPosePosition({
        ownerEmail: auth.email,
        trayId,
        plantId: body.plantId.trim(),
        hingeDeg: body.hingeDeg,
        motorMm: body.motorMm,
        deviceId
      });
      return NextResponse.json({
        data: sequence,
        message: "Plant pose position saved"
      });
    }

    const sequence = body.generateFromLayout
      ? await generatePosesFromPlantLayout({
          ownerEmail: auth.email,
          trayId,
          deviceId,
          name: body.name
        })
      : await upsertPoseSequence({
          ownerEmail: auth.email,
          trayId,
          deviceId,
          name: body.name ?? "Capture poses",
          sequenceId: body.sequenceId,
          poses: body.poses ?? []
        });

    return NextResponse.json({ data: sequence });
  } catch (error) {
    return mapErrorToApiResponse(error);
  }
}
