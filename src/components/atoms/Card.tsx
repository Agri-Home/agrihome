import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  interactive = false
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <section
      className={cn(
        interactive ? "glass-panel-interactive" : "glass-panel",
        "rounded-3xl p-6 md:rounded-[1.85rem]",
        className
      )}
    >
      {children}
    </section>
  );
}
