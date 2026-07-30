export const dynamic = "force-dynamic";

import { requireSessionAccountUser } from "@/lib/auth/session";
import { getUserPreferences } from "@/lib/services/user-preferences-service";

import { PreferencesClient } from "./PreferencesClient";

export default async function SettingsPage() {
  const currentUser = await requireSessionAccountUser();
  const prefs =
    currentUser.email != null
      ? await getUserPreferences(currentUser.email)
      : { participateMlFeedback: true, developerMode: false };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink/50">Preferences for your account.</p>
      </div>
      <PreferencesClient
        initialParticipateMlFeedback={prefs.participateMlFeedback}
        initialDeveloperMode={prefs.developerMode}
      />
    </div>
  );
}
