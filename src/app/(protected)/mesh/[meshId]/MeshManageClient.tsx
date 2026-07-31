"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import type { MeshNetwork, TraySystem } from "@/lib/types/domain";

export function MeshManageClient({
  mesh,
  trays
}: {
  mesh: MeshNetwork;
  trays: TraySystem[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState(mesh.name);
  const [selected, setSelected] = useState(mesh.trayIds);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleTray(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  }

  function reset() {
    setName(mesh.name);
    setSelected(mesh.trayIds);
    setErr(null);
    setEditing(false);
  }

  async function save() {
    if (!name.trim() || selected.length < 2) {
      setErr("Name and at least two trays are required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/mesh/${encodeURIComponent(mesh.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), trayIds: selected })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not update mesh");
      }
      setEditing(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/mesh/${encodeURIComponent(mesh.id)}`, {
        method: "DELETE"
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not delete mesh");
      }
      router.push("/mesh");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Mesh settings</p>
            <p className="mt-0.5 text-xs text-ink/40">
              Edit the mesh name and which trays belong to this group.
            </p>
          </div>
          {!editing ? (
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-2 text-xs"
              onClick={() => {
                setErr(null);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          ) : null}
        </div>

        {err ? (
          <p className="text-sm text-rose-600" role="alert">
            {err}
          </p>
        ) : null}

        {!editing ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-ink/50">Name</dt>
              <dd className="mt-0.5 text-ink">{mesh.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink/50">Trays</dt>
              <dd className="mt-0.5 text-ink">
                {mesh.nodeCount} tray{mesh.nodeCount === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>
        ) : (
          <>
            <label className="block text-sm">
              <span className="text-xs font-medium text-ink/50">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={160}
                disabled={busy}
                className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              />
            </label>

            <div>
              <p className="text-xs font-medium text-ink/50">Trays</p>
              <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
                {trays.map((tray) => {
                  const checked = selected.includes(tray.id);
                  return (
                    <li key={tray.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => toggleTray(tray.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition-all ${
                          checked
                            ? "border-leaf bg-lime/10 ring-1 ring-leaf/20"
                            : "border-ink/10 hover:border-ink/15 hover:bg-white/50"
                        }`}
                      >
                        <span className="font-medium text-ink">{tray.name}</span>
                        <span className="text-xs text-ink/40">{tray.crop}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-ink/40">
                {selected.length} tray{selected.length === 1 ? "" : "s"} selected
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="px-3 py-2 text-xs"
                disabled={busy || !name.trim() || selected.length < 2}
                onClick={() => void save()}
              >
                {busy ? "Saving..." : "Save mesh"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="px-3 py-2 text-xs"
                disabled={busy}
                onClick={reset}
              >
                Cancel
              </Button>
            </div>

            <div className="border-t border-rose-100 pt-4">
              <p className="text-sm font-semibold text-ink/75">Delete mesh</p>
              <p className="mt-1 text-xs text-ink/40">
                Removes this mesh group and its mesh schedules. Trays and plants
                are kept.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
                className="mt-3 rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                Delete mesh...
              </button>
            </div>
          </>
        )}
      </Card>

      {deleteOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => {
            if (!busy) setDeleteOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-mesh-dialog-title"
            className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-5 shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <p
              id="delete-mesh-dialog-title"
              className="text-sm font-semibold text-ink"
            >
              Delete this mesh?
            </p>
            <p className="mt-2 text-sm text-ink/60">
              This removes{" "}
              <span className="font-semibold text-ink">{mesh.name}</span> and
              any schedules scoped to it. The trays and plants stay in your
              account.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                className="bg-rose-600 hover:bg-rose-700"
                disabled={busy}
                onClick={() => void remove()}
              >
                {busy ? "Deleting..." : "Delete mesh"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setDeleteOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
