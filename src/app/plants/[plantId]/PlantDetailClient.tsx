"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { PlantImage } from "@/components/media/PlantImage";
import type { PlantUnit } from "@/lib/types/domain";
import { formatRelativeTimestamp } from "@/lib/utils";

export function PlantDetailClient({
  plant: initial
}: {
  plant: PlantUnit;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [plant, setPlant] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial.name);
  const [cultivar, setCultivar] = useState(initial.cultivar);
  const [description, setDescription] = useState(initial.description ?? "");
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    setPlant(initial);
    setName(initial.name);
    setCultivar(initial.cultivar);
    setDescription(initial.description ?? "");
  }, [initial]);

  async function saveEdit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/plants/${plant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          cultivar: cultivar.trim(),
          description: description.trim() === "" ? null : description.trim()
        })
      });
      const json = (await res.json()) as { data?: PlantUnit; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not save");
      }
      if (json.data) {
        setPlant(json.data);
        setName(json.data.name);
        setCultivar(json.data.cultivar);
        setDescription(json.data.description ?? "");
      }
      setEditing(false);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file: File) {
    setErr(null);
    setPhotoBusy(true);
    const fd = new FormData();
    fd.append("photo", file);
    try {
      const res = await fetch(`/api/plants/${plant.id}/photo`, {
        method: "POST",
        body: fd
      });
      const json = (await res.json()) as {
        data?: {
          plant?: PlantUnit;
          imageUrl: string;
          report?: { diagnosis: string };
        };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Upload failed");
      }
      if (json.data?.plant) {
        setPlant(json.data.plant);
      } else if (json.data?.imageUrl) {
        setPlant((p) => ({
          ...p,
          lastImageUrl: json.data!.imageUrl,
          lastImageAt: new Date().toISOString(),
          latestDiagnosis: json.data?.report?.diagnosis ?? p.latestDiagnosis
        }));
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePlant() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/plants/${plant.id}`, { method: "DELETE" });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Delete failed");
      }
      router.push(`/trays/${plant.trayId}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100" role="alert">
          {err}
        </div>
      )}

      {/* Plant image with overlay upload button */}
      {plant.lastImageUrl ? (
        <Card className="overflow-hidden p-0">
          <div className="relative aspect-[4/3] w-full max-h-[300px] bg-mist">
            <PlantImage
              src={plant.lastImageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 480px"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/50 to-transparent p-4">
              <p className="text-xs font-medium text-white/80">
                {formatRelativeTimestamp(plant.lastImageAt)}
              </p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-md transition-all hover:bg-white/30 active:scale-90 disabled:opacity-50"
                aria-label="Upload new photo"
              >
                {photoBusy ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                )}
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-0">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={photoBusy}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-ink/10 p-10 transition-colors hover:border-leaf/30 hover:bg-lime/5"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-leaf to-moss text-white shadow-fab">
              {photoBusy ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              )}
            </span>
            <span className="text-sm font-medium text-ink/50">
              {photoBusy ? "Analyzing..." : "Take or upload a photo"}
            </span>
            <span className="text-xs text-ink/30">The classifier updates health automatically</span>
          </button>
        </Card>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadPhoto(f);
          e.target.value = "";
        }}
      />

      {/* Plant details card */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">Plant Details</p>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-leaf transition-colors hover:bg-lime/10"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="text-xs font-medium text-ink/50">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
                maxLength={120}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-ink/50">Species / cultivar</span>
              <input
                value={cultivar}
                onChange={(e) => setCultivar(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
                maxLength={120}
              />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-medium text-ink/50">Description (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm transition-colors focus:border-leaf focus:outline-none"
                maxLength={4000}
                placeholder="Notes, location, care reminders..."
              />
            </label>
            <div className="flex gap-2 pt-1">
              <Button type="button" disabled={busy} onClick={() => void saveEdit()} className="flex-1">
                {busy ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setName(plant.name);
                  setCultivar(plant.cultivar);
                  setDescription(plant.description ?? "");
                  setErr(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="text-xs text-ink/35">Name</span>
              <span className="font-medium text-ink">{plant.name}</span>
            </div>
            <div className="flex items-baseline gap-2 text-sm">
              <span className="text-xs text-ink/35">Species</span>
              <span className="font-medium text-ink">{plant.cultivar}</span>
            </div>
            {plant.description ? (
              <p className="whitespace-pre-wrap text-sm text-ink/60">{plant.description}</p>
            ) : (
              <p className="text-xs text-ink/30">No description added.</p>
            )}
          </div>
        )}
      </Card>

      {/* Danger zone */}
      <Card className="border-rose-100 bg-rose-50/30 p-5">
        <p className="text-sm font-semibold text-ink/75">Delete Plant</p>
        <p className="mt-1 text-xs text-ink/40">
          Permanently removes this plant, reports, and photo captures.
        </p>
        {deleteConfirm ? (
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              className="bg-rose-600 hover:bg-rose-700"
              disabled={busy}
              onClick={() => void removePlant()}
            >
              {busy ? "Deleting..." : "Confirm delete"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setDeleteConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="mt-3 rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
          >
            Delete plant...
          </button>
        )}
      </Card>
    </div>
  );
}
