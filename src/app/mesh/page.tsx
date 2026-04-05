export const dynamic = "force-dynamic";

import Link from "next/link";

import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { StatusDot } from "@/components/atoms/StatusDot";
import { SectionTitle } from "@/components/app/Section";
import { listMeshNetworks, listTraySystems } from "@/lib/services/topology-service";

import { MeshCreateForm } from "./MeshCreateForm";

function meshTone(status: string) {
  return status === "active" ? ("success" as const) : ("default" as const);
}

export default async function MeshIndexPage() {
  const [meshes, trays] = await Promise.all([listMeshNetworks(), listTraySystems()]);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Mesh Networks</h1>
        <p className="mt-0.5 text-sm text-ink/50">Group trays for shared monitoring and scheduling.</p>
      </div>

      {meshes.length > 0 && (
        <div className="animate-fade-in stagger-1 grid grid-cols-2 gap-3">
          <Card className="p-3.5 text-center">
            <p className="text-2xl font-bold text-ink">{meshes.length}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Networks</p>
          </Card>
          <Card className="p-3.5 text-center">
            <p className="text-2xl font-bold text-ink">{meshes.reduce((s, m) => s + m.nodeCount, 0)}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Total Nodes</p>
          </Card>
        </div>
      )}

      <section className="animate-fade-in stagger-2">
        <SectionTitle>Networks</SectionTitle>
        <ul className="flex flex-col gap-2.5">
          {meshes.map((mesh) => (
            <li key={mesh.id}>
              <Link href={`/mesh/${mesh.id}`}>
                <Card interactive className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-lime/20 to-leaf/10">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-leaf">
                          <circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" />
                          <line x1="12" y1="7.5" x2="5" y2="16.5" /><line x1="12" y1="7.5" x2="19" y2="16.5" /><line x1="7.5" y1="19" x2="16.5" y2="19" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-ink">{mesh.name}</p>
                          <StatusDot status={mesh.status === "active" ? "healthy" : "offline"} pulse={mesh.status === "active"} />
                        </div>
                        <p className="mt-0.5 text-xs text-ink/45">{mesh.nodeCount} tray{mesh.nodeCount === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={meshTone(mesh.status)}>{mesh.status}</Badge>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink/25"><polyline points="9 18 15 12 9 6" /></svg>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>

        {meshes.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-sm text-ink/45">No mesh networks yet. Create one below.</p>
          </Card>
        )}
      </section>

      <section className="animate-fade-in stagger-3">
        <MeshCreateForm trays={trays} />
      </section>
    </div>
  );
}
