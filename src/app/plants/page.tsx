import { DashboardTemplate } from "@/components/templates/DashboardTemplate";
import { getDashboardData } from "@/lib/services/dashboard-service";

export default async function PlantsPage() {
  const data = await getDashboardData();

  return (
    <DashboardTemplate
      activeTab="plants"
      initialLatestImage={data.latestImage}
      initialLatestPrediction={data.latestPrediction}
      initialMonitoringLog={data.monitoringLog}
      initialTrays={data.trays}
      initialMeshes={data.meshes}
      initialPlants={data.plants}
      initialReports={data.reports}
      initialSchedules={data.schedules}
    />
  );
}
