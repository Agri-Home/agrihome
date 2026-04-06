import { cn } from "@/lib/utils";

type StatusLevel = "healthy" | "warning" | "critical" | "offline";

const dotColor: Record<StatusLevel, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-rose-500",
  offline: "bg-ink/30"
};

export function StatusDot({
  status,
  pulse = false,
  size = "sm"
}: {
  status: StatusLevel;
  pulse?: boolean;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? "h-3 w-3" : "h-2 w-2";

  return (
    <span className={cn("relative inline-flex", dim)}>
      {pulse && status !== "offline" && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75 animate-live-pulse",
            dotColor[status]
          )}
        />
      )}
      <span className={cn("relative inline-flex rounded-full", dim, dotColor[status])} />
    </span>
  );
}
