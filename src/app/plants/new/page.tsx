export const dynamic = "force-dynamic";

import { listTraySystems } from "@/lib/services/topology-service";

import { NewPlantClient } from "./NewPlantClient";

export default async function NewPlantPage() {
  const trays = await listTraySystems();
  return <NewPlantClient trays={trays} />;
}
