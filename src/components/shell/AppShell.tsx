"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import type {
  AuthenticatedUser,
  FirebaseClientConfig
} from "@/lib/types/auth";

interface NavItem {
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon: (active: boolean) => ReactNode;
  isFab?: boolean;
}

function IconDashboard({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} />
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} />
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} />
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

function IconTrays({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill={active ? "currentColor" : "none"} />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function IconAddPlant() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconMesh({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2.5" fill={active ? "currentColor" : "none"} />
      <circle cx="5" cy="19" r="2.5" fill={active ? "currentColor" : "none"} />
      <circle cx="19" cy="19" r="2.5" fill={active ? "currentColor" : "none"} />
      <line x1="12" y1="7.5" x2="5" y2="16.5" />
      <line x1="12" y1="7.5" x2="19" y2="16.5" />
      <line x1="7.5" y1="19" x2="16.5" y2="19" />
    </svg>
  );
}

function IconSchedule({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" fill={active ? "currentColor" : "none"} />
      {active && <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" />}
      <polyline points="12 7 12 12 15.5 14" stroke={active ? "var(--canvas)" : "currentColor"} strokeWidth="2" />
    </svg>
  );
}

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    match: (p) => p === "/dashboard",
    icon: (active) => <IconDashboard active={active} />
  },
  {
    href: "/trays",
    label: "Trays",
    match: (p) =>
      (p.startsWith("/trays") || p.startsWith("/plants")) && !p.startsWith("/plants/new"),
    icon: (active) => <IconTrays active={active} />
  },
  {
    href: "/plants/new",
    label: "Add Plant",
    match: (p) => p.startsWith("/plants/new"),
    icon: () => <IconAddPlant />,
    isFab: true
  },
  {
    href: "/mesh",
    label: "Mesh",
    match: (p) => p.startsWith("/mesh"),
    icon: (active) => <IconMesh active={active} />
  },
  {
    href: "/schedule",
    label: "Schedule",
    match: (p) => p.startsWith("/schedule"),
    icon: (active) => <IconSchedule active={active} />
  }
];

export function AppShell({
  children,
  currentUser,
  firebaseConfig
}: {
  children: React.ReactNode;
  currentUser: AuthenticatedUser;
  firebaseConfig: FirebaseClientConfig;
}) {
  const pathname = usePathname();
  const identityLabel = currentUser.name ?? currentUser.email ?? "Operator";
  const identityInitial = identityLabel.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-1/4 top-0 h-[50vh] w-[70vw] rounded-full bg-lime/20 blur-[100px]" />
        <div className="absolute -right-1/4 top-1/4 h-[40vh] w-[60vw] rounded-full bg-leaf/15 blur-[90px]" />
        <div className="absolute bottom-0 left-1/3 h-[35vh] w-[50vw] rounded-full bg-ember/10 blur-[80px]" />
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col lg:max-w-6xl lg:flex-row lg:gap-0">
        {/* Desktop sidebar */}
        <aside className="hidden shrink-0 border-r border-leaf/10 bg-gradient-to-b from-ink via-moss to-[#0f2419] px-4 py-6 text-white lg:block lg:w-56">
          <div className="flex items-center gap-2 px-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f1f17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 20h10" />
                <path d="M10 20c5.5-2.5.8-6.4 3-10" />
                <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
                <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
              </svg>
            </div>
            <p className="text-sm font-bold tracking-tight text-white">AgriHome</p>
          </div>
          <nav className="mt-8 flex flex-col gap-1">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    active
                      ? "bg-lime text-ink shadow-[0_0_24px_rgba(200,251,128,0.35)]"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.icon(active)}
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-h-0 flex-1 px-4 pb-28 pt-3 safe-top lg:px-8 lg:pb-10 lg:pt-8">
          <div className="mb-5 flex items-center justify-end">
            <div className="flex items-center gap-3 rounded-2xl border border-ink/[0.08] bg-white/[0.78] px-3 py-2 shadow-sm backdrop-blur-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-lime to-[#a7e45f] text-sm font-bold text-ink">
                {identityInitial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">
                  {identityLabel}
                </p>
                {currentUser.email && (
                  <p className="truncate text-xs text-ink/45">
                    {currentUser.email}
                  </p>
                )}
              </div>
              <LogoutButton firebaseConfig={firebaseConfig} />
            </div>
          </div>
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-30 border-t border-leaf/10 bg-white/92 backdrop-blur-2xl lg:hidden" style={{ boxShadow: "0 -8px 40px rgba(15, 31, 23, 0.07)" }}>
        <div className="mx-auto flex max-w-lg items-end justify-around px-1 pb-1 pt-1.5">
          {NAV.map((item) => {
            const active = item.match(pathname);

            if (item.isFab) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative -mt-6 flex flex-col items-center"
                >
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-fab transition-all duration-200 active:scale-90 ${
                    active
                      ? "bg-leaf text-white"
                      : "bg-gradient-to-br from-leaf to-moss text-white"
                  }`}>
                    {item.icon(active)}
                  </span>
                  <span className={`mt-1 text-[10px] font-semibold ${active ? "text-leaf" : "text-ink/40"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex min-w-[4rem] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-all duration-200 ${
                  active ? "text-leaf" : "text-ink/40"
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200 ${
                  active ? "bg-lime/25 text-leaf" : "group-hover:bg-ink/5"
                }`}>
                  {item.icon(active)}
                </span>
                <span className={`text-[10px] font-semibold tracking-wide ${
                  active ? "text-leaf" : "text-ink/40"
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
