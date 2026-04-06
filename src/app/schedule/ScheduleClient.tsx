"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { StatusDot } from "@/components/atoms/StatusDot";
import { SectionTitle } from "@/components/app/Section";
import type { CaptureSchedule, MeshNetwork, TraySystem } from "@/lib/types/domain";
import { formatRelativeTimestamp } from "@/lib/utils";

type Api<T> = { data: T; error?: string };

export function ScheduleClient({
  initialSchedules,
  trays,
  meshes
}: {
  initialSchedules: CaptureSchedule[];
  trays: TraySystem[];
  meshes: MeshNetwork[];
}) {
  const router = useRouter();
  const [schedules, setSchedules] = useState(initialSchedules);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scopeType, setScopeType] = useState<CaptureSchedule["scopeType"]>("tray");
  const [scopeId, setScopeId] = useState("");
  const [name, setName] = useState("");
  const [interval, setInterval] = useState("120");
  const [active, setActive] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSchedules(initialSchedules);
  }, [initialSchedules]);

  useEffect(() => {
    const sel = schedules.find((s) => s.id === selectedId);
    if (sel) {
      setScopeType(sel.scopeType);
      setScopeId(sel.scopeId);
      setName(sel.name);
      setInterval(String(sel.intervalMinutes));
      setActive(sel.active);
      return;
    }
    setScopeType("tray");
    setScopeId(trays[0]?.id ?? meshes[0]?.id ?? "");
    setName(trays[0] ? `${trays[0].name} capture` : "");
    setInterval("120");
    setActive(true);
  }, [selectedId, schedules, trays, meshes]);

  useEffect(() => {
    if (selectedId) return;
    if (scopeType === "tray") {
      setScopeId(trays[0]?.id ?? "");
      setName(trays[0] ? `${trays[0].name} capture` : "");
    } else {
      setScopeId(meshes[0]?.id ?? "");
      setName(meshes[0] ? `${meshes[0].name} capture` : "");
    }
  }, [scopeType, selectedId, trays, meshes]);

  const save = async () => {
    if (!scopeId || !name.trim()) {
      setMsg("Pick a target and enter a name.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/schedules", {
        method: selectedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId ?? undefined,
          scopeType,
          scopeId,
          name: name.trim(),
          intervalMinutes: Number(interval),
          active
        })
      });
      const json = (await res.json()) as Api<CaptureSchedule>;
      if (!res.ok || !json.data) {
        setMsg(json.error ?? "Save failed.");
        return;
      }
      setSchedules((cur) => {
        const exists = cur.some((x) => x.id === json.data.id);
        return exists
          ? cur.map((x) => (x.id === json.data.id ? json.data : x))
          : [json.data, ...cur];
      });
      setSelectedId(json.data.id);
      setMsg("Saved.");
      router.refresh();
    } catch {
      setMsg("Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const targets = scopeType === "tray" ? trays : meshes;

  return (
    <div className="space-y-6">
      {/* Saved schedules */}
      <section className="animate-fade-in stagger-1">
        <SectionTitle>Saved Schedules</SectionTitle>
        {schedules.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {schedules.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                  className="w-full text-left"
                >
                  <Card
                    interactive
                    className={`flex items-center justify-between p-4 ${
                      selectedId === s.id ? "ring-2 ring-leaf/30" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <StatusDot status={s.active ? "healthy" : "offline"} pulse={s.active} size="md" />
                      <div>
                        <p className="text-sm font-semibold text-ink">{s.name}</p>
                        <p className="mt-0.5 text-xs text-ink/40">
                          Every {s.intervalMinutes} min · next {formatRelativeTimestamp(s.nextRunAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={s.active ? "success" : "default"}>
                        {s.active ? "Active" : "Paused"}
                      </Badge>
                      {selectedId === s.id && (
                        <span className="text-[10px] font-semibold text-leaf">editing</span>
                      )}
                    </div>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-sm text-ink/45">No schedules yet. Create one below.</p>
          </Card>
        )}
      </section>

      {/* Form */}
      <section className="animate-fade-in stagger-2">
        <SectionTitle>{selectedId ? "Edit Schedule" : "New Schedule"}</SectionTitle>
        <Card className="space-y-4 p-5">
          {/* Scope toggle */}
          <div className="flex gap-1 rounded-xl bg-mist/80 p-1">
            {(["tray", "mesh"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setScopeType(t)}
                className={`flex-1 rounded-lg py-2.5 text-xs font-semibold capitalize transition-all ${
                  scopeType === t
                    ? "bg-white text-ink shadow-sm"
                    : "text-ink/40 hover:text-ink/60"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">Target</span>
            <select
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
            >
              {targets.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">Interval (minutes)</span>
            <input
              type="number"
              min={5}
              step={5}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
            />
          </label>

          <label className="flex items-center gap-3 rounded-xl bg-mist/40 px-4 py-3">
            <div className={`relative flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${active ? "bg-leaf" : "bg-ink/15"}`}>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="peer absolute inset-0 cursor-pointer opacity-0"
              />
              <span className={`absolute h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${active ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm font-medium text-ink/70">
              {active ? "Schedule active" : "Schedule paused"}
            </span>
          </label>

          {msg && (
            <p className={`text-sm ${msg === "Saved." ? "text-emerald-600" : "text-rose-600"}`}>
              {msg}
            </p>
          )}

          <Button className="w-full" type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving..." : selectedId ? "Update Schedule" : "Create Schedule"}
          </Button>

          {selectedId && (
            <button
              type="button"
              className="w-full rounded-xl py-2 text-sm font-medium text-ink/40 transition-colors hover:text-ink/60"
              onClick={() => {
                setSelectedId(null);
                setMsg(null);
              }}
            >
              Clear selection
            </button>
          )}
        </Card>
      </section>

      <p className="text-xs text-ink/25">
        Destination: {schedules[0]?.destination ?? "computer-vision-backend"}
      </p>
    </div>
  );
}
