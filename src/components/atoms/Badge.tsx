import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "default" | "success" | "warning" | "critical";

const badgeToneClasses: Record<BadgeTone, string> = {
  default: "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80",
  success: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300/70",
  warning: "bg-amber-100 text-amber-800 ring-1 ring-amber-300/70",
  critical: "bg-rose-100 text-rose-800 ring-1 ring-rose-300/70"
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        badgeToneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
