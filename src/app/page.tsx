export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";

import { LandingAbout } from "@/components/marketing/LandingAbout";
import { getSessionUser } from "@/lib/auth/session";
import {
  DETECTION_CLASSES,
  DETECTION_DATASET_SOURCES,
  getDetectionClassesByPlant
} from "@/lib/constants/detection-classes";

export default async function LandingPage() {
  const user = await getSessionUser();

  if (user) {
    redirect("/dashboard");
  }

  const detectionGroups = getDetectionClassesByPlant();
  const classCount = DETECTION_CLASSES.length;
  const datasetBlurb = `Trained on ${DETECTION_DATASET_SOURCES.map((s) => s.name).join(", ")} (${classCount} classes). PlantDoc maps onto PlantVillage labels; plant-leaf adds potato leafroll virus and tomato powdery mildew.`;

  return (
    <main className="relative flex min-h-[100dvh] flex-col overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(200,251,128,0.45),transparent_55%),radial-gradient(ellipse_70%_50%_at_100%_40%,rgba(61,159,108,0.22),transparent_50%),radial-gradient(ellipse_60%_45%_at_0%_80%,rgba(232,140,74,0.12),transparent_45%)]" />
        <div
          className="absolute inset-x-0 top-[40vh] h-[60vh] opacity-[0.14] sm:top-[35vh]"
          aria-hidden
        >
          <svg
            className="h-full w-full"
            viewBox="0 0 1200 640"
            preserveAspectRatio="xMidYMax slice"
            fill="none"
          >
            <path
              d="M0 640V420c80-40 160-90 240-70s140 90 220 70 160-110 260-90 180 100 280 70 140-90 200-60v300H0z"
              fill="#1a3d2e"
            />
            <path
              d="M180 640V380c40-70 90-120 140-90s70 130 130 110 100-100 160-70 90 120 150 95 110-85 160-50v265H180z"
              fill="#3d9f6c"
              opacity="0.55"
            />
            <g stroke="#0f1f17" strokeWidth="3" strokeLinecap="round" opacity="0.55">
              <path d="M320 640V280c20-90 70-140 110-100" />
              <path d="M430 220c-50 10-85 55-95 110" />
              <path d="M430 220c40 25 70 80 75 140" />
              <path d="M720 640V250c25-85 80-130 125-95" />
              <path d="M845 195c-55 15-90 60-100 120" />
              <path d="M845 195c45 20 80 75 90 145" />
            </g>
          </svg>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col px-6 sm:px-8">
        <header className="flex items-center justify-between pt-10 sm:pt-14">
          <p className="text-sm font-bold tracking-tight text-ink">AgriHome</p>
          <Link
            href="/login"
            className="rounded-2xl px-3 py-2 text-sm font-semibold text-ink/70 transition-colors hover:bg-ink/[0.05] hover:text-ink"
          >
            Sign in
          </Link>
        </header>

        <section className="flex min-h-[calc(100dvh-5.5rem)] flex-col items-center justify-center pb-16 text-center sm:pb-20">
          <p className="animate-fade-in text-5xl font-bold tracking-tight text-ink sm:text-6xl md:text-7xl">
            AgriHome
          </p>
          <h1 className="animate-fade-in stagger-1 mt-5 max-w-xl text-xl font-semibold tracking-tight text-ink/85 sm:text-2xl">
            Watch your trays grow, from capture to care.
          </h1>
          <p className="animate-fade-in stagger-2 mt-4 max-w-md text-sm leading-relaxed text-ink/55 sm:text-base">
            Monitor plants, schedule captures, and catch issues early — all in one
            calm console for your grow.
          </p>
          <div className="animate-fade-in stagger-3 mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-white shadow-lift transition-all duration-200 hover:bg-moss hover:shadow-glow active:scale-[0.97]"
            >
              Sign in
            </Link>
            <Link
              href="/login?mode=register"
              className="inline-flex items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-white/80 px-6 py-3 text-sm font-semibold text-ink backdrop-blur-sm transition-all duration-200 hover:border-leaf/40 hover:bg-white active:scale-[0.97]"
            >
              Create account
            </Link>
          </div>
        </section>

        <LandingAbout
          groups={detectionGroups}
          classCount={classCount}
          datasetBlurb={datasetBlurb}
        />
      </div>
    </main>
  );
}
