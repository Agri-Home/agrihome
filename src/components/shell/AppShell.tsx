"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: Array<{ href: string; label: string; match: (path: string) => boolean }> = [
  { href: "/", label: "Home", match: (p) => p === "/" },
  {
    href: "/trays",
    label: "Trays",
    match: (p) =>
      (p.startsWith("/trays") || p.startsWith("/plants")) && !p.startsWith("/plants/new")
  },
  {
    href: "/plants/new",
    label: "Add plant",
    match: (p) => p.startsWith("/plants/new")
  },
  { href: "/mesh", label: "Mesh", match: (p) => p.startsWith("/mesh") },
  { href: "/schedule", label: "Schedule", match: (p) => p.startsWith("/schedule") }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-1/4 top-0 h-[50vh] w-[70vw] rounded-full bg-lime/20 blur-[100px]" />
        <div className="absolute -right-1/4 top-1/4 h-[40vh] w-[60vw] rounded-full bg-leaf/15 blur-[90px]" />
        <div className="absolute bottom-0 left-1/3 h-[35vh] w-[50vw] rounded-full bg-ember/10 blur-[80px]" />
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col lg:max-w-6xl lg:flex-row lg:gap-0">
        <aside className="hidden shrink-0 border-r border-leaf/10 bg-gradient-to-b from-ink via-moss to-[#0f2419] px-4 py-6 text-white lg:block lg:w-56">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime/90">AgriHome</p>
          <nav className="mt-6 flex flex-col gap-1.5">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${
                    active
                      ? "bg-lime text-ink shadow-[0_0_24px_rgba(200,251,128,0.35)]"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-h-0 flex-1 px-4 pb-24 pt-3 safe-top lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-10 border-t border-leaf/20 bg-white/90 px-2 py-2 shadow-[0_-12px_40px_rgba(61,159,108,0.12)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg justify-around">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`min-w-[4.25rem] rounded-xl px-2 py-2 text-center text-xs font-bold transition-colors ${
                  active
                    ? "text-leaf [text-shadow:0_0_12px_rgba(61,159,108,0.5)]"
                    : "text-ink/40"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
