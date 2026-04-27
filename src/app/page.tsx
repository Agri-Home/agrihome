export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionUser } from "@/lib/auth/session";
import { env, hasFirebaseAdminConfig } from "@/lib/config/env";

export default async function LandingPage() {
  const user = await getSessionUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="pb-12 pt-10 sm:pb-20 sm:pt-14">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 sm:px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {env.appName}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink/55">
            Track trays and plants, capture photos, and review health insights in one
            place. Sign in to manage your grow or create an account to get started.
          </p>
        </div>
        <LoginForm
          firebaseConfig={env.firebase.client}
          isServerConfigured={hasFirebaseAdminConfig}
          variant="playful"
        />
      </div>
    </main>
  );
}
