import { NextResponse } from "next/server";

import { listSchedules, upsertSchedule } from "@/lib/services/schedule-service";
import type { CaptureSchedule } from "@/lib/types/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scopeType =
    (searchParams.get("scopeType") as CaptureSchedule["scopeType"] | null) ??
    undefined;
  const scopeId = searchParams.get("scopeId") ?? undefined;
  const data = await listSchedules({ scopeType, scopeId });

  return NextResponse.json({
    data,
    count: data.length,
    refreshedAt: new Date().toISOString()
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    scopeType?: CaptureSchedule["scopeType"];
    scopeId?: string;
    name?: string;
    intervalMinutes?: number;
    active?: boolean;
  };

  if (
    !payload.scopeType ||
    !payload.scopeId ||
    !payload.name ||
    !payload.intervalMinutes
  ) {
    return NextResponse.json(
      {
        error: "scopeType, scopeId, name, and intervalMinutes are required"
      },
      { status: 400 }
    );
  }

  const data = await upsertSchedule({
    scopeType: payload.scopeType,
    scopeId: payload.scopeId,
    name: payload.name,
    intervalMinutes: payload.intervalMinutes,
    active: payload.active ?? true
  });

  return NextResponse.json({ data, message: "Schedule created" }, { status: 201 });
}

export async function PATCH(request: Request) {
  const payload = (await request.json()) as {
    id?: string;
    scopeType?: CaptureSchedule["scopeType"];
    scopeId?: string;
    name?: string;
    intervalMinutes?: number;
    active?: boolean;
  };

  if (
    !payload.id ||
    !payload.scopeType ||
    !payload.scopeId ||
    !payload.name ||
    !payload.intervalMinutes
  ) {
    return NextResponse.json(
      {
        error: "id, scopeType, scopeId, name, and intervalMinutes are required"
      },
      { status: 400 }
    );
  }

  const data = await upsertSchedule({
    id: payload.id,
    scopeType: payload.scopeType,
    scopeId: payload.scopeId,
    name: payload.name,
    intervalMinutes: payload.intervalMinutes,
    active: payload.active ?? true
  });

  return NextResponse.json({ data, message: "Schedule updated" });
}
