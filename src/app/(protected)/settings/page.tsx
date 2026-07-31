export const dynamic = "force-dynamic";

import Link from "next/link";

import { Card } from "@/components/atoms/Card";
import { requireSessionAccountUser } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { getUserPreferences } from "@/lib/services/user-preferences-service";

import { AccountSettingsClient } from "./AccountSettingsClient";
import { PreferencesClient } from "./PreferencesClient";

const SETTINGS_LINKS = [
  {
    href: "/devices",
    label: "Raspberry Pi devices",
    description: "Review linked edge devices and registration state.",
  },
  {
    href: "/schedule",
    label: "Capture schedules",
    description: "Manage automatic tray and mesh capture routines.",
  },
  {
    href: "/feedback",
    label: "Training feedback",
    description: "Submit or review model feedback entry points.",
  },
] as const;

export default async function SettingsPage() {
  const currentUser = await requireSessionAccountUser();
  const prefs =
    currentUser.email != null
      ? await getUserPreferences(currentUser.email)
      : {
          displayName: null,
          participateMlFeedback: true,
          developerMode: false,
        };
  const displayName = prefs.displayName ?? currentUser.name ?? "";

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink/50">
          Preferences for your account.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <AccountSettingsClient
          email={currentUser.email}
          initialDisplayName={displayName}
          firebaseConfig={env.firebase.client}
        />
        <PreferencesClient
          initialParticipateMlFeedback={prefs.participateMlFeedback}
          initialDeveloperMode={prefs.developerMode}
        />
      </div>
      <Card className="space-y-3 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/40">
          Related settings
        </p>
        <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
          {SETTINGS_LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block px-3.5 py-3 transition-colors hover:bg-ink/[0.03]"
              >
                <p className="text-sm font-semibold text-ink">{item.label}</p>
                <p className="mt-0.5 text-xs text-ink/45">{item.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
