"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/app/Section";
import { PlantImage } from "@/components/media/PlantImage";
import type { PlantUnit } from "@/lib/types/domain";
import { formatRelativeTimestamp } from "@/lib/utils";

export function PlantDetailClient({
  plant: initial
}: {
  plant: PlantUnit;
}) {
  const router = useRouter();
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
    <div className="mt-4 space-y-4">
      {err ? (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink/80">New leaf photo</p>
          {photoBusy ? (
            <span className="text-xs text-ink/45">Analyzing…</span>
          ) : null}
        </div>
        <p className="text-xs text-ink/45">
          Take or upload anytime. The classifier updates health and report history.
        </p>
        <label className="block">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={photoBusy}
            className="block w-full text-sm text-ink/70 file:mr-3 file:rounded-lg file:border-0 file:bg-lime file:px-3 file:py-2 file:font-semibold file:text-ink"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadPhoto(f);
              e.target.value = "";
            }}
          />
        </label>
      </Card>

      {plant.lastImageUrl ? (
        <Card className="overflow-hidden border-lime/30 p-0 shadow-[0_12px_40px_rgba(61,159,108,0.18)] ring-2 ring-lime/20">
          <div className="relative aspect-[4/3] w-full max-h-[280px] bg-mist">
            <PlantImage
              src={plant.lastImageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 480px"
            />
          </div>
          <p className="px-3 py-2 text-xs text-ink/45">
            Last plant image · {formatRelativeTimestamp(plant.lastImageAt)}
          </p>
        </Card>
      ) : (
        <p className="text-sm text-ink/45">No photo yet — use the control above.</p>
      )}

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink/80">Plant details</p>
          {!editing ? (
            <Button
              type="button"
              variant="secondary"
              className="text-sm"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          ) : null}
        </div>

        {editing ? (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="text-ink/70">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
                maxLength={120}
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink/70">Species / cultivar label</span>
              <input
                value={cultivar}
                onChange={(e) => setCultivar(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
                maxLength={120}
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink/70">Description (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2 text-sm"
                maxLength={4000}
                placeholder="Notes, location, care reminders…"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void saveEdit()}>
                Save
              </Button>
              <Button
                type="button"
                variant="secondary"
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
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-ink/45">Name · </span>
              {plant.name}
            </p>
            <p>
              <span className="text-ink/45">Species / cultivar · </span>
              {plant.cultivar}
            </p>
            {plant.description ? (
              <p className="whitespace-pre-wrap text-ink/70">{plant.description}</p>
            ) : (
              <p className="text-ink/40">No description.</p>
            )}
          </div>
        )}
      </Card>

      <Card className="border-red-200/60 bg-red-50/40 p-4">
        <p className="text-sm font-semibold text-ink/80">Delete plant</p>
        <p className="mt-1 text-xs text-ink/50">
          Removes the plant, its reports, and linked photo captures. This cannot be undone.
        </p>
        {deleteConfirm ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700"
              disabled={busy}
              onClick={() => void removePlant()}
            >
              Confirm delete
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setDeleteConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="mt-3 border-red-200 text-red-700"
            onClick={() => setDeleteConfirm(true)}
          >
            Delete plant…
          </Button>
        )}
      </Card>
    </div>
  );
}
