import { AppShell } from "@/components/shell/AppShell";
import { requireSessionAccountUser } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { getParticipateMlFeedback } from "@/lib/services/user-preferences-service";

export default async function ProtectedLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await requireSessionAccountUser();
  const participateMlFeedback = currentUser.email
    ? await getParticipateMlFeedback(currentUser.email)
    : true;

  return (
    <AppShell
      currentUser={currentUser}
      firebaseConfig={env.firebase.client}
      participateMlFeedback={participateMlFeedback}
    >
      {children}
    </AppShell>
  );
}
