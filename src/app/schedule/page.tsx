export const dynamic = "force-dynamic";

import { listSchedules } from "@/lib/services/schedule-service";
import { listMeshNetworks, listTraySystems } from "@/lib/services/topology-service";

import { ScheduleClient } from "./ScheduleClient";

export default async function SchedulePage() {
  const [schedules, trays, meshes] = await Promise.all([
    listSchedules(),
    listTraySystems(),
    listMeshNetworks()
  ]);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Capture Schedule</h1>
        <p className="mt-0.5 text-sm text-ink/50">Configure how often the camera sends frames for scoring.</p>
      </div>
      <ScheduleClient initialSchedules={schedules} trays={trays} meshes={meshes} />
    </div>
  );
}
