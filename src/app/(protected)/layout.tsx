import { AppShell } from "@/components/shell/AppShell";
import { requireSessionAccountUser } from "@/lib/auth/session";
import { env } from "@/lib/config/env";

export default async function ProtectedLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await requireSessionAccountUser();

  return (
    <AppShell currentUser={currentUser} firebaseConfig={env.firebase.client}>
      {children}
    </AppShell>
  );
}
