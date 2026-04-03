"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/app/Section";
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
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/40">Saved</h2>
        <ul className="flex flex-col gap-2">
          {schedules.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm ${
                  selectedId === s.id ? "border-leaf bg-lime/10" : "border-ink/10 hover:border-ink/20"
                }`}
              >
                <span className="font-medium">{s.name}</span>
                <span className="mt-0.5 block text-xs text-ink/45">
                  Every {s.intervalMinutes} min · next {formatRelativeTimestamp(s.nextRunAt)}
                  {s.active ? "" : " · paused"}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {schedules.length === 0 ? <p className="text-sm text-ink/45">None yet.</p> : null}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/40">
          {selectedId ? "Edit" : "New"}
        </h2>
        <Card className="space-y-3">
          <div className="flex gap-1 rounded-lg bg-mist p-1">
            {(["tray", "mesh"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setScopeType(t)}
                className={`flex-1 rounded-md py-2 text-xs font-semibold capitalize ${
                  scopeType === t ? "bg-white shadow-sm" : "text-ink/45"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <label className="block text-sm">
            <span className="text-ink/50">Target</span>
            <select
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-leaf"
            >
              {targets.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-ink/50">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-leaf"
            />
          </label>

          <label className="block text-sm">
            <span className="text-ink/50">Interval (minutes)</span>
            <input
              type="number"
              min={5}
              step={5}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-leaf"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded accent-leaf"
            />
            Active
          </label>

          {msg ? <p className="text-sm text-ink/55">{msg}</p> : null}

          <Button className="w-full" type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </Button>

          {selectedId ? (
            <button
              type="button"
              className="w-full text-sm text-ink/45 hover:text-ink"
              onClick={() => {
                setSelectedId(null);
                setMsg(null);
              }}
            >
              Clear selection
            </button>
          ) : null}
        </Card>
      </section>

      <p className="text-xs text-ink/35">
        Images post to: {schedules[0]?.destination ?? "computer-vision-backend"}
      </p>
    </div>
  );
}
