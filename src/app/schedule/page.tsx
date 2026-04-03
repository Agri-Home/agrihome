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
    <div>
      <h1 className="text-lg font-semibold text-ink">Capture schedule</h1>
      <p className="mt-0.5 text-sm text-ink/45">How often the camera sends a frame for scoring.</p>
      <ScheduleClient initialSchedules={schedules} trays={trays} meshes={meshes} />
    </div>
  );
}
