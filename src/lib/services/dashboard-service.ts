import { getLatestCameraCapture } from "@/lib/services/camera-service";
import { getMonitoringLog } from "@/lib/services/monitoring-service";
import { listPlantReports, listPlantsByTray } from "@/lib/services/plant-service";
import { getLatestPrediction } from "@/lib/services/prediction-service";
import { listSchedules } from "@/lib/services/schedule-service";
import { listMeshNetworks, listTraySystems } from "@/lib/services/topology-service";

export const getDashboardData = async (ownerEmail: string) => {
  const trays = await listTraySystems(ownerEmail);
  const selectedTrayId = trays[0]?.id;
  const [latestImage, latestPrediction, monitoringLog, meshes, plants, reports, schedules] =
    await Promise.all([
      getLatestCameraCapture(ownerEmail, selectedTrayId),
      getLatestPrediction(ownerEmail, selectedTrayId),
      getMonitoringLog({ ownerEmail, limit: 8, trayId: selectedTrayId }),
      listMeshNetworks(ownerEmail),
      listPlantsByTray(ownerEmail),
      listPlantReports({ ownerEmail, trayId: selectedTrayId, limit: 12 }),
      listSchedules({ ownerEmail })
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
