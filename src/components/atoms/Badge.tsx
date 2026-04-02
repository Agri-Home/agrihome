import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BadgeTone = "default" | "success" | "warning" | "critical";

const badgeToneClasses: Record<BadgeTone, string> = {
  default: "bg-gray-100 text-gray-800 ring-1 ring-gray-200",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/50",
  critical: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/50"
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
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors",
        badgeToneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
