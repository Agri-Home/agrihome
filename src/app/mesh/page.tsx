export const dynamic = "force-dynamic";

import Link from "next/link";

import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/app/Section";
import { listMeshNetworks, listTraySystems } from "@/lib/services/topology-service";

import { MeshCreateForm } from "./MeshCreateForm";

function meshTone(status: string) {
  return status === "active" ? ("success" as const) : ("default" as const);
}

export default async function MeshIndexPage() {
  const [meshes, trays] = await Promise.all([listMeshNetworks(), listTraySystems()]);

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">Mesh</h1>
      <p className="mt-0.5 text-sm text-ink/45">Group trays for shared monitoring.</p>

      <ul className="mt-5 flex flex-col gap-2">
        {meshes.map((mesh) => (
          <li key={mesh.id}>
            <Link href={`/mesh/${mesh.id}`}>
              <Card className="hover:border-leaf/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{mesh.name}</p>
                    <p className="mt-1 text-xs text-ink/45">{mesh.nodeCount} trays</p>
                  </div>
                  <Badge tone={meshTone(mesh.status)}>{mesh.status}</Badge>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {meshes.length === 0 ? <p className="mt-4 text-sm text-ink/45">No meshes yet.</p> : null}

      <MeshCreateForm trays={trays} />
    </div>
  );
}
