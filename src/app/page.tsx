import { DashboardTemplate } from "@/components/templates/DashboardTemplate";
import { getLatestCameraCapture } from "@/lib/services/camera-service";
import { getMonitoringLog } from "@/lib/services/monitoring-service";
import { getLatestPrediction } from "@/lib/services/prediction-service";
import { listMeshNetworks, listTraySystems } from "@/lib/services/topology-service";

export default async function HomePage() {
  const trays = await listTraySystems();
  const selectedTrayId = trays[0]?.id;
  const [latestImage, latestPrediction, monitoringLog, meshes] = await Promise.all([
    getLatestCameraCapture(selectedTrayId),
    getLatestPrediction(selectedTrayId),
    getMonitoringLog(8, selectedTrayId),
    listMeshNetworks()
  ]);

  return (
    <DashboardTemplate
      initialLatestImage={latestImage}
      initialLatestPrediction={latestPrediction}
      initialMonitoringLog={monitoringLog}
      initialTrays={trays}
      initialMeshes={meshes}
    />
  );
}
