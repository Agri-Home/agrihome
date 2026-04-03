import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("glass-panel rounded-3xl p-6 md:rounded-[1.85rem]", className)}>
      {children}
    </section>
  );
}
