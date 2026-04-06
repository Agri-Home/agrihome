import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "default" | "success" | "warning" | "critical";

const badgeToneClasses: Record<BadgeTone, string> = {
  default: "bg-mist/90 text-ink/80 ring-1 ring-ink/10",
  success: "bg-lime/35 text-moss ring-1 ring-leaf/25",
  warning: "bg-[#fff4e0] text-amber-900 ring-1 ring-amber-200/80",
  critical: "bg-[#ffe8ec] text-rose-900 ring-1 ring-rose-200/80"
};

const dotColor: Record<BadgeTone, string> = {
  default: "bg-ink/40",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500"
};

export function Badge({
  children,
  tone = "default",
  className,
  live = false
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  live?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-transform duration-200",
        badgeToneClasses[tone],
        className
      )}
    >
      {live && (
        <span className="relative flex h-2 w-2">
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-live-pulse", dotColor[tone])} />
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", dotColor[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}
