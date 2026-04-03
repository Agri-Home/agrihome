"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/app/Section";
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
    <section className="mt-8">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink/40">New mesh</h2>
      <Card className="space-y-3">
        <label className="block text-sm">
          <span className="text-ink/50">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-leaf"
            placeholder="e.g. North rack"
          />
        </label>
        <p className="text-xs text-ink/40">Select trays</p>
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {trays.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => toggle(t.id)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                  selected.includes(t.id)
                    ? "border-leaf bg-lime/15"
                    : "border-ink/10 hover:border-ink/20"
                }`}
              >
                <span>{t.name}</span>
                <span className="text-xs text-ink/40">{t.crop}</span>
              </button>
            </li>
          ))}
        </ul>
        {msg ? <p className="text-sm text-ember">{msg}</p> : null}
        <Button className="w-full" type="button" disabled={busy} onClick={() => void submit()}>
          {busy ? "Saving…" : "Create"}
        </Button>
      </Card>
    </section>
  );
}
