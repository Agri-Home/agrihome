export const dynamic = "force-dynamic";

import Link from "next/link";

import { Card } from "@/components/atoms/Card";
import { requireSessionAccountUser } from "@/lib/auth/session";
import { getParticipateMlFeedback } from "@/lib/services/user-preferences-service";

import { FeedbackIngestClient } from "./FeedbackIngestClient";

export default async function FeedbackPage() {
  const currentUser = await requireSessionAccountUser();
  const can =
    currentUser.email != null
      ? await getParticipateMlFeedback(currentUser.email)
      : true;

  if (!can) {
    return (
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Image & feedback
          </h1>
        </div>
        <Card className="p-5">
          <p className="text-sm text-ink/70">
            Model training feedback is turned off in your preferences. You can re-enable
            it to upload images and labels for model improvement.
          </p>
          <Link
            href="/settings"
            className="mt-3 inline-block text-sm font-semibold text-leaf hover:underline"
          >
            Open Settings → Preferences
          </Link>
        </Card>
      </div>
    );
  }

  return <FeedbackIngestClient />;
}
