export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionUser } from "@/lib/auth/session";
import { env, hasFirebaseAdminConfig } from "@/lib/config/env";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const user = await getSessionUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const initialMode = params.mode === "register" ? "register" : "sign-in";

  return (
    <main className="pb-12 pt-10 sm:pb-20 sm:pt-14">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 sm:px-6">
        <div className="text-center">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-ink transition-opacity hover:opacity-70"
          >
            AgriHome
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {initialMode === "register" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink/55">
            Sign in to manage your trays and plants, or create an account to get
            started.
          </p>
        </div>
        <LoginForm
          firebaseConfig={env.firebase.client}
          isServerConfigured={hasFirebaseAdminConfig}
          variant="playful"
          initialMode={initialMode}
        />
      </div>
    </main>
  );
}
