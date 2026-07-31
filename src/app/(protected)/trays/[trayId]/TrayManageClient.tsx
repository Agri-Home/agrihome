"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/atoms/Button";
import { Card } from "@/components/atoms/Card";
import {
  TRAINING_FEEDBACK_CATEGORIES,
  TRAINING_FEEDBACK_CROP_EXAMPLES
} from "@/lib/constants/training-feedback-ui";
import type { PlantHealthStatus, PlantUnit, TraySystem } from "@/lib/types/domain";

const TRAIN_MAX_BYTES = 8 * 1024 * 1024;

export function TrayManageClient({
  tray,
  showTrainingFeedback
}: {
  tray: TraySystem;
  showTrainingFeedback: boolean;
}) {
  const router = useRouter();
  const trainingPhotoRef = useRef<HTMLInputElement>(null);
  const addPlantDialogTitleId = useId();
  const deleteDialogTitleId = useId();
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addPlantOpen, setAddPlantOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const linkedToPi = Boolean(tray.edgeDeviceId);
  const plantCount = tray.plantCount ?? 0;
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
  const [mTrainCrop, setMTrainCrop] = useState("");
  const [mTrainCategory, setMTrainCategory] = useState("");
  const [mTrainTags, setMTrainTags] = useState("");
  const [mTrainComment, setMTrainComment] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setTName(tray.name);
    setTZone(tray.zone);
    setTCrop(tray.crop);
    setTDevice(tray.deviceId);
  }, [tray.id, tray.name, tray.zone, tray.crop, tray.deviceId]);

  function resetPlantForm() {
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
    setMTrainCrop("");
    setMTrainCategory("");
    setMTrainTags("");
    setMTrainComment("");
    setPlantErr(null);
    setPlantOk(null);
    if (trainingPhotoRef.current) trainingPhotoRef.current.value = "";
  }

  function openAddPlant() {
    resetPlantForm();
    setAddPlantOpen(true);
  }

  function closeAddPlant() {
    if (plantBusy) return;
    setAddPlantOpen(false);
    resetPlantForm();
  }

  const onEscapeDialog = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    if (addPlantOpen) closeAddPlant();
    else if (deleteDialogOpen) closeDeleteDialog();
  });

  useEffect(() => {
    if (!addPlantOpen && !deleteDialogOpen) return;
    document.addEventListener("keydown", onEscapeDialog);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscapeDialog);
      document.body.style.overflow = prev;
    };
  }, [addPlantOpen, deleteDialogOpen]);

  function cancelEdit() {
    setTName(tray.name);
    setTZone(tray.zone);
    setTCrop(tray.crop);
    setTDevice(tray.deviceId);
    setTrayErr(null);
    setEditing(false);
    setDeleteDialogOpen(false);
  }

  function closeDeleteDialog() {
    if (deleteBusy) return;
    setDeleteDialogOpen(false);
  }

  function requestDeleteTray() {
    setTrayErr(null);
    if (linkedToPi) {
      setTrayErr(
        "Unregister the linked Raspberry Pi in the Raspberry Pi section before deleting this tray."
      );
      return;
    }
    setDeleteDialogOpen(true);
  }

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
      setEditing(false);
      setDeleteDialogOpen(false);
      router.refresh();
    } catch (e) {
      setTrayErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setTrayBusy(false);
    }
  }

  async function removeTray() {
    setTrayErr(null);
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/trays/${encodeURIComponent(tray.id)}`, {
        method: "DELETE"
      });
      const json = (await res.json()) as {
        error?: string | { message?: string };
      };
      if (!res.ok) {
        const errMsg =
          typeof json.error === "string"
            ? json.error
            : json.error?.message;
        throw new Error(errMsg ?? "Delete failed");
      }
      setDeleteDialogOpen(false);
      router.push("/trays");
      router.refresh();
    } catch (e) {
      setTrayErr(e instanceof Error ? e.message : "Delete failed");
      setDeleteBusy(false);
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
      const tCropVal = mTrainCrop.trim();
      const tCat = mTrainCategory.trim();
      const tTags = mTrainTags.trim();
      const tCom = mTrainComment.trim();
      const hasTrainText =
        (tCropVal.length > 0 && tCat.length > 0) ||
        tCat.length > 0 ||
        tTags.length > 0 ||
        tCom.length >= 3;

      if (trainFile && !hasTrainText) {
        throw new Error(
          "Training photo: add crop + condition, a condition, tags, or a comment (3+ characters)."
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
        if (tCropVal) fd.append("feedbackCrop", tCropVal.slice(0, 120));
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
      resetPlantForm();
      setAddPlantOpen(false);
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Tray settings</p>
            <p className="mt-0.5 text-xs text-ink/40">
              Name, location, and crop shown across the app.
            </p>
          </div>
          {!editing ? (
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 px-3 py-2 text-xs"
              onClick={() => {
                setEditing(true);
                setDeleteDialogOpen(false);
                setTrayErr(null);
              }}
            >
              Edit
            </Button>
          ) : null}
        </div>

        {!editing ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-ink/50">Name</dt>
              <dd className="mt-0.5 text-ink">{tray.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink/50">Zone</dt>
              <dd className="mt-0.5 text-ink">{tray.zone}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink/50">Crop</dt>
              <dd className="mt-0.5 text-ink">{tray.crop}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink/50">Device ID</dt>
              <dd className="mt-0.5 font-mono text-ink">{tray.deviceId}</dd>
            </div>
          </dl>
        ) : (
          <>
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
                  disabled={trayBusy || deleteBusy}
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs font-medium text-ink/50">Zone</span>
                <input
                  value={tZone}
                  onChange={(e) => setTZone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
                  maxLength={120}
                  disabled={trayBusy || deleteBusy}
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs font-medium text-ink/50">Crop</span>
                <input
                  value={tCrop}
                  onChange={(e) => setTCrop(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
                  maxLength={120}
                  disabled={trayBusy || deleteBusy}
                />
              </label>
              <label className="block text-sm">
                <span className="text-xs font-medium text-ink/50">Device ID</span>
                <input
                  value={tDevice}
                  onChange={(e) => setTDevice(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 font-mono text-sm focus:border-leaf focus:outline-none"
                  maxLength={64}
                  disabled={trayBusy || deleteBusy}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="px-3 py-2 text-xs"
                  disabled={
                    trayBusy ||
                    deleteBusy ||
                    !tName.trim() ||
                    !tZone.trim() ||
                    !tCrop.trim()
                  }
                  onClick={() => void saveTray()}
                >
                  {trayBusy ? "Saving…" : "Save tray"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-3 py-2 text-xs"
                  disabled={trayBusy || deleteBusy}
                  onClick={cancelEdit}
                >
                  Cancel
                </Button>
              </div>
            </div>

            <div className="mt-5 border-t border-rose-100 pt-4">
              <p className="text-sm font-semibold text-ink/75">Delete tray</p>
              <p className="mt-1 text-xs text-ink/40">
                Permanently removes this tray
                {plantCount > 0
                  ? `, ${plantCount} plant${plantCount === 1 ? "" : "s"}`
                  : ""}
                , poses, schedules, and related captures.
              </p>
              {linkedToPi ? (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  This tray is linked to a Raspberry Pi. Unregister the device in
                  the Raspberry Pi section first, then you can delete the tray.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={requestDeleteTray}
                  disabled={trayBusy || deleteBusy}
                  className="mt-3 rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                >
                  Delete tray…
                </button>
              )}
            </div>
          </>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Add plant manually</p>
            <p className="mt-0.5 text-xs text-ink/40">
              Set grid position, slot label, ID tag, and health.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddPlant}
            aria-label="Add plant manually"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-white text-ink transition-colors hover:border-leaf/40 hover:bg-lime/20"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </Card>

      {mounted && addPlantOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
              role="presentation"
              onClick={closeAddPlant}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={addPlantDialogTitleId}
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-ink/10 bg-white p-5 shadow-lift"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      id={addPlantDialogTitleId}
                      className="text-sm font-semibold text-ink"
                    >
                      Add plant manually
                    </p>
                    <p className="mt-0.5 text-xs text-ink/40">
                      Leave row/column empty to auto-place.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-sm text-ink/45 hover:bg-ink/[0.05] hover:text-ink"
                    disabled={plantBusy}
                    onClick={closeAddPlant}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

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
                      autoFocus
                    />
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="text-xs font-medium text-ink/50">
                      Species / cultivar
                    </span>
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
                    <span className="text-xs font-medium text-ink/50">
                      Slot label
                    </span>
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
                    <span className="text-xs font-medium text-ink/50">
                      Plant ID (label, RFID, lab code)
                    </span>
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
                    <span className="text-xs font-medium text-ink/50">
                      Health (0–100)
                    </span>
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
                      onChange={(e) =>
                        setPStatus(e.target.value as PlantHealthStatus)
                      }
                      className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
                      disabled={plantBusy}
                    >
                      <option value="healthy">healthy</option>
                      <option value="watch">watch</option>
                      <option value="alert">alert</option>
                    </select>
                  </label>
                  <label className="block text-sm sm:col-span-2">
                    <span className="text-xs font-medium text-ink/50">
                      Latest condition / diagnosis
                    </span>
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

                  {showTrainingFeedback ? (
                    <div className="sm:col-span-2 mt-2 rounded-xl border border-ink/10 bg-ink/[0.02] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink/40">
                        Optional — training photo
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink/35">
                        Attach a leaf/tray image and feedback to store for model
                        improvement (same fields as the Feedback page).
                      </p>
                      <input
                        ref={trainingPhotoRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={plantBusy}
                        className="mt-2 block w-full text-xs text-ink/60 file:mr-3 file:rounded-lg file:border-0 file:bg-lime/30 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink"
                      />
                      <label className="mt-3 block text-sm">
                        <span className="text-xs font-medium text-ink/50">
                          Name (crop or plant)
                        </span>
                        <input
                          value={mTrainCrop}
                          onChange={(e) => setMTrainCrop(e.target.value)}
                          disabled={plantBusy}
                          list="tray-train-crop-suggestions"
                          maxLength={120}
                          autoComplete="off"
                          placeholder="e.g. Tomato"
                          className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
                        />
                      </label>
                      <datalist id="tray-train-crop-suggestions">
                        {TRAINING_FEEDBACK_CROP_EXAMPLES.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                      <label className="mt-2 block text-sm">
                        <span className="text-xs font-medium text-ink/50">
                          Condition
                        </span>
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
                        <span className="text-xs font-medium text-ink/50">
                          Training tags
                        </span>
                        <input
                          value={mTrainTags}
                          onChange={(e) => setMTrainTags(e.target.value)}
                          disabled={plantBusy}
                          placeholder="Comma-separated"
                          className="mt-1 w-full rounded-xl border border-ink/10 bg-white/80 px-3.5 py-2.5 text-sm focus:border-leaf focus:outline-none"
                        />
                      </label>
                      <label className="mt-2 block text-sm">
                        <span className="text-xs font-medium text-ink/50">
                          Training comment
                        </span>
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
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    disabled={plantBusy || !pName.trim() || !pCultivar.trim()}
                    onClick={() => void addPlant()}
                  >
                    {plantBusy ? "Adding…" : "Add plant to this tray"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={plantBusy}
                    onClick={closeAddPlant}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {mounted && deleteDialogOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 sm:items-center"
              role="presentation"
              onClick={closeDeleteDialog}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={deleteDialogTitleId}
                className="w-full max-w-md rounded-3xl border border-ink/10 bg-white p-5 shadow-lift"
                onClick={(e) => e.stopPropagation()}
              >
                <p
                  id={deleteDialogTitleId}
                  className="text-sm font-semibold text-ink"
                >
                  Delete this tray?
                </p>
                <p className="mt-2 text-sm text-ink/60">
                  {plantCount > 0 ? (
                    <>
                      This tray has{" "}
                      <span className="font-semibold text-ink">
                        {plantCount} plant{plantCount === 1 ? "" : "s"}
                      </span>
                      . Deleting removes those plants plus poses, schedules, and
                      related captures. This cannot be undone.
                    </>
                  ) : (
                    <>
                      Permanently removes this tray, poses, schedules, and
                      related captures. This cannot be undone.
                    </>
                  )}
                </p>
                {trayErr ? (
                  <p className="mt-2 text-sm text-rose-600" role="alert">
                    {trayErr}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="bg-rose-600 hover:bg-rose-700"
                    disabled={deleteBusy || trayBusy}
                    onClick={() => void removeTray()}
                  >
                    {deleteBusy
                      ? "Deleting…"
                      : plantCount > 0
                        ? "Delete tray and plants"
                        : "Delete tray"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={deleteBusy}
                    onClick={closeDeleteDialog}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
