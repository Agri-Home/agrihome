export const dynamic = "force-dynamic";

import { requireSessionAccountUser } from "@/lib/auth/session";
import { getParticipateMlFeedback } from "@/lib/services/user-preferences-service";
import { listTraySystems } from "@/lib/services/topology-service";

import { NewPlantClient } from "./NewPlantClient";

export default async function NewPlantPage({
  searchParams
}: {
  searchParams: Promise<{ trayId?: string }>;
}) {
  const currentUser = await requireSessionAccountUser();
  const trays = await listTraySystems(currentUser.email);
  const { trayId: trayIdParam } = await searchParams;
  const showTrainingFeedback = currentUser.email
    ? await getParticipateMlFeedback(currentUser.email)
    : true;
  return (
    <NewPlantClient
      trays={trays}
      initialTrayId={trayIdParam}
      showTrainingFeedback={showTrainingFeedback}
    />
  );
}
