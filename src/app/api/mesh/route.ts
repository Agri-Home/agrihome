import { NextResponse } from "next/server";

import {
  createMeshNetwork,
  listMeshNetworks
} from "@/lib/services/topology-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const data = await listMeshNetworks();

  return NextResponse.json({
    data,
    count: data.length,
    refreshedAt: new Date().toISOString()
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    name?: string;
    trayIds?: string[];
  };

  if (!payload.name || !payload.trayIds?.length || payload.trayIds.length < 2) {
    return NextResponse.json(
      {
        error: "name and at least two trayIds are required"
      },
      { status: 400 }
    );
  }

  const data = await createMeshNetwork({
    name: payload.name,
    trayIds: payload.trayIds
  });

  return NextResponse.json(
    {
      data,
      message: "Mesh created"
    },
    { status: 201 }
  );
}
