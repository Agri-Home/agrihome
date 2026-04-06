import type { ReactNode } from "react";

import { Card } from "@/components/atoms/Card";
import { cn } from "@/lib/utils";

export function MetricTile({
  label,
  value,
  detail,
  icon,
  interactive = false,
  className
}: {
  label: string;
  value: string;
  detail: string;
  icon?: ReactNode;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <Card interactive={interactive} className={cn("rounded-[1.5rem] p-5", className)}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-moss/65">
          {label}
        </p>
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime/20 text-leaf">
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-ink">{value}</p>
      <p className="mt-1.5 text-sm text-ink/55">{detail}</p>
    </Card>
  );
}
