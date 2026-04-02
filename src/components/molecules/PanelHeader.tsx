import type { ReactNode } from "react";

export function PanelHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-moss/70">
          {eyebrow}
        </p>
        <h2 className="panel-title mt-2 text-3xl text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink/65">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
