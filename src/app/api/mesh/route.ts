import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import {
  createMeshNetwork,
  listMeshNetworks
} from "@/lib/services/topology-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const data = await listMeshNetworks(authResult.email);

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

  try {
    const data = await createMeshNetwork({
      ownerEmail: authResult.email,
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create mesh";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
