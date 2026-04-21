import { Badge } from "@/components/atoms/Badge";
import { Card } from "@/components/atoms/Card";
import { StatusDot } from "@/components/atoms/StatusDot";
import { cn } from "@/lib/utils";

const trays = [
  { name: "Basil North", crop: "Basil", zone: "Zone A", health: 97, status: "healthy" as const },
  { name: "Tomato East", crop: "Tomato", zone: "Zone B", health: 91, status: "healthy" as const },
  { name: "Lettuce South", crop: "Lettuce", zone: "Zone C", health: 78, status: "warning" as const }
];

const events = [
  {
    title: "Basil tray: report saved",
    message: "Manual reading logged for Basil North.",
    tone: "success" as const,
    time: "2 min ago"
  },
  {
    title: "Tomato East: moisture low",
    message: "Below set range for Zone B.",
    tone: "warning" as const,
    time: "9 min ago"
  },
  {
    title: "Capture schedule",
    message: "Morning run finished for active trays.",
    tone: "default" as const,
    time: "16 min ago"
  }
];

export function OperationsPreview({
  compact = false
}: {
  compact?: boolean;
}) {
  return (
    <Card className="animate-fade-in overflow-hidden p-0">
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(200,251,128,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(61,159,108,0.1),transparent_30%)]" />
        <div className="mesh-grid animate-grid-pan absolute inset-0 opacity-[0.08]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime/80 to-transparent animate-gradient-shift" />

        <div
          className={cn(
            "relative z-10 grid gap-4 p-5 sm:p-6",
            compact ? "lg:grid-cols-1" : "lg:grid-cols-[1.12fr_0.88fr]"
          )}
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone="success">Preview</Badge>
                <h3 className="mt-4 text-2xl font-bold tracking-tight text-ink">
                  Console overview
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-ink/52">
                  Sample layout. Your trays and readings appear here after sign-in.
                </p>
              </div>

              <div className="hidden items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink/65 shadow-sm ring-1 ring-ink/5 backdrop-blur-sm sm:flex">
                <StatusDot status="healthy" pulse />
                Demo
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Health", "94%", "Tray average"],
                ["Trays", "24", "Four zones"],
                ["Alerts", "3", "Open items"],
                ["Schedules", "8", "Capture runs"]
              ].map(([label, value, detail], index) => (
                <div
                  key={label}
                  className={cn(
                    "animate-fade-in rounded-2xl border border-white/70 bg-white/78 p-4 shadow-sm backdrop-blur-xl",
                    index === 1 ? "stagger-1" : index === 2 ? "stagger-2" : index === 3 ? "stagger-3" : ""
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/40">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-ink">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-ink/45">{detail}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[1.75rem] border border-ink/6 bg-white/78 p-4 shadow-sm backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-leaf">
                  Tray Status
                </p>
                <span className="text-xs text-ink/45">Sample</span>
              </div>

              <div className="space-y-2.5">
                {trays.map((tray) => (
                  <div
                    key={tray.name}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-ink/5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <StatusDot
                        status={
                          tray.status === "healthy" ? "healthy" : "warning"
                        }
                        pulse={tray.status !== "healthy"}
                        size="md"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {tray.name}
                        </p>
                        <p className="truncate text-xs text-ink/45">
                          {tray.crop} · {tray.zone}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-bold text-ink">
                        {tray.health}%
                      </span>
                      <Badge
                        tone={tray.status === "healthy" ? "success" : "warning"}
                      >
                        {tray.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[1.85rem] bg-ink p-5 text-white shadow-[0_18px_56px_rgba(15,31,23,0.18)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/55">
                Snapshot
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <div>
                  <p className="text-sm text-white/50">Last capture</p>
                  <p className="mt-1 text-xl font-semibold">1 min ago</p>
                </div>
                <div>
                  <p className="text-sm text-white/50">Next capture</p>
                  <p className="mt-1 text-xl font-semibold">6:00</p>
                </div>
                <div>
                  <p className="text-sm text-white/50">Tomato East</p>
                  <p className="mt-1 text-xl font-semibold">OK</p>
                </div>
                <div className="rounded-2xl bg-white/8 px-4 py-3">
                  <p className="text-sm text-white/55">Note</p>
                  <p className="mt-1 text-sm leading-6 text-white/82">
                    Check irrigation on the south row before the evening run.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-ink/6 bg-white/78 p-4 shadow-sm backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-leaf">
                  Recent Activity
                </p>
                <span className="text-xs text-ink/45">Recent</span>
              </div>

              <div className="space-y-2.5">
                {events.map((event, index) => (
                  <div
                    key={event.title}
                    className={cn(
                      "animate-fade-in rounded-2xl bg-white/85 px-4 py-3 ring-1 ring-ink/5",
                      index === 1 ? "stagger-1" : index === 2 ? "stagger-2" : ""
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-2.5 w-2.5 rounded-full",
                              event.tone === "success"
                                ? "bg-emerald-500"
                                : event.tone === "warning"
                                  ? "bg-amber-500"
                                  : "bg-ink/30"
                            )}
                          />
                          <p className="truncate text-sm font-semibold text-ink">
                            {event.title}
                          </p>
                        </div>
                        <p className="mt-1 text-xs leading-6 text-ink/50">
                          {event.message}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11px] text-ink/40">
                        {event.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
