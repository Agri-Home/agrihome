"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import { TRAINING_FEEDBACK_CATEGORIES } from "@/lib/constants/training-feedback-ui";
import type { PlantHealthStatus, PlantUnit, TraySystem } from "@/lib/types/domain";

const TRAIN_MAX_BYTES = 8 * 1024 * 1024;

export function TrayManageClient({ tray }: { tray: TraySystem }) {
  const router = useRouter();
  const trainingPhotoRef = useRef<HTMLInputElement>(null);
  const [tName, setTName] = useState(tray.name);
  const [tZone, setTZone] = useState(tray.zone);
  const [tCrop, setTCrop] = useState(tray.crop);
  const [tDevice, setTDevice] = useState(tray.deviceId);
  const [trayBusy, setTrayBusy] = useState(false);
  const [trayErr, setTrayErr] = useState<string | null>(null);

  const [pName, setPName] = useState("");
  const [pCultivar, setPCultivar] = useState("");
  const [pRow, setPRow] = useState("");
  const [pCol, setPCol] = useState("");
  const [pSlot, setPSlot] = useState("");
  const [pId, setPId] = useState("");
  const [pHealth, setPHealth] = useState("88");
  const [pStatus, setPStatus] = useState<PlantHealthStatus>("healthy");
  const [pDiag, setPDiag] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [plantBusy, setPlantBusy] = useState(false);
  const [plantErr, setPlantErr] = useState<string | null>(null);
  const [plantOk, setPlantOk] = useState<string | null>(null);
  const [mTrainCategory, setMTrainCategory] = useState("");
  const [mTrainTags, setMTrainTags] = useState("");
  const [mTrainComment, setMTrainComment] = useState("");

  useEffect(() => {
    setTName(tray.name);
    setTZone(tray.zone);
    setTCrop(tray.crop);
    setTDevice(tray.deviceId);
  }, [tray.id, tray.name, tray.zone, tray.crop, tray.deviceId]);

  async function saveTray() {
    setTrayErr(null);
    setTrayBusy(true);
    try {
      const res = await fetch(`/api/trays/${encodeURIComponent(tray.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tName.trim(),
          zone: tZone.trim(),
          crop: tCrop.trim(),
          deviceId: tDevice.trim() || "manual"
        })
      });
      const json = (await res.json()) as { data?: TraySystem; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save tray");
      router.refresh();
    } catch (e) {
      setTrayErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setTrayBusy(false);
    }
  }

  async function addPlant() {
    setPlantErr(null);
    setPlantOk(null);
    setPlantBusy(true);
    try {
      const rowN = pRow.trim() === "" ? undefined : Number(pRow);
      const colN = pCol.trim() === "" ? undefined : Number(pCol);
      if (
        (pRow.trim() !== "" && pCol.trim() === "") ||
        (pCol.trim() !== "" && pRow.trim() === "")
      ) {
        throw new Error("Enter both row and column, or leave both empty for auto layout");
      }
      if (rowN !== undefined && (!Number.isFinite(rowN) || rowN < 1)) {
        throw new Error("Row must be a positive integer");
      }
      if (colN !== undefined && (!Number.isFinite(colN) || colN < 1)) {
        throw new Error("Column must be a positive integer");
      }

      const healthN = pHealth.trim() === "" ? undefined : Number(pHealth);
      if (healthN !== undefined && (!Number.isFinite(healthN) || healthN < 0 || healthN > 100)) {
        throw new Error("Health must be between 0 and 100");
      }

      const body: Record<string, unknown> = {
        name: pName.trim(),
        cultivar: pCultivar.trim(),
        trayId: tray.id
      };
      if (rowN !== undefined) body.row = rowN;
      if (colN !== undefined) body.column = colN;
      if (pSlot.trim()) body.slotLabel = pSlot.trim();
      if (pId.trim()) body.plantIdentifier = pId.trim();
      if (pDesc.trim()) body.description = pDesc.trim();
      if (healthN !== undefined) body.healthScore = Math.round(healthN);
      body.status = pStatus;
      if (pDiag.trim()) body.latestDiagnosis = pDiag.trim();

      const res = await fetch("/api/plants/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = (await res.json()) as { data?: PlantUnit; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not add plant");

      const nameSaved = pName.trim();
      const cultivarSaved = pCultivar.trim();
      const trainFile = trainingPhotoRef.current?.files?.[0];
      const tCat = mTrainCategory.trim();
      const tTags = mTrainTags.trim();
      const tCom = mTrainComment.trim();
      const hasTrainText = Boolean(tCat) || Boolean(tTags) || tCom.length >= 3;

      if (trainFile && !hasTrainText) {
        throw new Error(
          "Training photo: add a category, tags, or a comment (3+ characters)."
        );
      }
      if (trainFile && hasTrainText) {
        const okMime =
          trainFile.type === "image/jpeg" ||
          trainFile.type === "image/png" ||
          trainFile.type === "image/webp";
        if (!okMime) {
          throw new Error("Training photo must be JPEG, PNG, or WebP.");
        }
        if (trainFile.size > TRAIN_MAX_BYTES) {
          throw new Error("Training photo is too large (max 8MB).");
        }
        const fd = new FormData();
        fd.append("image", trainFile);
        if (tCat) fd.append("feedbackCategory", tCat.slice(0, 120));
        if (tTags) fd.append("tags", tTags);
        if (tCom) fd.append("comment", tCom.slice(0, 4000));
        fd.append(
          "modelPrediction",
          `${nameSaved} / ${cultivarSaved}`.slice(0, 120)
        );
        const tr = await fetch("/api/feedback/ingest", {
          method: "POST",
          body: fd,
          credentials: "include"
        });
        const tj = (await tr.json()) as { error?: string };
        if (!tr.ok) {
          throw new Error(tj.error ?? "Plant saved but training upload failed.");
        }
      }

      setPlantOk(
        trainFile && hasTrainText
          ? "Plant added and training feedback saved."
          : "Plant added."
      );
      setPName("");
      setPCultivar("");
      setPRow("");
      setPCol("");
      setPSlot("");
      setPId("");
      setPHealth("88");
      setPStatus("healthy");
      setPDiag("");
      setPDesc("");
      setMTrainCategory("");
      setMTrainTags("");
      setMTrainComment("");
      if (trainingPhotoRef.current) trainingPhotoRef.current.value = "";
      router.refresh();
    } catch (e) {
      setPlantErr(e instanceof Error ? e.message : "Error");
    } finally {
      setPlantBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Tray settings</p>
        <p className="mt-0.5 text-xs text-ink/40">
          Name, location, and crop shown across the app.
        </p>
        {trayErr && (
          <p className="mt-2 text-sm text-rose-600" role="alert">
            {trayErr}
          </p>
        )}
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Name</span>
            <input
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={120}
              disabled={trayBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Zone</span>
            <input
              value={tZone}
              onChange={(e) => setTZone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={120}
              disabled={trayBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Crop</span>
            <input
              value={tCrop}
              onChange={(e) => setTCrop(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={120}
              disabled={trayBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Device ID</span>
            <input
              value={tDevice}
              onChange={(e) => setTDevice(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 font-mono text-sm focus:border-leaf focus:outline-none"
              maxLength={64}
              disabled={trayBusy}
            />
          </label>
          <Button
            type="button"
            className="px-3 py-2 text-xs"
            disabled={trayBusy || !tName.trim() || !tZone.trim() || !tCrop.trim()}
            onClick={() => void saveTray()}
          >
            {trayBusy ? "Saving…" : "Save tray"}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Add plant manually</p>
        <p className="mt-0.5 text-xs text-ink/40">
          Set grid position, slot label, ID tag, and health. Leave row/column empty to auto-place.
        </p>
        {plantErr && (
          <p className="mt-2 text-sm text-rose-600" role="alert">
            {plantErr}
          </p>
        )}
        {plantOk && (
          <p className="mt-2 text-sm text-emerald-700" role="status">
            {plantOk}
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-medium text-ink/50">Name</span>
            <input
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={120}
              placeholder="Basil"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-medium text-ink/50">Species / cultivar</span>
            <input
              value={pCultivar}
              onChange={(e) => setPCultivar(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={120}
              placeholder="Ocimum basilicum"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Row</span>
            <input
              value={pRow}
              onChange={(e) => setPRow(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              placeholder="Auto"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Column</span>
            <input
              value={pCol}
              onChange={(e) => setPCol(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              placeholder="Auto"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-medium text-ink/50">Slot label</span>
            <input
              value={pSlot}
              onChange={(e) => setPSlot(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={32}
              placeholder="e.g. R2C1 or NFC-A7"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-medium text-ink/50">Plant ID (label, RFID, lab code)</span>
            <input
              value={pId}
              onChange={(e) => setPId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 font-mono text-sm focus:border-leaf focus:outline-none"
              maxLength={120}
              placeholder="Optional"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Health (0–100)</span>
            <input
              value={pHealth}
              onChange={(e) => setPHealth(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-medium text-ink/50">Status</span>
            <select
              value={pStatus}
              onChange={(e) => setPStatus(e.target.value as PlantHealthStatus)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              disabled={plantBusy}
            >
              <option value="healthy">healthy</option>
              <option value="watch">watch</option>
              <option value="alert">alert</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-medium text-ink/50">Latest condition / diagnosis</span>
            <input
              value={pDiag}
              onChange={(e) => setPDiag(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={160}
              placeholder="Optional — overrides default “Awaiting first photo”"
              disabled={plantBusy}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-xs font-medium text-ink/50">Notes</span>
            <textarea
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              maxLength={4000}
              placeholder="Optional notes"
              disabled={plantBusy}
            />
          </label>

          <div className="sm:col-span-2 mt-2 rounded-xl border border-ink/10 bg-ink/[0.02] p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink/40">
              Optional — training photo
            </p>
            <p className="mt-0.5 text-[11px] text-ink/35">
              Attach a leaf/tray image and feedback to store for model improvement (same flow as Feedback page).
            </p>
            <input
              ref={trainingPhotoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={plantBusy}
              className="mt-2 block w-full text-xs text-ink/60 file:mr-3 file:rounded-lg file:border-0 file:bg-lime/30 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink"
            />
            <label className="mt-3 block text-sm">
              <span className="text-xs font-medium text-ink/50">Training category</span>
              <select
                value={mTrainCategory}
                onChange={(e) => setMTrainCategory(e.target.value)}
                disabled={plantBusy}
                className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              >
                {TRAINING_FEEDBACK_CATEGORIES.map((c) => (
                  <option key={c || "empty"} value={c}>
                    {c || "— None —"}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block text-sm">
              <span className="text-xs font-medium text-ink/50">Training tags</span>
              <input
                value={mTrainTags}
                onChange={(e) => setMTrainTags(e.target.value)}
                disabled={plantBusy}
                placeholder="Comma-separated"
                className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              />
            </label>
            <label className="mt-2 block text-sm">
              <span className="text-xs font-medium text-ink/50">Training comment</span>
              <textarea
                value={mTrainComment}
                onChange={(e) => setMTrainComment(e.target.value)}
                disabled={plantBusy}
                rows={2}
                maxLength={4000}
                placeholder="Optional — required with photo (or use category/tags)"
                className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
              />
            </label>
          </div>
        </div>
        <Button
          type="button"
          className="mt-4 w-full sm:w-auto"
          disabled={plantBusy || !pName.trim() || !pCultivar.trim()}
          onClick={() => void addPlant()}
        >
          {plantBusy ? "Adding…" : "Add plant to this tray"}
        </Button>
      </Card>
    </div>
  );
}
