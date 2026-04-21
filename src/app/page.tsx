export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { OperationsPreview } from "@/components/marketing/OperationsPreview";
import { getSessionUser } from "@/lib/auth/session";
import { env, hasFirebaseAdminConfig } from "@/lib/config/env";

export default async function LandingPage() {
  const user = await getSessionUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="pb-12 pt-8 sm:pb-16 sm:pt-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:gap-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-10 lg:px-8">
        <section className="min-w-0">
          <OperationsPreview compact />
        </section>
        <section className="flex justify-center lg:justify-end">
          <LoginForm
            firebaseConfig={env.firebase.client}
            isServerConfigured={hasFirebaseAdminConfig}
            variant="playful"
          />
        </section>
      </div>
    </main>
  );
}
