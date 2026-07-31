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

const SCAN_INTERVAL_PRESETS = [
  { label: "Every 6 hours", minutes: 360 },
  { label: "Every 12 hours", minutes: 720 },
  { label: "Daily", minutes: 1440 },
  { label: "Every 2 hours", minutes: 120 },
  { label: "Custom…", minutes: -1 }
] as const;

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
  const [interval, setInterval] = useState("360");
  const [intervalPreset, setIntervalPreset] = useState(360);
  const [active, setActive] = useState(true);
  const [destination, setDestination] =
    useState<CaptureSchedule["destination"]>("raspberry-pi-edge");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CaptureSchedule | null>(
    null
  );

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
      const presetMatch = SCAN_INTERVAL_PRESETS.find(
        (p) => p.minutes === sel.intervalMinutes
      );
      setIntervalPreset(presetMatch ? sel.intervalMinutes : -1);
      setActive(sel.active);
      setDestination(sel.destination);
      return;
    }
    setScopeType("tray");
    setScopeId(trays[0]?.id ?? meshes[0]?.id ?? "");
    setName(trays[0] ? `${trays[0].name} plant scan` : "");
    setInterval("360");
    setIntervalPreset(360);
    setActive(true);
    setDestination("raspberry-pi-edge");
  }, [selectedId, schedules, trays, meshes]);

  useEffect(() => {
    if (selectedId) return;
    if (scopeType === "tray") {
      setScopeId(trays[0]?.id ?? "");
      setName(trays[0] ? `${trays[0].name} plant scan` : "");
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
    const mins = Number(interval);
    if (!Number.isFinite(mins) || mins < 5) {
      setMsg("Interval must be at least 5 minutes.");
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
          intervalMinutes: mins,
          active,
          destination
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

  const remove = async (schedule: CaptureSchedule) => {
    setDeletingId(schedule.id);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/schedules?id=${encodeURIComponent(schedule.id)}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(json.error ?? "Delete failed.");
        return;
      }
      setSchedules((cur) => cur.filter((s) => s.id !== schedule.id));
      if (selectedId === schedule.id) {
        setSelectedId(null);
      }
      setPendingDelete(null);
      setMsg("Deleted.");
      router.refresh();
    } catch {
      setMsg("Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  const targets = scopeType === "tray" ? trays : meshes;
  const selectedSchedule = schedules.find((s) => s.id === selectedId) ?? null;
  const edgeTraySchedules = schedules.filter(
    (s) =>
      s.scopeType === "tray" && s.destination === "raspberry-pi-edge"
  );

  return (
    <div className="space-y-6">
      <section className="animate-fade-in stagger-1">
        <SectionTitle>Automatic tray scan</SectionTitle>
        <Card className="space-y-3 p-5">
          <p className="text-sm text-ink/60">
            Queue a recurring pose walk on a linked Raspberry Pi (same as Scan
            all plants). Pick a tray, choose{" "}
            <span className="font-medium text-ink/80">Raspberry Pi edge</span>,
            set an interval, and enable the schedule.
          </p>
          {edgeTraySchedules.length > 0 ? (
            <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10">
              {edgeTraySchedules.map((s) => {
                const tray = trays.find((t) => t.id === s.scopeId);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-ink/[0.03]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {s.name}
                        </p>
                        <p className="text-xs text-ink/40">
                          {tray?.name ?? s.scopeId} · every {s.intervalMinutes}{" "}
                          min · next {formatRelativeTimestamp(s.nextRunAt)}
                        </p>
                      </div>
                      <Badge tone={s.active ? "success" : "default"}>
                        {s.active ? "Active" : "Paused"}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-ink/45">
              No automatic tray scans yet. Create one below with destination
              Raspberry Pi edge.
            </p>
          )}
        </Card>
      </section>

      {/* Saved schedules */}
      <section className="animate-fade-in stagger-1">
        <SectionTitle>Saved Schedules</SectionTitle>
        {schedules.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {schedules.map((s) => (
              <li key={s.id}>
                <Card
                  interactive
                  className={`flex items-center justify-between gap-3 p-4 ${
                    selectedId === s.id ? "ring-2 ring-leaf/30" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <StatusDot status={s.active ? "healthy" : "offline"} pulse={s.active} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                      <p className="mt-0.5 text-xs text-ink/40">
                        Every {s.intervalMinutes} min · {s.destination} · next{" "}
                        {formatRelativeTimestamp(s.nextRunAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={s.active ? "success" : "default"}>
                      {s.active ? "Active" : "Paused"}
                    </Badge>
                    {selectedId === s.id && (
                      <span className="text-[10px] font-semibold text-leaf">editing</span>
                    )}
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink/50 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                      onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                    >
                      {selectedId === s.id ? "Close" : "Edit"}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                      disabled={deletingId === s.id || busy}
                      onClick={() => setPendingDelete(s)}
                    >
                      {deletingId === s.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </Card>
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
            <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">
              Interval
            </span>
            <select
              value={intervalPreset}
              onChange={(e) => {
                const next = Number(e.target.value);
                setIntervalPreset(next);
                if (next > 0) setInterval(String(next));
              }}
              className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
            >
              {SCAN_INTERVAL_PRESETS.map((p) => (
                <option key={p.label} value={p.minutes}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {intervalPreset < 0 ? (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">
                Interval (minutes)
              </span>
              <input
                type="number"
                min={5}
                step={5}
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">
              Destination
            </span>
            <select
              value={destination}
              onChange={(e) =>
                setDestination(e.target.value as CaptureSchedule["destination"])
              }
              className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
            >
              <option value="raspberry-pi-edge">
                Raspberry Pi edge (automatic tray scan)
              </option>
              <option value="computer-vision-backend">
                Computer vision backend
              </option>
            </select>
          </label>

          {destination === "raspberry-pi-edge" && scopeType === "tray" ? (
            <p className="rounded-xl bg-mist/50 px-3 py-2 text-xs text-ink/50">
              This schedule queues the tray pose walk on the linked Pi (requires
              the capture schedule runner cron).
            </p>
          ) : null}

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
            <p className={`text-sm ${msg === "Saved." || msg === "Deleted." ? "text-emerald-600" : "text-rose-600"}`}>
              {msg}
            </p>
          )}

          <Button className="w-full" type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving..." : selectedId ? "Update Schedule" : "Create Schedule"}
          </Button>

          {selectedSchedule ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl py-2 text-sm font-medium text-ink/40 transition-colors hover:text-ink/60"
                onClick={() => {
                  setSelectedId(null);
                  setMsg(null);
                }}
              >
                Clear selection
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                disabled={deletingId === selectedSchedule.id || busy}
                onClick={() => setPendingDelete(selectedSchedule)}
              >
                {deletingId === selectedSchedule.id
                  ? "Deleting..."
                  : "Delete schedule"}
              </button>
            </div>
          ) : null}
        </Card>
      </section>

      <p className="text-xs text-ink/40">
        Edge schedules need the capture schedule runner on the host, e.g.{" "}
        <span className="font-mono">
          * * * * * cd /path/to/agrihome && npm run capture:schedule-runner
        </span>
        . See docs/ops/RASPBERRY_PI_KLIPPER.md.
      </p>

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!deletingId) setPendingDelete(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-schedule-dialog-title"
            className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-5 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              id="delete-schedule-dialog-title"
              className="text-sm font-semibold text-ink"
            >
              Delete this schedule?
            </p>
            <p className="mt-2 text-sm text-ink/60">
              This permanently removes{" "}
              <span className="font-semibold text-ink">
                {pendingDelete.name}
              </span>
              . This cannot be undone.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-rose-600 hover:bg-rose-700"
                disabled={deletingId === pendingDelete.id || busy}
                onClick={() => void remove(pendingDelete)}
              >
                {deletingId === pendingDelete.id
                  ? "Deleting..."
                  : "Delete schedule"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={deletingId === pendingDelete.id}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
