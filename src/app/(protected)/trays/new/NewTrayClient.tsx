"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import type { TraySystem } from "@/lib/types/domain";

export function NewTrayClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [zone, setZone] = useState("");
  const [crop, setCrop] = useState("");
  const [deviceId, setDeviceId] = useState("manual");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/trays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          zone: zone.trim(),
          crop: crop.trim(),
          deviceId: deviceId.trim() || "manual"
        })
      });
      const json = (await res.json()) as { data?: TraySystem; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not create tray");
      if (!json.data?.id) throw new Error("Invalid response");
      router.push(`/trays/${json.data.id}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Add a tray</h1>
        <p className="mt-1 text-sm text-ink/50">
          Create an empty tray, then add plants with positions and labels from the tray page.
        </p>
      </div>

      {err && (
        <div
          className="animate-fade-in rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100"
          role="alert"
        >
          {err}
        </div>
      )}

      <Card className="animate-fade-in stagger-1 p-5 space-y-4">
        <label className="block text-sm">
          <span className="text-xs font-medium text-ink/50">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
            maxLength={120}
            placeholder="e.g. Kitchen herbs"
            disabled={busy}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-ink/50">Zone / location</span>
          <input
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
            maxLength={120}
            placeholder="e.g. South window"
            disabled={busy}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-ink/50">Crop type</span>
          <input
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
            maxLength={120}
            placeholder="e.g. Lettuce, basil, microgreens"
            disabled={busy}
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-medium text-ink/50">Device ID (optional)</span>
          <input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 font-mono text-sm transition-colors focus:border-leaf focus:outline-none"
            maxLength={64}
            placeholder="manual"
            disabled={busy}
          />
          <span className="mt-1 block text-[11px] text-ink/35">
            Use &quot;manual&quot; for trays you manage only in the app.
          </span>
        </label>

        <Button
          type="button"
          className="w-full"
          disabled={busy || !name.trim() || !zone.trim() || !crop.trim()}
          onClick={() => void submit()}
        >
          {busy ? "Creating…" : "Create tray"}
        </Button>
      </Card>
    </div>
  );
}
