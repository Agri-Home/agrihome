import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "default" | "success" | "warning" | "critical";

const badgeToneClasses: Record<BadgeTone, string> = {
  default: "bg-mist/90 text-ink/80 ring-1 ring-ink/10",
  success: "bg-lime/35 text-moss ring-1 ring-leaf/25",
  warning: "bg-[#fff4e0] text-amber-900 ring-1 ring-amber-200/80",
  critical: "bg-[#ffe8ec] text-rose-900 ring-1 ring-rose-200/80"
};

export function Badge({
  children,
  tone = "default",
  className
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-transform duration-200",
        badgeToneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
