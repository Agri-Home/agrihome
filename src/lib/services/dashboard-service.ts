import { getLatestCameraCapture } from "@/lib/services/camera-service";
import { getMonitoringLog } from "@/lib/services/monitoring-service";
import { listPlantReports, listPlantsByTray } from "@/lib/services/plant-service";
import { getLatestPrediction } from "@/lib/services/prediction-service";
import { listSchedules } from "@/lib/services/schedule-service";
import { listMeshNetworks, listTraySystems } from "@/lib/services/topology-service";

export const getDashboardData = async () => {
  const trays = await listTraySystems();
  const selectedTrayId = trays[0]?.id;
  const [latestImage, latestPrediction, monitoringLog, meshes, plants, reports, schedules] =
    await Promise.all([
      getLatestCameraCapture(selectedTrayId),
      getLatestPrediction(selectedTrayId),
      getMonitoringLog(8, selectedTrayId),
      listMeshNetworks(),
      listPlantsByTray(),
      listPlantReports({ trayId: selectedTrayId, limit: 12 }),
      listSchedules()
    ]);

  return {
    latestImage,
    latestPrediction,
    monitoringLog,
    trays,
    meshes,
    plants,
    reports,
    schedules
  };
};
