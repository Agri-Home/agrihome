export const dynamic = "force-dynamic";

import { BackLink } from "@/components/app/BackLink";

import { NewTrayClient } from "./NewTrayClient";

export default function NewTrayPage() {
  return (
    <div className="space-y-4">
      <div className="animate-fade-in">
        <BackLink href="/trays">Trays</BackLink>
      </div>
      <NewTrayClient />
    </div>
  );
}
