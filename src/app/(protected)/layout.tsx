import { AppShell } from "@/components/shell/AppShell";
import { requireSessionAccountUser } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { getUserPreferences } from "@/lib/services/user-preferences-service";

export default async function ProtectedLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await requireSessionAccountUser();
  const prefs = await getUserPreferences(currentUser.email);
  const shellUser = {
    ...currentUser,
    name: prefs.displayName ?? currentUser.name
  };

  return (
    <AppShell
      currentUser={shellUser}
      firebaseConfig={env.firebase.client}
      participateMlFeedback={prefs.participateMlFeedback}
    >
      {children}
    </AppShell>
  );
}
