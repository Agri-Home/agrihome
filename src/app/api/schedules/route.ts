import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import { listSchedules, upsertSchedule } from "@/lib/services/schedule-service";
import type { CaptureSchedule } from "@/lib/types/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const { searchParams } = new URL(request.url);
  const scopeType =
    (searchParams.get("scopeType") as CaptureSchedule["scopeType"] | null) ??
    undefined;
  const scopeId = searchParams.get("scopeId") ?? undefined;
  const data = await listSchedules({
    ownerEmail: authResult.email,
    scopeType,
    scopeId
  });

  return NextResponse.json({
    data,
    count: data.length,
    refreshedAt: new Date().toISOString()
  });
}

export async function POST(request: Request) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

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

  try {
    const data = await upsertSchedule({
      ownerEmail: authResult.email,
      scopeType: payload.scopeType,
      scopeId: payload.scopeId,
      name: payload.name,
      intervalMinutes: payload.intervalMinutes,
      active: payload.active ?? true
    });

    return NextResponse.json({ data, message: "Schedule created" }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Schedule create failed";
    const status = msg === "Scope not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

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

  try {
    const data = await upsertSchedule({
      ownerEmail: authResult.email,
      id: payload.id,
      scopeType: payload.scopeType,
      scopeId: payload.scopeId,
      name: payload.name,
      intervalMinutes: payload.intervalMinutes,
      active: payload.active ?? true
    });

    return NextResponse.json({ data, message: "Schedule updated" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Schedule update failed";
    const status =
      msg === "Scope not found" || msg === "Schedule not found" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
