"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { SectionTitle } from "@/components/app/Section";
import type { TraySystem } from "@/lib/types/domain";

export function MeshCreateForm({ trays }: { trays: TraySystem[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const submit = async () => {
    if (!name.trim() || selected.length < 2) {
      setMsg("Name and at least two trays required.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/mesh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), trayIds: selected })
      });
      const json = (await res.json()) as { data?: { id: string }; error?: string };
      if (!res.ok || !json.data) {
        setMsg(json.error ?? "Request failed.");
        return;
      }
      setName("");
      setSelected([]);
      router.refresh();
    } catch {
      setMsg("Request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SectionTitle>Create New Mesh</SectionTitle>
      <Card className="space-y-4 p-5">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink/40">Network Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
            placeholder="e.g. North rack"
          />
        </label>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink/40">Select Trays</p>
          <p className="mt-1 text-xs text-ink/30">Choose at least 2 trays to create a mesh</p>
          <ul className="mt-3 flex flex-col gap-1.5 max-h-56 overflow-y-auto">
            {trays.map((t) => {
              const isSelected = selected.includes(t.id);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => toggle(t.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all ${
                      isSelected
                        ? "border-leaf bg-lime/10 ring-1 ring-leaf/20"
                        : "border-ink/8 hover:border-ink/15 hover:bg-white/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-md text-xs transition-colors ${
                        isSelected ? "bg-leaf text-white" : "bg-ink/5 text-ink/30"
                      }`}>
                        {isSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                      </span>
                      <span className="font-medium">{t.name}</span>
                    </div>
                    <span className="text-xs text-ink/35">{t.crop}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {selected.length > 0 && (
          <p className="text-xs text-ink/40">
            {selected.length} tray{selected.length === 1 ? "" : "s"} selected
          </p>
        )}

        {msg && (
          <p className={`text-sm ${msg === "Request failed." ? "text-rose-600" : "text-ember"}`}>{msg}</p>
        )}

        <Button className="w-full" type="button" disabled={busy} onClick={() => void submit()}>
          {busy ? "Creating..." : "Create Mesh"}
        </Button>
      </Card>
    </div>
  );
}
