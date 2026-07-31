import { NextResponse } from "next/server";

import { requireApiAccountUser } from "@/lib/auth/session";
import {
  deleteMeshNetwork,
  updateMeshNetwork
} from "@/lib/services/topology-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ meshId: string }> }
) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const { meshId } = await context.params;
  const payload = (await request.json()) as {
    name?: string;
    trayIds?: string[];
  };

  if (!payload.name || !payload.trayIds || payload.trayIds.length < 2) {
    return NextResponse.json(
      { error: "name and at least two trayIds are required" },
      { status: 400 }
    );
  }

  try {
    const data = await updateMeshNetwork({
      ownerEmail: authResult.email,
      id: meshId,
      name: payload.name,
      trayIds: payload.trayIds
    });
    if (!data) {
      return NextResponse.json({ error: "Mesh not found" }, { status: 404 });
    }
    return NextResponse.json({ data, message: "Mesh updated" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Mesh update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ meshId: string }> }
) {
  const authResult = await requireApiAccountUser();
  if (authResult instanceof Response) {
    return authResult;
  }

  const { meshId } = await context.params;
  try {
    const deleted = await deleteMeshNetwork(authResult.email, meshId);
    if (!deleted) {
      return NextResponse.json({ error: "Mesh not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, message: "Mesh deleted" });
  } catch {
    return NextResponse.json({ error: "Mesh delete failed" }, { status: 400 });
  }
}
